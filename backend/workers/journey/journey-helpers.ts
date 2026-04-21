import type { JourneyAction } from "./journey.types.js";

const HOUR_IN_MILLISECONDS = 60 * 60 * 1_000;

export function normalizeJourneyAction(action: string): JourneyAction {
  const normalized = action.trim().toLowerCase();

  switch (normalized) {
    case "sms":
    case "whatsapp":
    case "retry":
      return normalized;
    default:
      return "none";
  }
}

export function computeJourneyNextAttemptAt(input: {
  readonly requestedAt: string;
  readonly retryWindowHours?: number;
}) {
  const requestedAt = new Date(input.requestedAt);

  if (Number.isNaN(requestedAt.valueOf())) {
    throw new RangeError(`Invalid requestedAt timestamp: ${input.requestedAt}`);
  }

  const retryWindowHours = Number.isFinite(input.retryWindowHours) ? Math.max(input.retryWindowHours ?? 0, 0) : 0;
  return new Date(requestedAt.getTime() + retryWindowHours * HOUR_IN_MILLISECONDS).toISOString();
}
