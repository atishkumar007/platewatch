# API contract

React calls relative `/api` URLs. Vite proxies them to `http://127.0.0.1:4000`; Express calls the private Python service at `http://127.0.0.1:8000`. Cookie authentication is used for browser APIs. Every mutation must carry an Origin listed in CORS_ORIGINS; Fetch sends it automatically in the browser.

| Method and path | Access | Purpose / payload |
|---|---|---|
| GET `/api/health` | Public | API liveness |
| GET `/api/config` | Public | Public signup setting, provider configured flag, retention disclosure |
| POST `/api/auth/register` | Public if enabled | JSON `{name,email,password}`; creates only user role |
| POST `/api/auth/login` | Public | JSON `{email,password}`; sets HTTP-only JWT cookie |
| GET `/api/auth/me` | Signed in | Current safe user fields |
| POST `/api/auth/logout` | Signed in | Clears cookie |
| POST `/api/recognize` | Signed in | Multipart `image` + `inputMethod`: image_upload, mobile_camera or webcam |
| POST `/api/lookup` | Signed in | JSON `{registrationNumber}` for manual; add `recognitionId` to confirm an image attempt |
| GET `/api/history` | Signed in | Own records for users; all for admin; optional q/from/to |
| GET `/api/admin/stats` | Admin | Vehicle/attempt/local-match/unmatched counts and recent activity |
| GET `/api/admin/vehicles` | Admin | Optional q/status search/filter |
| POST `/api/admin/vehicles` | Admin | Vehicle input JSON |
| PUT `/api/admin/vehicles/:id` | Admin | Full editable vehicle input JSON |
| DELETE `/api/admin/vehicles/:id` | Admin | Remove local vehicle |

Vehicle input: registrationNumber, make, model, vehicleClass, fuelType, registrationStatus, registrationSource, authorizationStatus, ownerLabel. Missing optional text fields remain blank. Registration status is unknown/active/expired/suspended as a **source claim**; it is not automatically verified. Application status is authorised/unauthorised/blacklisted. Client attempts to set dataSource, isDemo or role are ignored by the validation schema.

## Recognition response

```json
{
  "recognitionId": "MongoDB record ID",
  "requiresConfirmation": true,
  "message": "Review or correct the number before lookup.",
  "candidates": [{
    "registrationNumber": "OCR text",
    "ocrConfidence": 0.6,
    "detectorConfidence": 0.8,
    "validFormat": false,
    "box": [100, 80, 320, 140]
  }],
  "annotatedImage": "data:image/jpeg;base64,..."
}
```

The scores above illustrate the shape only, not a benchmark or default reading. A nonempty uncertain reading can be reviewed/corrected. Empty/no-plate recognition returns 422 with a clear error/code, and the failed attempt is retained without an image. Service/model failure returns 503 and manual lookup remains usable.

Confirmation accepts only a supported registration format. A pending attempt belongs to its originating user and can be confirmed once. Original OCR and corrected text are kept separately.

## Lookup response

Contains registrationNumber, vehicle (object or null), localFound, source, external, logId and message. For an absent local vehicle with no provider configured, source is `No matching local record`, vehicle is null and external.status is `unavailable`. Local matches skip external lookup. Missing external fields are not invented. External results do not automatically grant local authorization.

## Python service

- GET `/health`: liveness and whether the configured detector file exists.
- POST `/recognize`: multipart image; `X-Service-Key` header required.
- Returns candidates, code and annotatedImage. Keys never go into the frontend.

## Error handling

Errors use JSON `{error: "helpful message"}` in Express. Typical statuses: 400 invalid input/image, 401 sign-in required, 403 role/origin denial, 404 absent resource, 409 duplicate/already-confirmed record, 422 no readable plate, 429 rate limit, 503 recognition service unavailable. Passwords, image bytes, registration queries and API keys are not written to application error logs.
