import type { AppEnv } from "../config/env.js";

export interface DependencyState {
  readonly configured: boolean;
  readonly note: string;
}

export interface ReadinessSnapshot {
  readonly status: "ok" | "degraded";
  readonly dependencies: {
    readonly database: DependencyState;
    readonly redis: DependencyState;
    readonly plivo: DependencyState;
    readonly sarvam: DependencyState;
    readonly openai: DependencyState;
  };
}

export function getReadinessSnapshot(currentEnv: AppEnv): ReadinessSnapshot {
  const dependencies = {
    database: {
      configured: Boolean(currentEnv.SUPABASE_URL && currentEnv.SUPABASE_SERVICE_ROLE_KEY),
      note: "Supabase URL and service role key are required for database access.",
    },
    redis: {
      configured: Boolean(currentEnv.REDIS_URL),
      note: "Redis becomes required once dialer and journey workers are enabled.",
    },
    plivo: {
      configured: Boolean(currentEnv.PLIVO_AUTH_ID && currentEnv.PLIVO_AUTH_TOKEN && currentEnv.PLIVO_PHONE_NUMBER && currentEnv.PUBLIC_BASE_URL),
      note: "Plivo credentials, a caller ID, and a public callback base URL are required for outbound calls and telephony webhooks.",
    },
    sarvam: {
      configured: Boolean(currentEnv.SARVAM_API_KEY),
      note: "Sarvam is required for multilingual STT/TTS in the production voice path.",
    },
    openai: {
      configured: Boolean(currentEnv.OPENAI_API_KEY),
      note: "OpenAI is required for structured extraction and confirmation handling.",
    },
  } satisfies ReadinessSnapshot["dependencies"];

  const isFullyConfigured = Object.values(dependencies).every((dependency) => dependency.configured);

  return {
    status: isFullyConfigured ? "ok" : "degraded",
    dependencies,
  };
}
