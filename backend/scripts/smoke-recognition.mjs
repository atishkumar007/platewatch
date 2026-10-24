/** Real HTTP test against your running services. Writes one recognition/history attempt. */
import "dotenv/config";
import { readFile } from "node:fs/promises";
const [imagePath, confirmedNumber] = process.argv.slice(2);
if (!imagePath || !confirmedNumber)
  throw Error(
    "Usage: node scripts/smoke-recognition.mjs IMAGE_PATH CONFIRMED_PLATE. Set ADMIN_EMAIL and ADMIN_PASSWORD in backend/.env.",
  );
const url = process.env.SMOKE_API_URL || "http://127.0.0.1:4000";
const origin = (process.env.CORS_ORIGINS || "http://localhost:5173")
  .split(",")[0]
  .trim();
async function json(r) {
  const d = await r.json();
  if (!r.ok) throw Error(d.error || `HTTP ${r.status}`);
  return d;
}
const auth = await fetch(url + "/api/auth/login", {
  method: "POST",
  headers: { Origin: origin, "Content-Type": "application/json" },
  body: JSON.stringify({
    email: process.env.ADMIN_EMAIL,
    password: process.env.ADMIN_PASSWORD,
  }),
});
await json(auth);
const cookie = auth.headers.getSetCookie()[0].split(";")[0];
const bytes = await readFile(imagePath);
const form = new FormData();
const mime = /\.png$/i.test(imagePath)
  ? "image/png"
  : /\.webp$/i.test(imagePath)
    ? "image/webp"
    : "image/jpeg";
form.append(
  "image",
  new Blob([bytes], { type: mime }),
  "vehicle" + (mime === "image/png" ? ".png" : ".jpg"),
);
form.append("inputMethod", "image_upload");
const recognition = await json(
  await fetch(url + "/api/recognize", {
    method: "POST",
    headers: { Origin: origin, Cookie: cookie },
    body: form,
    signal: AbortSignal.timeout(95000),
  }),
);
console.log(
  "Recognised candidates:",
  recognition.candidates.map((c) => ({
    text: c.registrationNumber,
    validFormat: c.validFormat,
  })),
);
const result = await json(
  await fetch(url + "/api/lookup", {
    method: "POST",
    headers: {
      Origin: origin,
      Cookie: cookie,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      recognitionId: recognition.recognitionId,
      registrationNumber: confirmedNumber,
    }),
  }),
);
console.log("Confirmed lookup:", {
  registrationNumber: result.registrationNumber,
  localFound: result.localFound,
  source: result.source,
  externalStatus: result.external.status,
});
console.log(
  "HTTP workflow completed. A local match depends on your real application registry; no match is an acceptable, truthful result.",
);
