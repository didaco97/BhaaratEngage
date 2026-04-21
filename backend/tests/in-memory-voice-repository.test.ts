import { describe, expect, it } from "vitest";

import { createInMemoryRepositories } from "../src/repositories/in-memory-repositories.js";

describe("in-memory voice repository", () => {
  it("keeps raw sensitive values for resumed sessions while exposing masked collected data", async () => {
    const repositories = createInMemoryRepositories();
    const sessionInput = {
      campaignId: "camp-001",
      contactId: "contact-001",
      providerCallId: "plivo-runtime-reconnect-001",
      provider: "plivo",
      startedAt: "2026-04-09T00:00:00.000Z",
      transcriptMode: "restricted" as const,
    };

    const session = await repositories.voice.ensureCallSession(sessionInput);

    await repositories.voice.upsertCollectedField({
      providerCallId: session.providerCallId,
      fieldKey: "pan_number",
      label: "PAN number",
      rawValue: "ABCDE1234F",
      maskedValue: "******234F",
      sensitive: true,
      confidenceScore: 0.95,
      confirmed: false,
    });

    const resumed = await repositories.voice.ensureCallSession(sessionInput);
    const collectedData = await repositories.callRecords.getCollectedData(resumed.callRecordId);

    expect(resumed.collectedData).toEqual([
      {
        fieldKey: "pan_number",
        label: "PAN number",
        rawValue: "ABCDE1234F",
        maskedValue: "******234F",
        confidenceScore: 0.95,
        confirmed: false,
        sensitive: true,
      },
    ]);
    expect(collectedData).toEqual([
      {
        fieldKey: "pan_number",
        label: "PAN number",
        value: "******234F",
        confidenceScore: 0.95,
        confirmed: false,
        masked: true,
      },
    ]);
  });

  it("stores raw and redacted transcript artifacts separately", async () => {
    const repositories = createInMemoryRepositories();
    const session = await repositories.voice.ensureCallSession({
      campaignId: "camp-001",
      contactId: "contact-001",
      providerCallId: "plivo-runtime-transcript-001",
      provider: "plivo",
      startedAt: "2026-04-09T00:00:00.000Z",
      transcriptMode: "restricted",
    });

    await repositories.voice.appendTranscriptTurn({
      providerCallId: session.providerCallId,
      speaker: "User",
      textRaw: "ABCDE1234F",
      textRedacted: "******234F",
    });

    const rawTranscript = await repositories.callRecords.getTranscript(session.callRecordId, {
      view: "raw",
    });
    const redactedTranscript = await repositories.callRecords.getTranscript(session.callRecordId);

    expect(rawTranscript).toEqual([
      {
        speaker: "User",
        text: "ABCDE1234F",
      },
    ]);
    expect(redactedTranscript).toEqual([
      {
        speaker: "User",
        text: "******234F",
      },
    ]);
  });

  it("keeps the stored transfer queue for a resumed voice session after the campaign queue changes", async () => {
    const repositories = createInMemoryRepositories();
    const sessionInput = {
      campaignId: "camp-001",
      contactId: "contact-001",
      providerCallId: "plivo-runtime-transfer-queue-001",
      provider: "plivo",
      startedAt: "2026-04-09T00:00:00.000Z",
      transcriptMode: "restricted" as const,
    };
    const originalSession = await repositories.voice.ensureCallSession(sessionInput);
    const campaign = await repositories.campaigns.getById("camp-001");

    if (!campaign) {
      throw new Error("Expected seeded campaign camp-001 to exist.");
    }

    await repositories.campaigns.update("camp-001", {
      setup: {
        ...campaign.setup,
        transferEnabled: true,
        transferQueue: "Priority desk",
      },
      fields: campaign.fields,
      journey: campaign.journey,
    });

    const resumedSession = await repositories.voice.ensureCallSession(sessionInput);

    expect(originalSession.transferQueue).toBe("Mumbai review desk");
    expect(originalSession.transferTarget).toBe("+918000000101");
    expect(resumedSession.transferQueue).toBe("Mumbai review desk");
    expect(resumedSession.transferTarget).toBe("+918000000101");
  });

  it("uses the stored call end time when refreshing dashboard transfer queue metrics", async () => {
    const repositories = createInMemoryRepositories();
    const campaign = await repositories.campaigns.getById("camp-001");

    if (!campaign) {
      throw new Error("Expected seeded campaign camp-001 to exist.");
    }

    await repositories.campaigns.update("camp-001", {
      setup: {
        ...campaign.setup,
        transferEnabled: true,
        transferQueue: "Priority desk",
      },
      fields: campaign.fields,
      journey: campaign.journey,
    });

    const transferredSession = await repositories.voice.ensureCallSession({
      campaignId: "camp-001",
      contactId: "contact-001",
      providerCallId: "plivo-runtime-dashboard-transfer-001",
      provider: "plivo",
      startedAt: "2026-04-09T09:30:00.000Z",
      transcriptMode: "restricted",
    });

    await repositories.voice.updateCallStatus({
      providerCallId: transferredSession.providerCallId,
      status: "transferred",
      disposition: "human_transfer",
      endedAt: "2026-04-09T10:05:00.000Z",
    });

    await repositories.voice.ensureCallSession({
      campaignId: "camp-002",
      contactId: "contact-004",
      providerCallId: "plivo-runtime-dashboard-transfer-002",
      provider: "plivo",
      startedAt: "2026-04-09T10:30:00.000Z",
      transcriptMode: "restricted",
    });

    const dashboard = await repositories.dashboard.getSnapshot();
    const priorityDesk = dashboard.transferQueues.find((queue) => queue.queue === "Priority desk");

    expect(priorityDesk).toEqual(
      expect.objectContaining({
        queue: "Priority desk",
        waiting: 1,
      }),
    );
  });
});
