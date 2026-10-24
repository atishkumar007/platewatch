# PlateWatch v2 — AI Number Plate Recognition & Vehicle Authorization

A local full-stack college project using **React + Vite + Tailwind, Express, MongoDB/Mongoose, and a separate FastAPI service with pretrained YOLO + EasyOCR**. No dedicated IoT hardware or paid official API is required for local lookup.

The earlier Flask/SQLite prototype is preserved separately; this version uses the stack requested in your specification. Plate-format checks and the human-confirmation approach were carried forward. The Flask baseline's contour/Tesseract engine is not substituted for YOLO in this version.

## Start here

Follow [docs/setup-guide.md](docs/setup-guide.md) in order. It contains Windows PowerShell commands, MongoDB setup, one-time model downloads, phone access, sample accounts and troubleshooting.

Quick outline (after installing Node.js 22.12+ or 24, Python 3.11/3.12, and MongoDB):

```powershell
npm ci
npm run setup:env
# Edit backend/.env: your MongoDB URI, ADMIN_EMAIL and ADMIN_PASSWORD.
npm run seed
# Set up the Python environment and download models using docs/setup-guide.md.
# Start Python in one terminal, and run this in another:
npm run dev
```

Open **http://localhost:5173**. Only the frontend port needs to be reachable from your phone; Vite proxies `/api` to Express.

## Implemented

- Landing, login, optional public registration, recognition/lookup, result, private history, admin overview, vehicle management, profile and not-found pages.
- Manual registration entry with normalization and supported Indian/BH format screening.
- JPEG/PNG/WebP upload with preview, replace/remove, phone camera photo input, and browser webcam capture/retake/stream cleanup.
- Real plate-specific pretrained YOLO detection, plate crop preprocessing, English EasyOCR and annotated-image responses.
- Multiple candidates, uncertainty messages and mandatory user confirmation/correction before vehicle lookup.
- MongoDB-first vehicle lookup; clear local/demo/external/unmatched source labels.
- Admin-only add/edit/delete and application authorization management; user/admin restrictions enforced server-side.
- Date-filtered recognition history; user histories are private, admins can inspect all retained records.
- JWT in HTTP-only cookies, bcrypt password hashing, origin checks, explicit CORS, rate limits, request validation, safe image re-encoding and service-key authentication.
- Images are processed in memory, not saved. MongoDB history has a configurable TTL; cache storage requires an explicit provider permission.
- Documented optional provider adapter; no government scraper or undocumented external endpoint.
- Fictional seed records, model setup, dataset inspection/evaluation scripts and tests.

## Features requiring external access/equipment

| Capability | Status |
|---|---|
| Local manual lookup, auth, admin and history | Implemented; uses your MongoDB |
| YOLO + EasyOCR image recognition | Implemented; one-time public model download needed |
| Laptop webcam / phone capture | Implemented browser flows; grant permission and test on your devices |
| Actual official vehicle details | Requires an approved provider, actual endpoint documentation, adapter and credentials |
| Actual challan/police checks | Not implemented; not inferred from local authorization |
| Physical gate operation or dedicated IoT camera | Not required or included |

**An authorised vehicle is permitted by your application. It is not certified as crime-free, challan-free or officially registered.** Missing local records are not evidence of wrongdoing.

## Project layout

```text
number-plate-system/
  frontend/                  React pages, camera UI, Tailwind styles
  backend/
    src/models/              User, Vehicle, RecognitionLog, ExternalCache
    src/services/provider.js Approved-provider boundary and permitted cache
    src/app.js               Routes, validation, auth, uploads and lookup
    src/server.js            MongoDB connection and server lifecycle
    scripts/                 Environment generation and fictional seed
    tests/                   Express/MongoDB integration tests
  ai-service/
    app/main.py              FastAPI service-key boundary
    app/pipeline.py          YOLO + EasyOCR + annotation
    download_models.py       Pinned pretrained detector and OCR download
    evaluate.py              Held-out detection/OCR metrics
    tests/                   Service validation/error tests
  dataset/                   Dataset inspector; no automatic authorization
  docs/                      Setup, API, architecture, model/data and testing
```

## Verification

See [docs/testing.md](docs/testing.md) for the actual execution results and device/browser limitations. Tests with injected AI responses are explicitly distinguished from the separate real-model HTTP smoke check. No population accuracy is claimed.

Build frontend: `npm run build`. Run Express/MongoDB tests: `npm test`. Python tests: from `ai-service`, run `.\.venv\Scripts\python.exe -m pytest -q tests`.

This archive contains source and a package lock. Dependencies, database files and model binaries are downloaded separately. No runtime credentials are included.
