import { randomUUID } from "node:crypto";

import type { Express } from "express";

import { createApp } from "../src/app.js";
import { getSupabaseAdminClient, isSupabaseConfigured } from "../src/db/supabase-admin.js";
import type { Role } from "../src/domain/enums.js";
import type { RequestPrincipal } from "../src/modules/auth/auth.types.js";
import { runWithRequestPrincipal } from "../src/modules/auth/request-auth-context.js";
import type { BackendRepositories } from "../src/repositories/backend-repositories.js";
import { createSupabaseRepositories } from "../src/repositories/supabase-repositories.js";

const enabledFlag = (process.env.SUPABASE_INTEGRATION_TEST ?? "").trim().toLowerCase();

export const canRunSupabaseIntegrationTests =
  isSupabaseConfigured() && (enabledFlag === "1" || enabledFlag === "true" || enabledFlag === "yes");

export interface SupabaseRouteTestContext {
  readonly app: Express;
  readonly repositories: BackendRepositories;
  readonly principal: RequestPrincipal;
  readonly organizationId: string;
  readonly authorizationHeader: string;
  runAsPrincipal<T>(callback: () => Promise<T> | T): Promise<T> | T;
}

export interface SupabaseRouteTestOptions {
  readonly role?: Role;
}

function sanitizeLabel(value: string) {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "");

  return normalized.length > 0 ? normalized.slice(0, 32) : "integration";
}

async function ensureInserted<T extends { error?: { message: string } | null }>(
  operation: PromiseLike<T>,
  failureMessage: string,
) {
  const result = await operation;

  if (result.error) {
    throw new Error(`${failureMessage}: ${result.error.message}`);
  }

  return result;
}

async function cleanupTestUser(userId: string) {
  const client = getSupabaseAdminClient();
  const { error } = await client.auth.admin.deleteUser(userId);

  if (error && !/user not found/iu.test(error.message)) {
    throw new Error(`Failed to delete Supabase integration test user: ${error.message}`);
  }
}

async function cleanupOrganization(organizationId: string) {
  const client = getSupabaseAdminClient();
  const { error } = await client.from("organizations").delete().eq("id", organizationId);

  if (error) {
    throw new Error(`Failed to delete Supabase integration test organization: ${error.message}`);
  }
}

export async function withSupabaseRouteTestContext<T>(
  label: string,
  callback: (context: SupabaseRouteTestContext) => Promise<T>,
  options: SupabaseRouteTestOptions = {},
) {
  if (!canRunSupabaseIntegrationTests) {
    throw new Error(
      "Supabase integration tests require SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and SUPABASE_INTEGRATION_TEST=true.",
    );
  }

  const client = getSupabaseAdminClient();
  const suffix = randomUUID();
  const organizationId = randomUUID();
  const slugBase = sanitizeLabel(label);
  const organizationSlug = `${slugBase}-${suffix.slice(0, 8)}`;
  const organizationName = `Supabase Integration ${slugBase}`;
  const userEmail = `${organizationSlug}@example.invalid`;

  const userResult = await client.auth.admin.createUser({
    email: userEmail,
    password: `${randomUUID()}Aa1!`,
    email_confirm: true,
    user_metadata: {
      full_name: "Supabase Integration Admin",
    },
  });

  if (userResult.error || !userResult.data.user) {
    throw new Error(`Failed to create Supabase integration test user: ${userResult.error?.message ?? "Unknown error."}`);
  }

  const userId = userResult.data.user.id;
  const role = options.role ?? "workspace_admin";
  let callbackError: unknown;
  let cleanupError: Error | null = null;
  let callbackResult: T | undefined;

  try {
    await ensureInserted(
      client.from("organizations").insert({
        id: organizationId,
        name: organizationName,
        slug: organizationSlug,
      }),
      "Failed to create Supabase integration test organization",
    );

    await ensureInserted(
      client.from("workspace_settings").insert({
        organization_id: organizationId,
        workspace_name: organizationName,
        default_language: "english",
        calling_window_start: "09:00",
        calling_window_end: "20:00",
        dnd_checks_enabled: true,
        quiet_hours_auto_pause: true,
        restrict_full_transcripts: true,
      }),
      "Failed to create Supabase integration test workspace settings",
    );

    await ensureInserted(
      client.from("user_profiles").insert({
        id: userId,
        organization_id: organizationId,
        full_name: "Supabase Integration Admin",
        email: userEmail,
        role,
      }),
      "Failed to create Supabase integration test user profile",
    );

    const principal: RequestPrincipal = {
      userId,
      organizationId,
      role,
      email: userEmail,
      fullName: "Supabase Integration Admin",
      authMode: "supabase",
    };
    const repositories = createSupabaseRepositories();
    const app = createApp({
      repositories,
      auth: {
        mode: "supabase",
        resolveSupabasePrincipal: async () => principal,
      },
    });

    callbackResult = await callback({
      app,
      repositories,
      principal,
      organizationId,
      authorizationHeader: "Bearer supabase-integration-test-token",
      runAsPrincipal: <TValue>(runCallback: () => Promise<TValue> | TValue) => runWithRequestPrincipal(principal, runCallback),
    });
  } catch (error) {
    callbackError = error;
  }

  try {
    await cleanupOrganization(organizationId);
  } catch (error) {
    cleanupError = error instanceof Error ? error : new Error("Failed to clean up Supabase integration test organization.");
  }

  try {
    await cleanupTestUser(userId);
  } catch (error) {
    cleanupError = error instanceof Error ? error : new Error("Failed to clean up Supabase integration test user.");
  }

  if (callbackError) {
    throw callbackError;
  }

  if (cleanupError) {
    throw cleanupError;
  }

  return callbackResult as T;
}
