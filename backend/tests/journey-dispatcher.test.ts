import { describe, expect, it, vi } from "vitest";

import { CampaignService } from "../src/modules/campaigns/campaign.service.js";
import { createInMemoryRepositories } from "../src/repositories/in-memory-repositories.js";
import { JourneyDispatchService } from "../workers/journey/journey-dispatcher.js";
import type { JourneyDispatchJobData } from "../workers/journey/journey.types.js";
import type { QueueMessage } from "../workers/contracts.js";

function createJourneyJob(overrides: Partial<JourneyDispatchJobData> = {}): QueueMessage<JourneyDispatchJobData> {
  return {
    id: "job-journey-001",
    name: "journey-queue",
    payload: {
      organizationId: "workspace-001",
      campaignId: "camp-001",
      contactId: "contact-001",
      requestedAt: "2026-04-09T10:00:00.000Z",
      action: "retry",
      outcome: "partial",
      callRecordId: "call-journey-001",
      retryWindowHours: 4,
      ...overrides,
    },
    attempts: 3,
    attemptsMade: 0,
    enqueuedAt: "2026-04-09T10:00:00.000Z",
  };
}

describe("journey dispatch service", () => {
  it("schedules retries by restoring the contact to pending and updating the journey checkpoint", async () => {
    const repositories = createInMemoryRepositories();
    await repositories.campaigns.updateDialerContactDispatch({
      campaignId: "camp-001",
      contactId: "contact-001",
      dispatchStatus: "completed",
    });

    const deliver = vi.fn(async () => ({
      deliveryChannel: "sms" as const,
      acceptedAt: "2026-04-09T10:01:00.000Z",
    }));
    const service = new JourneyDispatchService({
      repositories,
      followUpGateway: {
        deliver,
      },
    });

    const result = await service.handleJob(createJourneyJob());
    const dialerContacts = await repositories.campaigns.listDialerContacts("camp-001");
    const retriedContact = dialerContacts.find((entry) => entry.contact.id === "contact-001");
    const journey = await repositories.journeys.getById("jrn-001");

    expect(result.outcome).toBe("scheduled_retry");
    expect(result.nextAttemptAt).toBe("2026-04-09T14:00:00.000Z");
    expect(retriedContact?.dispatchStatus).toBe("pending");
    expect(journey?.nextCheckpoint).toContain("19:30 IST");
    expect(deliver).not.toHaveBeenCalled();
  });

  it("queues WhatsApp follow-ups through the gateway for reachable contacts", async () => {
    const repositories = createInMemoryRepositories();
    const deliver = vi.fn(async () => ({
      deliveryChannel: "whatsapp" as const,
      acceptedAt: "2026-04-09T10:05:00.000Z",
    }));
    const service = new JourneyDispatchService({
      repositories,
      followUpGateway: {
        deliver,
      },
    });

    const result = await service.handleJob(
      createJourneyJob({
        action: "whatsapp",
        outcome: "unanswered",
      }),
    );

    expect(result.outcome).toBe("queued_followup");
    expect(deliver).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "workspace-001",
        action: "whatsapp",
        outcome: "unanswered",
        campaign: expect.objectContaining({
          id: "camp-001",
        }),
        contact: expect.objectContaining({
          id: "contact-001",
        }),
      }),
    );
  });

  it("shows paused journeys as paused even when a retry checkpoint is already stored, then restores the checkpoint on resume", async () => {
    const repositories = createInMemoryRepositories();
    const service = new JourneyDispatchService({
      repositories,
      followUpGateway: {
        deliver: vi.fn(async () => ({
          deliveryChannel: "sms" as const,
          acceptedAt: "2026-04-09T10:01:00.000Z",
        })),
      },
    });
    const campaignService = new CampaignService(repositories.campaigns, repositories.contacts);

    await service.handleJob(createJourneyJob());

    await campaignService.autoPauseForQuietHours("camp-001");

    const pausedJourney = await repositories.journeys.getById("jrn-001");

    expect(pausedJourney?.status).toBe("paused");
    expect(pausedJourney?.nextCheckpoint).toBe("Paused");

    await campaignService.autoResumeFromQuietHours("camp-001");

    const resumedJourney = await repositories.journeys.getById("jrn-001");

    expect(resumedJourney?.status).toBe("active");
    expect(resumedJourney?.nextCheckpoint).toContain("19:30 IST");
  });

  it("skips outbound follow-ups for contacts that are no longer reachable", async () => {
    const repositories = createInMemoryRepositories();
    const deliver = vi.fn(async () => ({
      deliveryChannel: "sms" as const,
      acceptedAt: "2026-04-09T10:01:00.000Z",
    }));
    const service = new JourneyDispatchService({
      repositories,
      followUpGateway: {
        deliver,
      },
    });

    const result = await service.handleJob(
      createJourneyJob({
        contactId: "contact-003",
        action: "sms",
        outcome: "unanswered",
      }),
    );

    expect(result.outcome).toBe("skipped");
    expect(result.notes[0]).toMatch(/missing consent|opted_out/i);
    expect(deliver).not.toHaveBeenCalled();
  });
});
