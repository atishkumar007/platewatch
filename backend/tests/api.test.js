import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import request from "supertest";
import bcrypt from "bcryptjs";
import sharp from "sharp";
import { createApp } from "../src/app.js";
import {
  User,
  Vehicle,
  RecognitionLog,
  ExternalCache,
} from "../src/models/index.js";
import { createProvider } from "../src/services/provider.js";
const origin = "http://localhost:5173";
const c = {
  origins: [origin],
  JWT_SECRET: "test-only-secret-with-more-than-32-characters",
  AI_SERVICE_KEY: "test-ai-key-with-at-least-24-characters",
  AI_SERVICE_URL: "http://127.0.0.1:1",
  LOG_RETENTION_DAYS: 30,
  ALLOW_PUBLIC_REGISTRATION: "true",
  PROVIDER_ENABLED: "false",
  production: false,
};
let mongo, app, image, testDirectory;
let mode = "success";
const candidate = (registrationNumber = "PB10AB1234") => ({
  registrationNumber,
  ocrConfidence: 0.91,
  detectorConfidence: 0.95,
  validFormat: true,
  box: [1, 1, 100, 40],
});
before(async () => {
  if (process.env.TEST_MONGODB_URI) {
    await mongoose.connect(process.env.TEST_MONGODB_URI);
    if (!/(?:^|[_-])test$/i.test(mongoose.connection.name))
      throw Error(
        "TEST_MONGODB_URI must use a disposable database name ending in _test.",
      );
  } else {
    testDirectory = await mkdtemp(path.join(process.cwd(), "mongo-test-"));
    mongo = await MongoMemoryServer.create({
      binary: { version: "8.0.15" },
      instance: {
        dbPath: testDirectory,
        args: [
          ...(process.platform === "win32" ? [] : ["--nounixsocket"]),
          "--setParameter",
          "diagnosticDataCollectionEnabled=false",
        ],
      },
    });
    await mongoose.connect(mongo.getUri());
  }
  await Promise.all([
    User.init(),
    Vehicle.init(),
    RecognitionLog.init(),
    ExternalCache.init(),
  ]);
  image = await sharp({
    create: { width: 200, height: 100, channels: 3, background: "#ffffff" },
  })
    .png()
    .toBuffer();
  app = createApp(c, {
    recognize: async () => {
      if (mode === "offline") throw Error("offline");
      return {
        candidates:
          mode === "none"
            ? []
            : mode === "uncertain"
              ? [{ ...candidate("KLO1CA2555"), validFormat: false }]
              : mode === "multiple"
                ? [candidate(), candidate("DL01CA5678")]
                : [candidate()],
        annotatedImage: null,
        code: mode === "none" ? "NO_PLATE" : "OK",
      };
    },
  });
});
after(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
  if (testDirectory) await rm(testDirectory, { recursive: true, force: true });
});
beforeEach(async () => {
  mode = "success";
  await Promise.all([
    User.deleteMany(),
    Vehicle.deleteMany(),
    RecognitionLog.deleteMany(),
    ExternalCache.deleteMany(),
  ]);
});
async function account(role = "user") {
  const email = role + "@example.test";
  await User.create({
    name: role,
    email,
    passwordHash: await bcrypt.hash("test-password-123", 4),
    role,
  });
  const agent = request.agent(app);
  const r = await agent
    .post("/api/auth/login")
    .set("Origin", origin)
    .send({ email, password: "test-password-123" });
  assert.equal(r.status, 200);
  return agent;
}
const reg = {
  registrationNumber: "PB10AB1234",
  make: "Fictional Motors",
  model: "Demo Car",
  authorizationStatus: "authorised",
};

