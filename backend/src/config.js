import "dotenv/config";
import { z } from "zod";
export function config(env = process.env) {
  const c = z
    .object({
      NODE_ENV: z.string().default("development"),
      PORT: z.coerce.number().default(4000),
      MONGODB_URI: z.string().min(1),
      JWT_SECRET: z
        .string()
        .min(32)
        .refine(
          (s) => !s.startsWith("REPLACE_"),
          "Generate a real JWT_SECRET.",
        ),
      AI_SERVICE_KEY: z
        .string()
        .min(24)
        .refine(
          (s) => !s.startsWith("REPLACE_"),
          "Generate a real AI_SERVICE_KEY.",
        ),
      AI_SERVICE_URL: z.url().default("http://127.0.0.1:8000"),
      CORS_ORIGINS: z
        .string()
        .default("http://localhost:5173,http://127.0.0.1:5173"),
      ALLOW_PUBLIC_REGISTRATION: z.enum(["true", "false"]).default("true"),
      LOG_RETENTION_DAYS: z.coerce.number().int().min(1).max(365).default(30),
      PROVIDER_ENABLED: z.enum(["true", "false"]).default("false"),
      PROVIDER_ADAPTER_MODULE: z.string().optional(),
      PROVIDER_ID: z.string().optional(),
      PROVIDER_API_KEY: z.string().optional(),
      PROVIDER_DOCUMENTATION_URL: z.string().optional(),
      PROVIDER_APPROVAL_REFERENCE: z.string().optional(),
    })
    .parse(env);
  return {
    ...c,
    origins: c.CORS_ORIGINS.split(",").map((s) => s.trim()),
    production: c.NODE_ENV === "production",
  };
}
