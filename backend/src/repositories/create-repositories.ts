import { env } from "../config/env.js";
import { isSupabaseConfigured } from "../db/supabase-admin.js";
import { logger } from "../lib/logger.js";
import type { BackendRepositories } from "./backend-repositories.js";
import { createInMemoryRepositories } from "./in-memory-repositories.js";
import { createSupabaseRepositories } from "./supabase-repositories.js";

export type RepositoryMode = "memory" | "supabase";

export function resolveRepositoryMode(options: {
  readonly configuredDataSource: "auto" | "memory" | "supabase";
  readonly supabaseConfigured: boolean;
}): RepositoryMode {
  if (options.configuredDataSource === "memory") {
    return "memory";
  }

  if (options.configuredDataSource === "supabase") {
    if (!options.supabaseConfigured) {
      throw new Error("BACKEND_DATA_SOURCE is set to supabase but Supabase credentials are missing.");
    }

    return "supabase";
  }

  return options.supabaseConfigured ? "supabase" : "memory";
}

export function createRepositories(): BackendRepositories {
  const mode = resolveRepositoryMode({
    configuredDataSource: env.BACKEND_DATA_SOURCE,
    supabaseConfigured: isSupabaseConfigured(),
  });

  if (mode === "supabase") {
    if (env.NODE_ENV !== "test") {
      logger.info(
        {
          mode,
          defaultOrganizationId: env.DEFAULT_ORGANIZATION_ID,
          defaultOrganizationSlug: env.DEFAULT_ORGANIZATION_SLUG,
        },
        "Using Supabase-backed repositories.",
      );
    }

    return createSupabaseRepositories();
  }

  if (env.NODE_ENV !== "test" && env.BACKEND_DATA_SOURCE === "auto") {
    logger.warn("Supabase is not configured. Falling back to in-memory repositories.");
  }

  return createInMemoryRepositories();
}
