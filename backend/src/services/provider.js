import { pathToFileURL } from "node:url";
import path from "node:path";
import { z } from "zod";
import { ExternalCache } from "../models/index.js";
const fields = z.object({
  registrationNumber: z.string(),
  make: z.string().max(80).optional(),
  model: z.string().max(80).optional(),
  vehicleClass: z.string().max(80).optional(),
  fuelType: z.string().max(40).optional(),
  registrationStatus: z
    .enum(["unknown", "active", "expired", "suspended"])
    .default("unknown"),
});
export const manualLookupUrl =
  "https://vahan.parivahan.gov.in/nrservices/faces/user/citizen/citizenlogin.xhtml";
export function createProvider(c, adapter = null) {
  const required = [
    "PROVIDER_ADAPTER_MODULE",
    "PROVIDER_ID",
    "PROVIDER_API_KEY",
    "PROVIDER_DOCUMENTATION_URL",
    "PROVIDER_APPROVAL_REFERENCE",
  ];
  const configured =
    c.PROVIDER_ENABLED === "true" && required.every((k) => c[k]);
  let loaded = adapter;
  return {
    configured,
    async lookup(registrationNumber) {
      if (!configured)
        return {
          status: "unavailable",
          message:
            "Official lookup unavailable. No approved provider is configured.",
          manualLookupUrl,
        };
      const cached = await ExternalCache.findOne({
        registrationNumber,
        providerId: c.PROVIDER_ID,
        expiresAt: { $gt: new Date() },
      }).lean();
      if (cached)
        return {
          status: "found",
          vehicle: cached.fields,
          source: "Authorized external provider",
          providerId: c.PROVIDER_ID,
          retrievedAt: cached.retrievedAt,
          cached: true,
        };
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      try {
        if (!loaded)
          loaded = await import(
            pathToFileURL(path.resolve(c.PROVIDER_ADAPTER_MODULE)).href
          );
        const task = loaded.lookup({
          registrationNumber,
          apiKey: c.PROVIDER_API_KEY,
          signal: controller.signal,
        });
        const timeout = new Promise((_, reject) =>
          controller.signal.addEventListener(
            "abort",
            () => reject(new Error("Provider timeout")),
            { once: true },
          ),
        );
        const result = await Promise.race([task, timeout]);
        if (!result || result.status === "not_found")
          return {
            status: "not_found",
            message: "No matching record returned by the configured provider.",
            manualLookupUrl,
          };
        if (result.status !== "found") throw Error("Invalid adapter response");
        const safe = fields.parse(result.vehicle);
        if (safe.registrationNumber !== registrationNumber)
          throw Error("Provider returned a different registration");
        const retrievedAt = new Date();
        // No storage unless this individual response explicitly grants a finite cache duration.
        if (
          result.cacheAllowed === true &&
          Number.isInteger(result.cacheTtlSeconds) &&
          result.cacheTtlSeconds > 0
        ) {
          const ttl = Math.min(result.cacheTtlSeconds, 86400);
          await ExternalCache.findOneAndUpdate(
            { registrationNumber, providerId: c.PROVIDER_ID },
            {
              fields: safe,
              retrievedAt,
              expiresAt: new Date(Date.now() + ttl * 1000),
            },
            { upsert: true },
          );
        }
        return {
          status: "found",
          vehicle: safe,
          source: "Authorized external provider",
          providerId: c.PROVIDER_ID,
          retrievedAt,
          cached: false,
        };
      } catch {
        return {
          status: "error",
          message:
            "Official lookup could not be completed. Local application remains available.",
          manualLookupUrl,
        };
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
