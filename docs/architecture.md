# Architecture and college viva explanation

## What the project solves

PlateWatch reduces manual plate entry and connects the reading to an institution's vehicle registry. It provides application-level authorization and a source-labelled audit trail, using cameras already available on phones/laptops.

## Components

| Component | Responsibility |
|---|---|
| React/Vite/Tailwind | Input, browser camera, previews, OCR review, result/history/admin pages |
| Express/Node.js | Authentication, role checks, image validation, calls to AI, MongoDB lookup, optional provider boundary |
| FastAPI/Python | Decode image, YOLO plate detection, crop/preprocess, EasyOCR, annotated response |
| MongoDB/Mongoose | Users, local vehicles, recognition attempts, explicitly permitted external cache |

Browser -> Express -> FastAPI -> Express -> MongoDB -> browser.

For manual lookup, the FastAPI stage is skipped. Image recognition itself creates a pending attempt; **confirmation is a separate request**. Only the corrected/confirmed registration enters the lookup workflow. If a local record is present, no external lookup runs. If absent, the provider adapter is used only when approved configuration is complete; otherwise a clear unavailable status and manual official link are returned.

## AI pipeline

The selected pretrained single-class YOLO detector identifies plate bounding boxes. The image is capped at 1600 pixels on its longest side; inference uses 640 input. Plate regions are cropped with a small margin. Grayscale resizing and contrast enhancement help OCR. EasyOCR reads English/alphanumeric text. Separate country labels such as IND are omitted; text fragments are arranged by row and left-to-right order. Strings are normalized, screened against supported formats and returned with separate detector/OCR scores. All readings remain subject to human confirmation.

A format match is syntactic plausibility only. Character ambiguity and unsupported formats can cause errors. The system never silently converts uncertain O/0 or I/1 characters into a claimed identity. Uncertain text can be corrected, multiple candidates can be selected, and empty/unreadable results fail clearly.

## Authentication and access

The backend signs an eight-hour JWT in an HTTP-only, SameSite=Strict cookie. Browser JavaScript does not receive the JWT. Passwords use bcrypt. Every protected request verifies the JWT and fetches the current user/role from MongoDB. Admin checks occur in Express, not only React. Mutations require an explicitly allowed Origin. Rate limits protect authentication, general APIs and recognition. The AI endpoint has a separate shared service key and binds to loopback in the documented setup.

No raw SQL or string-composed database queries are used. Zod constrains request data; Mongoose applies schema validation and a unique registration index. The server inspects image bytes with Sharp, limits pixels and size, strips metadata by re-encoding to JPEG and sends the resulting bytes to Python.

## Data and retention

Users contain name, email, password hash and role. Vehicles contain application-managed details with a separate registration-status/source and authorization status. RecognitionLog stores method, original/corrected registration, scores, candidate metadata, lookup status/source and timestamps. Images and annotations are returned in memory and are not permanently stored by this app. History expiry defaults to 30 days and uses MongoDB TTL; expiration cleanup is asynchronous rather than instantaneous. Existing records retain their original scheduled expiry if you change the setting.

Users see their own logs; admins see all retained logs. Admin counts are counts of retained attempts/records, not lifetime traffic metrics. Logout clears the browser cookie; a copied JWT remains valid until expiry or account removal, so do not share tokens. Production session revocation and distributed rate-limit storage are outside this local deployment.

## Authorization is not official vehicle clearance

`authorised` means allowed in this application, `unauthorised` means not granted access, and `blacklisted` is a local application flag. Registration validity, traffic challans and police records are separate sources. Neither no match nor a blacklist flag establishes criminal activity. The project does not query those databases by default.

## Useful viva answers

- **Why YOLO?** It performs plate localization in a single object-detection pipeline; the chosen weights were trained for plates rather than generic COCO classes.
- **Why OCR separately?** Detection finds the plate region; OCR reads its text. Their scores describe different tasks.
- **Why Python plus Node?** Python hosts the vision libraries; Express manages users, database queries and the application's API.
- **Why manual confirmation?** Real OCR can misread plausible characters. The user confirms the identity before details are associated with it.
- **How is MongoDB different from the dataset?** MongoDB holds application records; dataset images/annotations are for vision testing, not authorization.
- **What if official APIs are unavailable?** Local lookup still works and external status says unavailable. No web scraping is used.
- **Where is the IoT aspect without hardware?** A phone can capture and transmit images over Wi-Fi to the laptop's processing services. No ESP32 is necessary for this networked camera-to-server demonstration.
- **How is accuracy measured?** Held-out box annotations support IoU-based detection precision/recall; manually verified plate strings support exact-plate accuracy and CER. These must be measured for the actual setup.

## Scope limits

This is a local development application, not a high-throughput road-enforcement system. It does not continuously track moving vehicles, control a gate or identify vehicle owners. Trusted HTTPS/reverse proxy, production database security, operational monitoring and load testing would be separate deployment work.
