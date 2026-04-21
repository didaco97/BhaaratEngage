import type { RequestHandler } from "express";

import { env } from "../../config/env.js";
import type { Role } from "../../domain/enums.js";
import { getSupabaseAdminClient, isSupabaseConfigured } from "../../db/supabase-admin.js";
import { AppError } from "../../lib/http-errors.js";
import { runWithRequestPrincipal } from "./request-auth-context.js";
import type { ApiAuthDependencies, ApiAuthMode, RequestPrincipal } from "./auth.types.js";

interface UserProfileRow {
  readonly id: string;
  readonly organization_id: string;
  readonly full_name: string;
  readonly email: string;
  readonly role: Role;
}

function resolveAuthMode(mode?: ApiAuthMode) {
  return mode ?? env.API_AUTH_MODE;
}

function buildDevelopmentPrincipal(): RequestPrincipal {
  return {
    userId: env.API_AUTH_DEV_USER_ID ?? "dev-user",
    organizationId: env.API_AUTH_DEV_ORGANIZATION_ID ?? env.DEFAULT_ORGANIZATION_ID ?? "development-organization",
    role: env.API_AUTH_DEV_ROLE,
    email: "dev@local.test",
    fullName: "Development User",
    authMode: "disabled",
  };
}

function extractBearerToken(authorizationHeader?: string | null) {
  if (!authorizationHeader) {
    return null;
  }

  const [scheme, token] = authorizationHeader.split(" ");

  if (scheme?.toLowerCase() !== "bearer" || !token?.trim()) {
    return null;
  }

  return token.trim();
}

export async function resolveSupabasePrincipalFromAccessToken(accessToken: string): Promise<RequestPrincipal> {
  const client = getSupabaseAdminClient();
  const { data: authData, error: authError } = await client.auth.getUser(accessToken);

  if (authError || !authData.user) {
    throw new AppError(401, "invalid_auth_token", "The access token is invalid or expired.");
  }

  const { data: profile, error: profileError } = await client
    .from("user_profiles")
    .select("id, organization_id, full_name, email, role")
    .eq("id", authData.user.id)
    .maybeSingle<UserProfileRow>();

  if (profileError) {
    throw new Error(`Failed to load the authenticated user profile: ${profileError.message}`);
  }

  if (!profile) {
    throw new AppError(403, "auth_profile_missing", "The authenticated user is not assigned to a workspace profile.");
  }

  return {
    userId: profile.id,
    organizationId: profile.organization_id,
    role: profile.role,
    email: profile.email,
    fullName: profile.full_name,
    authMode: "supabase",
  };
}

export function createApiAuthMiddleware(dependencies: ApiAuthDependencies = {}): RequestHandler {
  const mode = resolveAuthMode(dependencies.mode);
  const developmentPrincipal = dependencies.devPrincipal ?? buildDevelopmentPrincipal();
  const resolveSupabasePrincipal = dependencies.resolveSupabasePrincipal ?? resolveSupabasePrincipalFromAccessToken;

  if (mode === "supabase" && !dependencies.resolveSupabasePrincipal && !isSupabaseConfigured()) {
    throw new Error("API auth mode is set to supabase but Supabase credentials are missing.");
  }

  return async (request, _response, next) => {
    try {
      if (mode === "disabled") {
        request.auth = developmentPrincipal;
        return runWithRequestPrincipal(request.auth, () => next());
      }

      const accessToken = extractBearerToken(request.headers.authorization);

      if (!accessToken) {
        throw new AppError(401, "authorization_required", "A Bearer access token is required for this API.");
      }

      request.auth = await resolveSupabasePrincipal(accessToken);
      return runWithRequestPrincipal(request.auth, () => next());
    } catch (error) {
      return next(error);
    }
  };
}
