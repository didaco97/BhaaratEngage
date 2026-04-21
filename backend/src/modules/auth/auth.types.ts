import type { Role } from "../../domain/enums.js";

export type ApiAuthMode = "disabled" | "supabase";

export interface RequestPrincipal {
  readonly userId: string;
  readonly organizationId: string;
  readonly email: string;
  readonly fullName: string;
  readonly role: Role;
  readonly authMode: ApiAuthMode;
}

export type ResolveSupabasePrincipal = (accessToken: string) => Promise<RequestPrincipal>;

export interface ApiAuthDependencies {
  readonly mode?: ApiAuthMode;
  readonly devPrincipal?: RequestPrincipal;
  readonly resolveSupabasePrincipal?: ResolveSupabasePrincipal;
}

export const defaultTestPrincipal: RequestPrincipal = {
  userId: "user-test-admin",
  organizationId: "org-test",
  email: "test-admin@example.com",
  fullName: "Test Admin",
  role: "workspace_admin",
  authMode: "disabled",
};
