import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import multer from "multer";
import sharp from "sharp";
import { z, ZodError } from "zod";
import { User, Vehicle, RecognitionLog } from "./models/index.js";
import {
  plate,
  normalize,
  vehicleInput,
  registerInput,
  loginInput,
  dateFilters,
  objectId,
} from "./validation.js";
import { createProvider } from "./services/provider.js";

export function createApp(
  c,
  { provider = createProvider(c), recognize = null } = {},
) {
  const app = express();
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(
    cors({
      origin(origin, cb) {
        cb(null, !origin || c.origins.includes(origin));
      },
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "32kb" }));
  app.use(cookieParser());
  app.use("/api", (req, res, next) => {
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      !c.origins.includes(req.get("Origin"))
    )
      return res
        .status(403)
        .json({ error: "Request origin is not allowed. Check CORS_ORIGINS." });
    next();
  });
  const general = rateLimit({
    windowMs: 60000,
    limit: 120,
    standardHeaders: "draft-8",
    legacyHeaders: false,
  });
  const authLimit = rateLimit({
    windowMs: 15 * 60000,
    limit: 30,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: "Too many sign-in attempts. Try again later." },
  });
  const aiLimit = rateLimit({
    windowMs: 60000,
    limit: 15,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: "Recognition limit reached. Please wait a minute." },
  });
  app.use("/api", general);
  const cookie = {
    httpOnly: true,
    sameSite: "strict",
    secure: c.production,
    path: "/",
    maxAge: 8 * 3600000,
  };
  const publicUser = (u) => ({
    id: String(u._id),
    name: u.name,
    email: u.email,
    role: u.role,
  });
  const expires = () => new Date(Date.now() + c.LOG_RETENTION_DAYS * 86400000);
  async function auth(req, res, next) {
    try {
      const t = req.cookies.session;
      if (!t) return res.status(401).json({ error: "Please sign in." });
      const decoded = jwt.verify(t, c.JWT_SECRET, {
        algorithms: ["HS256"],
        issuer: "platewatch",
        audience: "platewatch-web",
      });
      const user = await User.findById(decoded.sub);
      if (!user) return res.status(401).json({ error: "Account not found." });
      req.user = user;
      next();
    } catch (e) {
      if (e.name === "JsonWebTokenError" || e.name === "TokenExpiredError")
        return res
          .status(401)
          .json({ error: "Session expired. Please sign in." });
      next(e);
    }
  }
  function admin(req, res, next) {
    if (req.user.role !== "admin")
      return res.status(403).json({ error: "Administrator access required." });
    next();
  }
  function issue(res, user) {
    res.cookie(
      "session",
      jwt.sign({}, c.JWT_SECRET, {
        algorithm: "HS256",
        subject: String(user._id),
        issuer: "platewatch",
        audience: "platewatch-web",
        expiresIn: "8h",
      }),
      cookie,
    );
  }
  app.get("/api/health", (_, res) => res.json({ ok: true }));
  app.get("/api/config", (_, res) =>
    res.json({
      publicRegistration: c.ALLOW_PUBLIC_REGISTRATION === "true",
      officialLookupConfigured: provider.configured,
      imageRetention: "Images are not retained after processing.",
      logRetentionDays: c.LOG_RETENTION_DAYS,
    }),
  );
  app.post("/api/auth/register", authLimit, async (req, res) => {
    if (c.ALLOW_PUBLIC_REGISTRATION !== "true")
      return res
        .status(403)
        .json({ error: "Public registration is disabled." });
    const d = registerInput.parse(req.body);
    const user = await User.create({
      name: d.name,
      email: d.email,
      passwordHash: await bcrypt.hash(d.password, 12),
      role: "user",
    });
    issue(res, user);
    res.status(201).json({ user: publicUser(user) });
  });
  app.post("/api/auth/login", authLimit, async (req, res) => {
    const d = loginInput.parse(req.body);
    const user = await User.findOne({ email: d.email }).select("+passwordHash");
    if (!user || !(await bcrypt.compare(d.password, user.passwordHash)))
      return res.status(401).json({ error: "Incorrect email or password." });
    issue(res, user);
    res.json({ user: publicUser(user) });
  });
  app.get("/api/auth/me", auth, (req, res) =>
    res.json({ user: publicUser(req.user) }),
  );
  app.post("/api/auth/logout", auth, (_, res) => {
    res.clearCookie("session", { ...cookie, maxAge: undefined });
    res.json({ ok: true });
  });

  app.post("/api/lookup", auth, async (req, res) => {
    const body = z
      .object({
        registrationNumber: plate,
        recognitionId: objectId.optional(),
        inputMethod: z.literal("manual").optional(),
      })
      .parse(req.body);
    let log;
    if (body.recognitionId) {
      log = await RecognitionLog.findOne({
        _id: body.recognitionId,
        user: req.user._id,
      });
      if (!log)
        return res
          .status(404)
          .json({ error: "Recognition attempt not found." });
      if (log.recognitionStatus !== "pending_confirmation")
        return res
          .status(409)
          .json({
            error:
              "This attempt is already confirmed or failed. Start a new lookup.",
          });
    } else
      log = new RecognitionLog({
        user: req.user._id,
        inputMethod: "manual",
        recognitionStatus: "manual",
        expiresAt: expires(),
      });
    const local = await Vehicle.findOne({
      registrationNumber: body.registrationNumber,
    }).lean();
    const external = local
      ? { status: "not_attempted" }
      : await provider.lookup(body.registrationNumber);
    const vehicle =
      local ||
      (external.status === "found"
        ? {
            ...external.vehicle,
            authorizationStatus: "not_on_local_list",
            dataSource: "Authorized external provider",
            registrationSource: c.PROVIDER_ID,
            updatedAt: external.retrievedAt,
          }
        : null);
    log.registrationNumber = body.registrationNumber;
    if (body.recognitionId) {
      log.correctedRegistrationNumber =
        body.registrationNumber !== log.recognizedRegistrationNumber
          ? body.registrationNumber
          : "";
      log.recognitionStatus = "confirmed";
    }
    log.localLookupResult = local ? "found" : "not_found";
    log.externalLookupStatus = external.status;
    log.resultSource = local
      ? local.dataSource
      : external.status === "found"
        ? "Authorized external provider"
        : "No matching local record";
    log.confirmedAt = new Date();
    await log.save();
    res.json({
      vehicle,
      localFound: !!local,
      source: log.resultSource,
      external,
      logId: String(log._id),
      registrationNumber: body.registrationNumber,
      message: vehicle
        ? "Record found. Review the data source and authorization status."
        : "No matching local record. This does not establish registration, challan or criminal status.",
    });
  });
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 8 * 1024 * 1024, files: 1, fields: 3 },
    fileFilter(req, file, cb) {
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.mimetype))
        return cb(
          Object.assign(Error("Use JPEG, PNG or WebP."), { status: 400 }),
        );
      cb(null, true);
    },
  });
  app.post(
    "/api/recognize",
    auth,
    aiLimit,
    upload.single("image"),
    async (req, res) => {
      const method = z
        .enum(["image_upload", "mobile_camera", "webcam"])
        .parse(req.body.inputMethod);
      if (!req.file)
        return res.status(400).json({ error: "An image is required." });
      let safe;
      try {
        const p = sharp(req.file.buffer, {
          limitInputPixels: 16000000,
          animated: false,
        });
        const metadata = await p.metadata();
        if (!["jpeg", "png", "webp"].includes(metadata.format))
          throw Error("unsupported");
        safe = await p
          .rotate()
          .resize({
            width: 1600,
            height: 1600,
            fit: "inside",
            withoutEnlargement: true,
          })
          .jpeg({ quality: 90 })
          .toBuffer();
      } catch {
        return res
          .status(400)
          .json({ error: "Invalid image or image exceeds 16 megapixels." });
      }
      const log = new RecognitionLog({
        user: req.user._id,
        inputMethod: method,
        recognitionStatus: "failed",
        expiresAt: expires(),
      });
      try {
        let data;
        if (recognize) data = await recognize(safe);
        else {
          const form = new FormData();
          form.append(
            "image",
            new Blob([safe], { type: "image/jpeg" }),
            "image.jpg",
          );
          const r = await fetch(c.AI_SERVICE_URL + "/recognize", {
            method: "POST",
            headers: { "X-Service-Key": c.AI_SERVICE_KEY },
            body: form,
            signal: AbortSignal.timeout(90000),
          });
          data = await r.json();
          if (!r.ok)
            throw Object.assign(Error("AI service rejected the image."), {
              data,
              status: r.status,
            });
        }
        const candidates = z
          .array(
            z.object({
              registrationNumber: z.string().max(30),
              ocrConfidence: z.number().min(0).max(1).nullable(),
              detectorConfidence: z.number().min(0).max(1),
              validFormat: z.boolean(),
              box: z.array(z.number()).length(4),
            }),
          )
          .max(20)
          .parse(data.candidates);
        log.candidates = candidates;
        const usable = candidates.filter(
          (x) => x.registrationNumber.length > 0,
        );
        if (!usable.length) {
          log.failureCode = data.code || "NO_VALID_PLATE";
          await log.save();
          return res
            .status(422)
            .json({
              error: "No readable plate found. Try a clearer image.",
              code: log.failureCode,
              logId: String(log._id),
              candidates,
              annotatedImage: data.annotatedImage,
            });
        }
        const first = usable[0];
        log.recognitionStatus = "pending_confirmation";
        log.recognizedRegistrationNumber = first.registrationNumber;
        log.confidence = first.ocrConfidence;
        log.detectorConfidence = first.detectorConfidence;
        await log.save();
        res.json({
          recognitionId: String(log._id),
          candidates,
          annotatedImage: data.annotatedImage,
          requiresConfirmation: true,
          message:
            usable.length > 1
              ? "Multiple plates found. Select and confirm the correct vehicle."
              : first.validFormat
                ? "Review or correct the number before lookup."
                : "OCR is uncertain or the format is unsupported. Correct the number before lookup.",
        });
      } catch (e) {
        log.failureCode = "AI_UNAVAILABLE";
        await log.save();
        res
          .status(503)
          .json({
            error:
              "Recognition service unavailable. Check the AI service and model setup; manual lookup is still available.",
            code: "AI_UNAVAILABLE",
            logId: String(log._id),
          });
      }
    },
  );
  app.get("/api/history", auth, async (req, res) => {
    const filter = {
      ...(req.user.role === "admin" ? {} : { user: req.user._id }),
      ...dateFilters(req.query),
    };
    if (req.query.q) {
      const expression = {
        $regex: normalize(z.string().max(30).parse(req.query.q)).replace(
          /[^A-Z0-9]/g,
          "",
        ),
      };
      filter.$or = [
        { registrationNumber: expression },
        { recognizedRegistrationNumber: expression },
        { correctedRegistrationNumber: expression },
      ];
    }
    const logs = await RecognitionLog.find(filter)
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();
    res.json({ logs });
  });
  app.get("/api/admin/stats", auth, admin, async (_, res) => {
    const [
      totalVehicles,
      totalAttempts,
      successfulLocalLookups,
      unmatched,
      recent,
    ] = await Promise.all([
      Vehicle.countDocuments(),
      RecognitionLog.countDocuments(),
      RecognitionLog.countDocuments({ localLookupResult: "found" }),
      RecognitionLog.countDocuments({ localLookupResult: "not_found" }),
      RecognitionLog.find().sort({ createdAt: -1 }).limit(8).lean(),
    ]);
    res.json({
      totalVehicles,
      totalAttempts,
      successfulLocalLookups,
      unmatched,
      recent,
    });
  });
  app.get("/api/admin/vehicles", auth, admin, async (req, res) => {
    const filter = {};
    if (req.query.q)
      filter.registrationNumber = {
        $regex: normalize(z.string().max(30).parse(req.query.q)).replace(
          /[^A-Z0-9]/g,
          "",
        ),
      };
    if (req.query.status)
      filter.authorizationStatus = z
        .enum(["authorised", "unauthorised", "blacklisted"])
        .parse(req.query.status);
    res.json({
      vehicles: await Vehicle.find(filter)
        .sort({ updatedAt: -1 })
        .limit(200)
        .lean(),
    });
  });
  app.post("/api/admin/vehicles", auth, admin, async (req, res) => {
    const d = vehicleInput.parse(req.body);
    res.status(201).json({ vehicle: await Vehicle.create(d) });
  });
  app.put("/api/admin/vehicles/:id", auth, admin, async (req, res) => {
    const id = objectId.parse(req.params.id);
    const d = vehicleInput.parse(req.body);
    const vehicle = await Vehicle.findByIdAndUpdate(
      id,
      { $set: d },
      { new: true, runValidators: true },
    );
    if (!vehicle) return res.status(404).json({ error: "Vehicle not found." });
    res.json({ vehicle });
  });
  app.delete("/api/admin/vehicles/:id", auth, admin, async (req, res) => {
    const id = objectId.parse(req.params.id);
    const v = await Vehicle.findByIdAndDelete(id);
    if (!v) return res.status(404).json({ error: "Vehicle not found." });
    res.json({ ok: true });
  });
  app.use((req, res) => res.status(404).json({ error: "Route not found." }));
  app.use((err, req, res, next) => {
    if (err instanceof ZodError)
      return res
        .status(400)
        .json({ error: err.issues.map((x) => x.message).join(" ") });
    if (err.code === 11000)
      return res
        .status(409)
        .json({
          error: "A record with this email or registration already exists.",
        });
    if (err instanceof multer.MulterError)
      return res
        .status(400)
        .json({
          error:
            err.code === "LIMIT_FILE_SIZE"
              ? "Maximum image size is 8 MB."
              : "Invalid multipart upload.",
        });
    const status = err.status || 500;
    if (status === 500) console.error("API request failed:", err.name);
    res
      .status(status)
      .json({
        error: status >= 500 ? "Request failed. Please retry." : err.message,
      });
  });
  return app;
}
