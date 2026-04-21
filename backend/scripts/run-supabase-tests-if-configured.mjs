import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const currentFilePath = fileURLToPath(import.meta.url);
const currentDirectory = dirname(currentFilePath);
const backendRoot = resolve(currentDirectory, "..");

function isTruthy(value) {
  if (typeof value !== "string") {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

const hasSupabaseCredentials = Boolean(process.env.SUPABASE_URL?.trim()) && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());
const shouldRunSupabaseTests = hasSupabaseCredentials && isTruthy(process.env.SUPABASE_INTEGRATION_TEST);

if (!shouldRunSupabaseTests) {
  console.log("Skipping Supabase integration tests because SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or SUPABASE_INTEGRATION_TEST=true is not configured.");
  process.exit(0);
}

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const result = spawnSync(npmCommand, ["exec", "--", "vitest", "run", "-c", "vitest.supabase.config.ts"], {
  cwd: backendRoot,
  env: process.env,
  stdio: "inherit",
});

if (typeof result.status === "number") {
  process.exit(result.status);
}

if (result.error) {
  throw result.error;
}

process.exit(1);
