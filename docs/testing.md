# Validation and test procedure

## Actual verification — 24 October 2026

| Check | Result |
|---|---|
| React/Vite production build | Passed |
| Express + real temporary MongoDB integration suite | 12 tests passed |
| FastAPI/Python validation and error suite | 6 tests passed |
| Python source compilation | Passed |
| Environment generation and fictional seed | Matching keys, overwrite refusal and idempotent seed verified |
| Dataset inspector | Validated against three actual image/XML pairs from the inspected archive |
| Real pretrained detector + EasyOCR | Downloaded, loaded and exercised on public dataset images |
| Actual Express → FastAPI → YOLO/EasyOCR → corrected MongoDB lookup | Passed HTTP smoke test |
| Physical laptop webcam and phone camera permission/capture | Not tested in this environment |
| Browser-rendered layout and interactive route navigation | Unverified: managed preview did not start successfully |
| Actual approved government/provider lookup | Not tested; no credentials/documented adapter supplied |
| Independent real-world recognition accuracy | Not established |

The full-stack HTTP smoke test used a public dataset image and a real temporary MongoDB record. YOLO detected its plate; EasyOCR returned `KLO1CA2555`, misreading the zero after KL as the letter O. The confirmation request corrected it to `KL01CA2555`, and MongoDB lookup/history completed. This validates the real model/service path and the correction feature; it is not proof of exact OCR accuracy or an official record. That test record/database is not distributed.

Three real dataset images were also exercised directly through the model. Detection returned boxes, while OCR strings needed review or did not meet the supported format. A plain synthetic plate image returned no plate. These small checks are not a representative benchmark, and no percentage accuracy is claimed.

The first temporary MongoDB startup failed under the environment's default temporary path. Tests were rerun with an isolated workspace data directory and completed successfully. The test database is removed after the suite. Nothing in the production app was replaced with a mock database.

The service tests deliberately inject a stub pipeline to test validation/error handling without downloading models; the Express integration tests inject AI/provider responses to exercise routing and edge cases. These are complemented by the separate real-model HTTP smoke described above. Stub outputs do not run in the shipped production server.

## Run the automated tests

From project root:

```powershell
npm ci
npm test
npm run build
```

From ai-service:

```powershell
.\.venv\Scripts\python.exe -m pytest -q tests
```

The Node suite covers known/unknown registrations, normalization, invalid/injection-shaped input, JWT access, signup role protection, administrator CRUD/unique index/search, multiple plate candidates, confirmation/correction, OCR uncertainty, no plate, AI outage, invalid files, cross-origin denial, user history/date filters, logout and provider fallback/cache policies.

MongoDB's test binary downloads on first run. If you explicitly configure TEST_MONGODB_URI, the database name must end in `_test`, such as `platewatch_test`. It must be disposable: test collections are cleared. Never point it at your project data.

The Python suite covers supported formats, invalid bytes, pixel limits, service-key and MIME checks, no-plate response handling and missing model failure.

## Repeat a real-image HTTP smoke test

Start your own MongoDB, seeded backend and configured AI service. From backend:

```powershell
node scripts/smoke-recognition.mjs C:\path\to\vehicle.jpg PB10AB1234
```

Supply the actual confirmed registration shown in your chosen image, not the example above. The script uses your backend/.env ADMIN_EMAIL/ADMIN_PASSWORD for a local login and writes one recognition/history attempt. It does not modify vehicle records. A matching local result requires you to have added that vehicle separately. Do not use it as a bulk official lookup tool.

## Manual browser acceptance checklist

| Action | Expected result |
|---|---|
| Open / and sign in | Landing/auth pages load; account enters lookup workspace |
| Register a user (if enabled) | User role only; admin pages denied |
| Enter `pb-10 ab1234` after seed | Fictional authorised local record appears with source label |
| Enter `INVALID` | Validation error; no invented details |
| Enter an unknown valid plate | No local match; explicit official-unavailable fallback |
| Upload a clear vehicle photo | Image preview; real recognition attempt; candidates or a clear no-plate/error state |
| Upload non-image bytes named .png | Rejected by backend byte validation |
| Upload >8 MB or >16 MP | Rejected with a helpful message |
| Show multiple plates | Candidate list; select the intended plate and confirm |
| Correct O/0 or I/1 | Confirmed number controls lookup; original/corrected readings are separately logged |
| Use laptop webcam | Permission prompt, preview, capture, retake; camera stops on closure/navigation |
| Capture on phone over Wi-Fi | Camera/picker opens where supported; preview/replace and same recognition flow |
| Open history | Users see own attempts; admin can see all; date/search/inspect work |
| Add/edit/delete a vehicle as admin | MongoDB registry updates; delete requires browser confirmation |
| Stop AI service | Image recognition errors gracefully; manual lookup still works |
| No external provider configured | Local lookup succeeds; absent local record returns official unavailable |
| Sign out | Protected routes require sign-in again |

## Accuracy evaluation

Use dataset/inspect_dataset.py and ai-service/evaluate.py as described in model-and-data.md. Keep held-out images separate from tuning/training, manually verify OCR labels, and report day/night/angle subsets and hardware. Detection precision/recall, exact-plate accuracy, CER and latency are different metrics. Evaluate OCR before human corrections. Do not copy a model author's published metrics into your own results table.

## Known limits

Windows installation, camera drivers and device-specific browser behavior require local checks. The source compiles/builds, and server/AI/database paths were tested, but that does not replace physical device or visual QA. Browser preview failed in the managed preview infrastructure (workspace dependency resolution/required service configuration), so no screenshot-based layout verification is claimed.

The app is a single-machine academic deployment. History cleanup is asynchronous via MongoDB TTL. No raw images are retained as records; framework multipart processing may use temporary spooled files, which are closed after each request. No ongoing traffic tracking, physical gate actuation or government/challan/police data feed is included.
