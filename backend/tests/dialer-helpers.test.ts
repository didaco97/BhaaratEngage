import { describe, expect, it } from "vitest";

import {
  computeDialerBatchSize,
  computeDialerPollDelayMs,
  evaluateDialerEligibility,
  hasRetryWindowElapsed,
  isWithinDialerCallingWindow,
} from "../workers/dialer/dialer-helpers.js";

describe("dialer worker helpers", () => {
  it("caps batch size by available capacity, pacing, and max batch size", () => {
    expect(
      computeDialerBatchSize({
        activeCalls: 3,
        concurrencyLimit: 10,
        pacingPerMinute: 12,
        maxBatchSize: 5,
      }),
    ).toBe(5);
  });

  it("returns zero batch size when there is no capacity or pacing", () => {
    expect(
      computeDialerBatchSize({
        activeCalls: 8,
        concurrencyLimit: 8,
        pacingPerMinute: 12,
      }),
    ).toBe(0);

    expect(
      computeDialerBatchSize({
        activeCalls: 1,
        concurrencyLimit: 8,
        pacingPerMinute: 0,
      }),
    ).toBe(0);
  });

  it("uses the idle poll delay when there is no runnable work", () => {
    expect(
      computeDialerPollDelayMs({
        hasRunnableCampaigns: false,
        availableCapacity: 4,
        activeDelayMs: 500,
        idleDelayMs: 4_000,
      }),
    ).toBe(4_000);
  });

  it("evaluates campaign calling windows in IST", () => {
    expect(isWithinDialerCallingWindow(new Date("2026-04-09T05:00:00.000Z"), "09:00", "18:00")).toBe(true);
    expect(isWithinDialerCallingWindow(new Date("2026-04-09T15:00:00.000Z"), "09:00", "18:00")).toBe(false);
  });

  it("applies retry windows and dispatch state checks to eligibility", () => {
    expect(hasRetryWindowElapsed("2026-04-09T03:30:00.000Z", 4, new Date("2026-04-09T05:00:00.000Z"))).toBe(false);
    expect(
      evaluateDialerEligibility({
        candidate: {
          dispatchStatus: "pending",
          contactStatus: "eligible",
          consent: true,
          lastContactedAt: "2026-04-09T03:30:00.000Z",
        },
        dndChecksEnabled: true,
        retryWindowHours: 4,
        now: new Date("2026-04-09T05:00:00.000Z"),
        withinCallingWindow: true,
      }),
    ).toEqual({
      eligible: false,
      reason: "retry_window",
    });
    expect(
      evaluateDialerEligibility({
        candidate: {
          dispatchStatus: "completed",
          contactStatus: "eligible",
          consent: true,
        },
        dndChecksEnabled: true,
        retryWindowHours: 4,
        now: new Date("2026-04-09T05:00:00.000Z"),
        withinCallingWindow: true,
      }),
    ).toEqual({
      eligible: false,
      reason: "dispatch_state",
    });
  });
});
