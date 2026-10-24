# Windows PowerShell setup — beginner walkthrough

## 1. Prerequisites

Install:

- Node.js 22.12 or newer (Node 24 is suitable): https://nodejs.org/en/download .
- Python 3.11 or 3.12, 64-bit: https://www.python.org/downloads/ . Enable Python in PATH if offered.
- MongoDB Community locally, or use your own Atlas cluster.

Check `node --version`, `npm --version` and `py --version` in a new PowerShell window. If a command is missing, complete its installation before continuing.

Extract the ZIP into a normal local folder such as `C:\Projects\number-plate-system`. The commands below assume that is the extracted project folder. Do not run them from the old Flask project folder.

## 2. MongoDB: choose local or Atlas

### Local MongoDB

Follow https://www.mongodb.com/docs/manual/tutorial/install-mongodb-on-windows/ . Start the MongoDB service, or start `mongod` with a writable data directory if you installed manually. MongoDB Compass is a GUI, not the database server itself.

For a local unauthenticated development instance listening only on your laptop, the backend URI is:

```text
mongodb://127.0.0.1:27017/platewatch
```

Do not expose an unauthenticated database port to other devices. The phone connects to Vite/Express, not to MongoDB.

### MongoDB Atlas

Follow https://www.mongodb.com/docs/atlas/getting-started/ . Create a database user, allow your development machine's current network address, and copy the Node.js connection URI from your cluster's connection dialog. Replace the password placeholder and choose a database name such as `platewatch`. Encode reserved characters in the password as directed by MongoDB.

Put the URI only in `backend/.env`. Atlas credentials must not appear in frontend code or screenshots.

## 3. Install JavaScript dependencies and create configuration

From the extracted project root:

```powershell
Set-Location C:\Projects\number-plate-system
npm ci
npm run setup:env
```

`setup:env` creates `backend/.env` and `ai-service/.env` with matching random service keys and a random JWT secret. It refuses to overwrite existing environment files. No secrets are printed.

Edit `backend/.env` in your text editor:

```text
MONGODB_URI=mongodb://127.0.0.1:27017/platewatch
ADMIN_EMAIL=your-own-admin-email@example.com
ADMIN_PASSWORD=your-own-long-password-at-least-12-characters
```

Keep the generated `JWT_SECRET` and matching `AI_SERVICE_KEY`. Leave `PROVIDER_ENABLED=false`. Set `ALLOW_PUBLIC_REGISTRATION=false` if you do not want users to create their own accounts.

Run the seed script:

```powershell
npm run seed
```

This creates the configured admin and three **fictional demonstration** records. It does not overwrite existing records or reset an existing administrator's password.

| Registration | Fictional vehicle | Application authorization |
|---|---|---|
| PB10AB1234 | Demo Motors Campus One | authorised |
| DL01CA5678 | Example Mobility City Two | unauthorised |
| MH12AB9012 | Fictional Auto Lab Three | blacklisted |

These are synthetic records, not official information about the actual holders of those registration strings. Official registration status remains unknown. Demo labelling is retained if you edit a seeded record.

## 4. Install Python AI dependencies

Open a new PowerShell terminal in `ai-service`:

```powershell
Set-Location C:\Projects\number-plate-system\ai-service
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe download_models.py
```

If you installed Python 3.11, replace `py -3.12` with `py -3.11`. The executable paths avoid PowerShell activation-policy issues; you do not need to activate the venv.

The one-time setup downloads the pinned plate-specific ONNX detector and English EasyOCR model files. Network access to Hugging Face/GitHub is required. This is a pretrained starting model, not a model you need to train. CPU inference is supported; no GPU is required. The first recognition in a process loads the models and can take longer.

The downloaded files belong under `ai-service/models/`, with OCR weights in `models/easyocr/`. Do not confuse the previous project's optional `.pt` model with this version's selected ONNX file.

## 5. Start all three services

**Terminal 1 — Python AI service:**

```powershell
Set-Location C:\Projects\number-plate-system\ai-service
.\.venv\Scripts\python.exe -m uvicorn app.main:app_factory --factory --host 127.0.0.1 --port 8000
```

**Terminal 2 — Express backend:**

```powershell
Set-Location C:\Projects\number-plate-system\backend
npm run dev
```

**Terminal 3 — React frontend:**

```powershell
Set-Location C:\Projects\number-plate-system\frontend
npm run dev
```

Alternatively, keep Terminal 1 running and use `npm run dev` from the project root to start Express and React together. Do not start duplicate copies on the same ports.

Open **http://localhost:5173** and sign in with the admin credentials you chose. AI health: http://127.0.0.1:8000/health . API health: http://127.0.0.1:4000/api/health . A healthy AI HTTP server does not alone prove models are present; inspect `modelPresent` and run an image test.

Keep terminals open. Ctrl+C stops a service. Changing environment configuration requires a service restart.

## 6. Demonstrate the project

