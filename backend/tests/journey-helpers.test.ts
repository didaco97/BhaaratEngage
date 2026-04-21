import { describe, expect, it } from "vitest";

import { computeJourneyNextAttemptAt, normalizeJourneyAction } from "../workers/journey/journey-helpers.js";

describe("journey worker helpers", () => {
  it("normalizes supported follow-up actions and falls back to none", () => {
    expect(normalizeJourneyAction(" SMS ")).toBe("sms");
    expect(normalizeJourneyAction("WhatsApp")).toBe("whatsapp");
    expect(normalizeJourneyAction("unsupported")).toBe("none");
  });

  it("computes the next retry timestamp from the requested time", () => {
    expect(
      computeJourneyNextAttemptAt({
        requestedAt: "2026-04-09T10:00:00.000Z",
        retryWindowHours: 4,
      }),
    ).toBe("2026-04-09T14:00:00.000Z");
  });

  it("throws for invalid retry timestamps", () => {
    expect(() =>
      computeJourneyNextAttemptAt({
        requestedAt: "not-a-date",
        retryWindowHours: 2,
      }),
    ).toThrow(/invalid requestedAt timestamp/i);
  });
});
