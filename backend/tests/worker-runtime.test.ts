import { describe, expect, it } from "vitest";

import { computeQueueDelayMs, resolvePublishedJobId } from "../workers/runtime.js";

describe("worker runtime helpers", () => {
  it("computes queue delays relative to the current tick", () => {
    expect(computeQueueDelayMs("2026-04-09T10:05:00.000Z", Date.parse("2026-04-09T10:00:00.000Z"))).toBe(300_000);
    expect(computeQueueDelayMs("2026-04-09T09:55:00.000Z", Date.parse("2026-04-09T10:00:00.000Z"))).toBe(0);
  });

  it("throws for invalid queue schedule timestamps", () => {
    expect(() => computeQueueDelayMs("not-a-date")).toThrow(/invalid runAt timestamp/i);
  });

  it("reuses a dedupe key as the BullMQ job id", () => {
    expect(resolvePublishedJobId("org-1:campaign-1:tick-1")).toBe("org-1:campaign-1:tick-1");
  });

  it("generates a random id when no dedupe key is provided", () => {
    expect(resolvePublishedJobId()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu,
    );
  });
});