1. Sign in as admin. Open Vehicle registry and inspect the three fictional records.
2. Open Recognition & lookup → Enter manually. Search `pb-10 ab1234`. It normalizes to `PB10AB1234` and shows an authorised **demonstration record**.
3. Search `DL01CA5678` and `MH12AB9012` to demonstrate the other authorization statuses.
4. Search `KA01AB9999` without adding it. You should see no local match and official lookup unavailable.
5. Upload a real vehicle photo you are permitted to use. The selected pretrained detector must locate a plate; OCR may be imperfect. Review/correct the number and confirm it before lookup.
6. A detected but uncertain string remains editable. No plate/empty OCR produces a helpful failure, not a fabricated reading.
7. Try Use Webcam, allow permission, capture a frame and repeat recognition/confirmation. Retake/replace or remove a photo as needed.
8. Inspect Recognition history, expand Details and try UTC date filters. History records original OCR, any correction and source.
9. In the registry, add/edit/delete a fictional vehicle. Open Admin overview to see database counts.
10. Create a normal user if public registration is enabled. Confirm this account cannot manage the registry, even if it attempts a protected API route.

Do not use the fictional seed as ground truth for unrelated real images. If you want an end-to-end class demonstration, photograph a deliberately fictional plate on a mock vehicle/sign, label it as synthetic and check that the detector can handle that setup in advance. Plain isolated printed plates can fail a detector trained on vehicles.

## 7. Use your phone on the same Wi-Fi

1. Run `ipconfig` on your laptop and find its Wi-Fi IPv4 address, e.g. `192.168.1.20`.
2. Add the exact phone-facing origin to the backend allowlist:

```text
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,http://192.168.1.20:5173
```

3. Restart Express. Vite already binds to `0.0.0.0`.
4. On your phone, browse to `http://192.168.1.20:5173`. Use the same Wi-Fi and allow the frontend port through your private-network firewall if needed.
5. Choose **Capture with Phone Camera**. Supported browsers open the camera or a photo picker; `capture="environment"` requests the rear camera but the browser decides the final behavior. Preview and retake/replace are available.

The phone sends `/api` calls through Vite's proxy to Express, so do not put `localhost:4000` into frontend environment settings for phone use. On the phone, localhost means the phone itself.

Live `getUserMedia` webcam streaming requires a secure browser context: localhost on the laptop or HTTPS. A plain LAN HTTP page generally cannot use live webcam streaming. The separate photo-capture file input is the intended phone path on LAN HTTP. Browser support varies; if it opens a picker, take a JPEG photo in the camera app and upload it. HEIC is not supported; use a JPEG camera mode or convert locally.

For live phone video, configure trusted HTTPS for your development network separately. This project does not install certificates or publish your laptop to the internet.

## 8. Build, test and stop

From project root:

```powershell
npm test
npm run build
```

From `ai-service`:

```powershell
.\.venv\Scripts\python.exe -m pytest -q tests
```

The Node test suite downloads a temporary MongoDB binary on its first run. It creates an isolated test database, not your configured production/local project database. For restricted environments, `TEST_MONGODB_URI` can point to a **disposable test database**. That test suite deletes records in its test collections; never use your actual project URI for it.

`npm run build` produces `frontend/dist`. For normal demonstrations use the Vite development server with its API proxy. A generic static host does not automatically provide the Express/Python/MongoDB services. A production deployment needs explicit reverse-proxy/TLS configuration, database access and secure cookies.

Stop each running terminal with Ctrl+C.

## 9. Troubleshooting

| Symptom | Check |
|---|---|
| Frontend says API unavailable | MongoDB running, backend/.env exists, secrets generated, Express terminal has no startup error |
| MongoDB connection refused | Check local mongod service and URI; Compass alone is insufficient |
| Atlas selection timeout | Check database user, encoded password and current IP access list |
| Login fails | Use the email/password set before seed; seed does not reset an existing admin |
| Request origin not allowed | Add the exact scheme/host/port to CORS_ORIGINS and restart Express |
| AI service returns 503 | Run download_models.py, check model path and matching service keys, inspect the AI terminal |
| First scan seems slow | Model initialization is cold on first request; wait, then retry a clear image |
| OCR misreads O/0 or I/1 | Correct the displayed string manually before lookup; never assume score proves correctness |
| No plate detected | Improve framing/lighting; use a real vehicle view rather than only a tiny or isolated plate |
| Phone cannot open the site | Same Wi-Fi, correct laptop IP, private firewall rule, no router client isolation |
| Phone live webcam fails on HTTP | Use Capture with Phone Camera/photo upload, or configure trusted HTTPS |
| Phone photo rejected | Use JPEG/PNG/WebP, under 8 MB and 16 megapixels; HEIC is not supported |
| Image recognition works but no vehicle details | Add a local record through admin; photos/datasets do not create authorised records |
| Official lookup unavailable | Expected until an approved adapter and credentials exist; local functionality still works |

See docs/external-provider.md for legitimate access routes and the adapter boundary. No claim of crime/challan clearance is made.
