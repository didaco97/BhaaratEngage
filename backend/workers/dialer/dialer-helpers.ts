import type { DialerCapacitySnapshot, DialerEligibilityResult, DialerPolicyContactInput } from "./dialer.types.js";

export interface ComputeDialerBatchSizeInput extends DialerCapacitySnapshot {
  readonly maxBatchSize?: number;
}

export interface ComputeDialerPollDelayInput {
  readonly hasRunnableCampaigns: boolean;
  readonly availableCapacity: number;
  readonly activeDelayMs?: number;
  readonly idleDelayMs?: number;
}

function clampNonNegativeInteger(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.floor(value));
}

export function computeDialerBatchSize(input: ComputeDialerBatchSizeInput) {
  const activeCalls = clampNonNegativeInteger(input.activeCalls);
  const concurrencyLimit = clampNonNegativeInteger(input.concurrencyLimit);
  const pacingPerMinute = clampNonNegativeInteger(input.pacingPerMinute);
  const maxBatchSize = Math.max(clampNonNegativeInteger(input.maxBatchSize ?? 50), 1);
  const availableCapacity = Math.max(concurrencyLimit - activeCalls, 0);

  if (availableCapacity === 0 || pacingPerMinute === 0) {
    return 0;
  }

  return Math.min(availableCapacity, pacingPerMinute, maxBatchSize);
}

export function computeDialerPollDelayMs(input: ComputeDialerPollDelayInput) {
  const activeDelayMs = Math.max(clampNonNegativeInteger(input.activeDelayMs ?? 1_000), 250);
  const idleDelayMs = Math.max(clampNonNegativeInteger(input.idleDelayMs ?? 5_000), activeDelayMs);

  if (!input.hasRunnableCampaigns || input.availableCapacity <= 0) {
    return idleDelayMs;
  }

  return activeDelayMs;
}

function parseTimeValueToMinutes(value: string) {
  const [hoursValue, minutesValue] = value.split(":");
  const hours = hoursValue ? Number.parseInt(hoursValue, 10) : Number.NaN;
  const minutes = minutesValue ? Number.parseInt(minutesValue, 10) : Number.NaN;

  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) {
    throw new RangeError(`Invalid time value: ${value}`);
  }

  return hours * 60 + minutes;
}

function getIstMinutes(now: Date) {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Kolkata",
  });
  const parts = formatter.formatToParts(now);
  const hour = Number.parseInt(parts.find((part) => part.type === "hour")?.value ?? "0", 10);
  const minute = Number.parseInt(parts.find((part) => part.type === "minute")?.value ?? "0", 10);

  return hour * 60 + minute;
}

export function isWithinDialerCallingWindow(now: Date, startTime: string, endTime: string) {
  const currentMinutes = getIstMinutes(now);
  const startMinutes = parseTimeValueToMinutes(startTime);
  const endMinutes = parseTimeValueToMinutes(endTime);

  if (startMinutes === endMinutes) {
    return true;
  }

  if (startMinutes < endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  }

  return currentMinutes >= startMinutes || currentMinutes < endMinutes;
}

export function hasRetryWindowElapsed(lastContactedAt: string | undefined, retryWindowHours: number, now: Date) {
  if (!lastContactedAt || retryWindowHours <= 0) {
    return true;
  }

  const lastAttemptAt = new Date(lastContactedAt).valueOf();

  if (Number.isNaN(lastAttemptAt)) {
    return true;
  }

  return now.valueOf() - lastAttemptAt >= retryWindowHours * 60 * 60 * 1_000;
}

export function evaluateDialerEligibility(input: {
  readonly candidate: DialerPolicyContactInput;
  readonly dndChecksEnabled: boolean;
  readonly retryWindowHours: number;
  readonly now: Date;
  readonly withinCallingWindow: boolean;
}): DialerEligibilityResult {
  if (!input.withinCallingWindow) {
    return {
      eligible: false,
      reason: "outside_calling_window",
    };
  }

  if (input.candidate.dispatchStatus === "in_progress") {
    return {
      eligible: false,
      reason: "dispatch_in_progress",
    };
  }

  if (!input.candidate.consent) {
    return {
      eligible: false,
      reason: "contact_consent",
    };
  }

  if (input.candidate.contactStatus === "opted_out" || input.candidate.contactStatus === "suppressed") {
    return {
      eligible: false,
      reason: "contact_status",
    };
  }

  if (input.dndChecksEnabled && input.candidate.contactStatus === "dnd") {
    return {
      eligible: false,
      reason: "contact_status",
    };
  }

  if (input.candidate.dispatchStatus !== "pending") {
    return {
      eligible: false,
      reason: "dispatch_state",
    };
  }

  if (!hasRetryWindowElapsed(input.candidate.lastContactedAt, input.retryWindowHours, input.now)) {
    return {
      eligible: false,
      reason: "retry_window",
    };
  }

  return {
    eligible: true,
  };
}
