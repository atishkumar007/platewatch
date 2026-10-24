import { z } from "zod";
export const normalize = (value) =>
  String(value ?? "")
    .toUpperCase()
    .replace(/[\s-]/g, "");
export const plate = z
  .string()
  .max(30)
  .transform(normalize)
  .pipe(
    z
      .string()
      .regex(
        /^(?:[A-Z]{2}\d{1,2}[A-Z]{1,3}\d{4}|\d{2}BH\d{4}[A-Z]{1,2})$/,
        "Use a supported Indian registration format, e.g. PB10AB1234.",
      ),
  );
export const vehicleInput = z.object({
  registrationNumber: plate,
  make: z.string().max(80).default(""),
  model: z.string().max(80).default(""),
  vehicleClass: z.string().max(80).default(""),
  fuelType: z.string().max(40).default(""),
  registrationStatus: z
    .enum(["unknown", "active", "expired", "suspended"])
    .default("unknown"),
  registrationSource: z.string().max(200).default("Unverified local entry"),
  authorizationStatus: z
    .enum(["authorised", "unauthorised", "blacklisted"])
    .default("unauthorised"),
  ownerLabel: z.string().max(80).default(""),
});
export const registerInput = z.object({
  name: z.string().trim().min(2).max(80),
  email: z
    .email()
    .max(254)
    .transform((s) => s.toLowerCase()),
  password: z.string().min(12).max(128),
});
export const loginInput = z.object({
  email: z
    .email()
    .max(254)
    .transform((s) => s.toLowerCase()),
  password: z.string().min(1).max(128),
});
export function dateFilters(query) {
  const out = {};
  for (const [q, op] of [
    ["from", "$gte"],
    ["to", "$lte"],
  ]) {
    if (query[q]) {
      const d = z.iso.date().parse(query[q]);
      out[op] = new Date(
        d + (q === "to" ? "T23:59:59.999Z" : "T00:00:00.000Z"),
      );
    }
  }
  if (out.$gte && out.$lte && out.$gte > out.$lte)
    throw Object.assign(Error("From date must be before to date."), {
      status: 400,
    });
  return Object.keys(out).length ? { createdAt: out } : {};
}
export const objectId = z
  .string()
  .regex(/^[a-f0-9]{24}$/i, "Invalid record ID.");