test("normalises manual entry, finds a genuine local MongoDB record and logs source", async () => {
  const a = await account();
  await Vehicle.create(reg);
  const r = await a
    .post("/api/lookup")
    .set("Origin", origin)
    .send({ registrationNumber: "pb-10 ab1234" });
  assert.equal(r.status, 200);
  assert.equal(r.body.vehicle.make, "Fictional Motors");
  assert.equal(r.body.external.status, "not_attempted");
  assert.equal(r.body.localFound, true);
  assert.equal(
    await RecognitionLog.countDocuments({ localLookupResult: "found" }),
    1,
  );
});
test("unknown registration has unavailable official fallback, not invented data", async () => {
  const a = await account();
  const r = await a
    .post("/api/lookup")
    .set("Origin", origin)
    .send({ registrationNumber: "DL01CA5678" });
  assert.equal(r.status, 200);
  assert.equal(r.body.vehicle, null);
  assert.equal(r.body.external.status, "unavailable");
  assert.equal(r.body.source, "No matching local record");
});
test("invalid and injection-shaped registrations fail validation", async () => {
  const a = await account();
  for (const registrationNumber of ["INVALID", { $ne: null }]) {
    const r = await a
      .post("/api/lookup")
      .set("Origin", origin)
      .send({ registrationNumber });
    assert.equal(r.status, 400);
  }
});
test("JWT and server-side admin protection; public signup cannot elevate role", async () => {
  assert.equal((await request(app).get("/api/admin/vehicles")).status, 401);
  const a = await account();
  assert.equal(
    (await a.post("/api/admin/vehicles").set("Origin", origin).send(reg))
      .status,
    403,
  );
  const r = await request(app)
    .post("/api/auth/register")
    .set("Origin", origin)
    .send({
      name: "Example User",
      email: "new@example.test",
      password: "test-password-123",
      role: "admin",
    });
  assert.equal(r.status, 201);
  assert.equal(r.body.user.role, "user");
  assert.equal(await Vehicle.countDocuments(), 0);
});
test("admin CRUD, indexes, filtering and local status management", async () => {
  const a = await account("admin");
  let r = await a.post("/api/admin/vehicles").set("Origin", origin).send(reg);
  assert.equal(r.status, 201);
  const id = r.body.vehicle._id;
  assert.equal(
    (await a.post("/api/admin/vehicles").set("Origin", origin).send(reg))
      .status,
    409,
  );
  r = await a
    .put("/api/admin/vehicles/" + id)
    .set("Origin", origin)
    .send({ ...reg, authorizationStatus: "blacklisted" });
  assert.equal(r.body.vehicle.authorizationStatus, "blacklisted");
  assert.equal(
    (await a.get("/api/admin/vehicles?q=PB&status=blacklisted")).body.vehicles
      .length,
    1,
  );
  assert.equal(
    (await a.delete("/api/admin/vehicles/" + id).set("Origin", origin)).status,
    200,
  );
  assert.equal(await Vehicle.countDocuments(), 0);
});
test("multiple detections require confirmation; corrected plate goes through same lookup", async () => {
  const a = await account();
  mode = "multiple";
  let r = await a
    .post("/api/recognize")
    .set("Origin", origin)
    .field("inputMethod", "webcam")
    .attach("image", image, { filename: "car.png", contentType: "image/png" });
  assert.equal(r.status, 200);
  assert.equal(r.body.candidates.length, 2);
  assert.equal(r.body.requiresConfirmation, true);
  const id = r.body.recognitionId;
  assert.equal(
    (await RecognitionLog.findById(id)).localLookupResult,
    "not_attempted",
  );
  await Vehicle.create({ ...reg, registrationNumber: "DL01CA5678" });
  r = await a
    .post("/api/lookup")
    .set("Origin", origin)
    .send({ recognitionId: id, registrationNumber: "DL01CA5678" });
  assert.equal(r.body.localFound, true);
  const l = await RecognitionLog.findById(id);
  assert.equal(l.recognizedRegistrationNumber, "PB10AB1234");
  assert.equal(l.correctedRegistrationNumber, "DL01CA5678");
  assert.equal(l.recognitionStatus, "confirmed");
  assert.equal(
    (
      await a
        .post("/api/lookup")
        .set("Origin", origin)
        .send({ recognitionId: id, registrationNumber: "PB10AB1234" })
    ).status,
    409,
  );
});
test("no plate and unavailable AI are logged without fake recognition", async () => {
  const a = await account();
  for (const [m, status] of [
    ["none", 422],
    ["offline", 503],
  ]) {
    mode = m;
    const r = await a
      .post("/api/recognize")
      .set("Origin", origin)
      .field("inputMethod", "mobile_camera")
      .attach("image", image, {
        filename: "car.png",
        contentType: "image/png",
      });
    assert.equal(r.status, status);
  }
  assert.equal(
    await RecognitionLog.countDocuments({ recognitionStatus: "failed" }),
    2,
  );
});
test("rejects disguised image uploads and cross-origin mutations", async () => {
  const a = await account();
  const r = await a
    .post("/api/recognize")
    .set("Origin", origin)
    .field("inputMethod", "image_upload")
    .attach("image", Buffer.from("not an image"), {
      filename: "fake.png",
      contentType: "image/png",
    });
  assert.equal(r.status, 400);
  assert.equal(
    (
      await a
        .post("/api/lookup")
        .set("Origin", "http://untrusted.test")
        .send({ registrationNumber: "PB10AB1234" })
    ).status,
    403,
  );
});
test("history is private and supports date filters; logout invalidates browser cookie", async () => {
  const a = await account();
  await a
    .post("/api/lookup")
    .set("Origin", origin)
    .send({ registrationNumber: "PB10AB1234" });
  assert.equal((await a.get("/api/history")).body.logs.length, 1);
  assert.equal(
    (await a.get("/api/history?from=2000-01-01&to=2000-01-02")).body.logs
      .length,
    0,
  );
  assert.equal((await a.get("/api/history?from=bad")).status, 400);
  await a.post("/api/auth/logout").set("Origin", origin);
  assert.equal((await a.get("/api/history")).status, 401);
});
test("configured provider minimises fields and does not cache without permission", async () => {
  const configured = {
    ...c,
    PROVIDER_ENABLED: "true",
    PROVIDER_ADAPTER_MODULE: "test",
    PROVIDER_ID: "test-provider",
    PROVIDER_API_KEY: "test-key",
    PROVIDER_DOCUMENTATION_URL: "https://example.test/docs",
    PROVIDER_APPROVAL_REFERENCE: "test-only",
  };
  const provider = createProvider(configured, {
    lookup: async () => ({
      status: "found",
      vehicle: {
        registrationNumber: "PB10AB1234",
        make: "Provider example",
        ownerPhone: "must-not-leak",
      },
      cacheAllowed: false,
    }),
  });
  const d = await provider.lookup("PB10AB1234");
  assert.equal(d.status, "found");
  assert.equal(d.vehicle.ownerPhone, undefined);
  assert.equal(await ExternalCache.countDocuments(), 0);
});
test("approved cache obeys response permission and handles provider errors", async () => {
  const configured = {
    ...c,
    PROVIDER_ENABLED: "true",
    PROVIDER_ADAPTER_MODULE: "test",
    PROVIDER_ID: "test-provider",
    PROVIDER_API_KEY: "test-key",
    PROVIDER_DOCUMENTATION_URL: "https://example.test/docs",
    PROVIDER_APPROVAL_REFERENCE: "test-only",
  };
  const p = createProvider(configured, {
    lookup: async () => ({
      status: "found",
      vehicle: { registrationNumber: "PB10AB1234" },
      cacheAllowed: true,
      cacheTtlSeconds: 60,
    }),
  });
  assert.equal((await p.lookup("PB10AB1234")).cached, false);
  assert.equal((await p.lookup("PB10AB1234")).cached, true);
  const bad = createProvider(configured, {
    lookup: async () => {
      throw Error("unavailable");
    },
  });
  assert.equal((await bad.lookup("DL01CA5678")).status, "error");
});

test("uncertain OCR stays editable and cannot bypass registration validation", async () => {
  const a = await account();
  mode = "uncertain";
  const r = await a
    .post("/api/recognize")
    .set("Origin", origin)
    .field("inputMethod", "image_upload")
    .attach("image", image, { filename: "car.png", contentType: "image/png" });
  assert.equal(r.status, 200);
  assert.equal(r.body.candidates[0].validFormat, false);
  assert.equal(r.body.requiresConfirmation, true);
  const confirmed = await a
    .post("/api/lookup")
    .set("Origin", origin)
    .send({
      recognitionId: r.body.recognitionId,
      registrationNumber: "KLO1CA2555",
    });
  assert.equal(confirmed.status, 400);
  assert.equal(
    (await RecognitionLog.findById(r.body.recognitionId)).localLookupResult,
    "not_attempted",
  );
});
