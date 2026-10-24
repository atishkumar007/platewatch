# Optional authorised vehicle-data provider

## Verified access routes (24 October 2026)

API Setu's official documentation describes consumer registration, subscription and publisher approval. Its transport directory lists Ministry of Road Transport and Highways document collections, including vehicle registration and challan documents. These listings do not establish unrestricted anonymous lookup by plate; particular APIs may involve consent, eligibility and a specific approved use case.

Sources:

- API Setu consumer flow and approval: https://docs.apisetu.gov.in/document-central/explore-apisetu/Overview.html
- Transport collection: https://directory.apisetu.gov.in/api-collection/transport
- API Setu partner portal: https://partners.apisetu.gov.in/
- Official manual vehicle lookup: https://vahan.parivahan.gov.in/nrservices/faces/user/citizen/citizenlogin.xhtml
- Parivahan overview: https://parivahan.gov.in/parivahan/en/content/license-registration-details

No approved credentials or provider-specific request/response documentation were supplied for this project. Consequently **no official network endpoint is guessed or called**. The local application is fully usable without those credentials. Follow the provider's onboarding process, submit the actual college/use-case details, and implement only the access granted by that provider.

## Adapter design

`backend/src/services/provider.js` is a working boundary with a disabled/unavailable fallback, timeout, field minimization and opt-in cache. It does not treat a public website as an API and does not scrape or bypass login/CAPTCHA.

After actual approval, implement a separate local JavaScript ES module against the provider's real documentation. It must export:

```javascript
export async function lookup({ registrationNumber, apiKey, signal }) {
  // Your approved, documented provider request goes in YOUR adapter.
  // Return one of the contract objects described below.
}
```

This is the contract for a future provider-specific module, not a preconfigured official integration. The project intentionally contains no speculative HTTP request implementation.

Contract return forms:

- `{status: 'not_found'}` when the provider explicitly reports no match.
- `{status: 'found', vehicle: {registrationNumber, make?, model?, vehicleClass?, fuelType?, registrationStatus?}, cacheAllowed: false}` for a result without caching permission.
- The same found result with `cacheAllowed: true, cacheTtlSeconds: N` only when that response/data may actually be cached for that duration under provider terms.
- Throw on network/API/authorization errors; the boundary translates failures to a clear unavailable/error result.

The AbortSignal must be passed to the actual network request. Return only fields that the application needs. Never include owner addresses, identity documents, phone numbers or credentials. The core schema strips unrequested fields and rejects a result for another registration. Registration status must use unknown/active/expired/suspended, or default unknown if the provider's documented status cannot be mapped reliably.

Configure in backend/.env only:

```text
PROVIDER_ENABLED=true
PROVIDER_ADAPTER_MODULE=C:/absolute/path/to/your-approved-adapter.mjs
PROVIDER_ID=your-approved-provider-id
PROVIDER_API_KEY=your-real-secret
PROVIDER_DOCUMENTATION_URL=https://the-providers-real-documentation
PROVIDER_APPROVAL_REFERENCE=your-actual-approval-reference
```

All fields must be present before the module is considered configured. A configured flag does not prove credentials are still valid; runtime errors remain visible. There is no frontend change required.

## Cache policy

The application does not cache unless the adapter explicitly grants permission with a positive integer TTL. Stored fields are minimized and the TTL is capped at one day or the shorter approved duration. MongoDB TTL indexes remove expired records asynchronously; queries exclude expired records immediately. If a provider requires a shorter hard deletion deadline than a background TTL can guarantee, disable caching and use a provider-compliant deletion mechanism before enabling it.

If provider caching permission is revoked, remove that provider's existing cache through your own database administration process before continuing to use it. Do not configure an adapter to grant caching permission by default without checking the actual terms.

## Scope

No real challan count, police flag, owner identity or crime clearance is supplied by this adapter boundary. A registration record is not proof of any of those statuses. Add separate documented sources and appropriately labelled fields only if legitimate access is actually granted.
