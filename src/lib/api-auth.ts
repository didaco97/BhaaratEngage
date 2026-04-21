import { getSupabaseAccessToken } from "@/lib/supabase-browser";

type AccessTokenResolver = () => Promise<string | null>;

let accessTokenResolver: AccessTokenResolver = getSupabaseAccessToken;

export function resolveApiAccessToken() {
  return accessTokenResolver();
}

export function setApiAccessTokenResolver(resolver: AccessTokenResolver) {
  accessTokenResolver = resolver;
}

export function resetApiAccessTokenResolver() {
  accessTokenResolver = getSupabaseAccessToken;
}
