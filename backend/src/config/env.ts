import { config as loadEnv } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

import { roleValues } from "../domain/enums.js";

const currentFilePath = fileURLToPath(import.meta.url);
const currentDirectory = dirname(currentFilePath);
const backendRoot = resolve(currentDirectory, "..", "..");
const shouldLoadLocalEnv = process.env.NODE_ENV !== "test" || process.env.BHAARATENGAGE_LOAD_LOCAL_ENV === "true";

loadEnv({ path: resolve(backendRoot, ".env") });

if (shouldLoadLocalEnv) {
  loadEnv({ path: resolve(backendRoot, ".env.local"), override: true });
}

const emptyStringToUndefined = (value: unknown) => {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
};

const optionalString = z.preprocess(emptyStringToUndefined, z.string().min(1).optional());
const optionalUrl = z.preprocess(emptyStringToUndefined, z.string().url().optional());

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  FRONTEND_ORIGIN: z.string().url().default("http://localhost:8080"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  BACKEND_DATA_SOURCE: z.enum(["auto", "memory", "supabase"]).default("auto"),
  API_AUTH_MODE: z.preprocess(emptyStringToUndefined, z.enum(["disabled", "supabase"]).optional()),
  API_AUTH_DEV_USER_ID: optionalString,
  API_AUTH_DEV_ORGANIZATION_ID: optionalString,
  API_AUTH_DEV_ROLE: z.enum(roleValues).default("workspace_admin"),
  DEFAULT_ORGANIZATION_ID: optionalString,
  DEFAULT_ORGANIZATION_SLUG: optionalString,
  SUPABASE_URL: optionalUrl,
  SUPABASE_SERVICE_ROLE_KEY: optionalString,
  REDIS_URL: optionalUrl,
  WORKER_QUEUE_PREFIX: optionalString,
  WORKER_CONCURRENCY: z.preprocess(emptyStringToUndefined, z.coerce.number().int().positive().optional()),
  WORKER_SCHEDULER_INTERVAL_MS: z.preprocess(emptyStringToUndefined, z.coerce.number().int().positive().optional()),
  PUBLIC_BASE_URL: optionalUrl,
  PLIVO_AUTH_ID: optionalString,
  PLIVO_AUTH_TOKEN: optionalString,
  PLIVO_PHONE_NUMBER: optionalString,
  PLIVO_VALIDATE_SIGNATURES: z.preprocess(emptyStringToUndefined, z.coerce.boolean().optional()),
  SARVAM_API_KEY: optionalString,
  OPENAI_API_KEY: optionalString,
  OPENAI_VOICE_EXTRACTION_MODEL: optionalString,
  SENSITIVE_DATA_ENCRYPTION_KEY: optionalString,
});

const parsedEnv = envSchema.parse(process.env);

function resolveSensitiveDataEncryptionKey() {
  if (parsedEnv.SENSITIVE_DATA_ENCRYPTION_KEY) {
    return parsedEnv.SENSITIVE_DATA_ENCRYPTION_KEY;
  }

  if (parsedEnv.NODE_ENV === "production") {
    throw new Error("SENSITIVE_DATA_ENCRYPTION_KEY must be configured in production.");
  }

  return "development-only-sensitive-data-key-change-me";
}

export const env = {
  ...parsedEnv,
  API_AUTH_MODE: parsedEnv.API_AUTH_MODE ?? (parsedEnv.NODE_ENV === "production" ? "supabase" : "disabled"),
  PLIVO_VALIDATE_SIGNATURES: parsedEnv.PLIVO_VALIDATE_SIGNATURES ?? (parsedEnv.NODE_ENV === "production"),
  WORKER_QUEUE_PREFIX: parsedEnv.WORKER_QUEUE_PREFIX ?? "bharatengage",
  WORKER_CONCURRENCY: parsedEnv.WORKER_CONCURRENCY ?? 5,
  WORKER_SCHEDULER_INTERVAL_MS: parsedEnv.WORKER_SCHEDULER_INTERVAL_MS ?? 60_000,
  SENSITIVE_DATA_ENCRYPTION_KEY: resolveSensitiveDataEncryptionKey(),
};

export type AppEnv = typeof env;
