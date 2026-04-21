import { describe, expect, it, vi } from "vitest";

import { createInMemoryRepositories } from "../src/repositories/in-memory-repositories.js";
import { createSeedState } from "../src/repositories/seed-data.js";
import { DialerDispatchService } from "../workers/dialer/dialer-dispatcher.js";
import type { DialerDispatchJobData } from "../workers/dialer/dialer.types.js";
import type { QueueMessage } from "../workers/contracts.js";

function createDialerJob(overrides: Partial<DialerDispatchJobData> = {}): QueueMessage<DialerDispatchJobData> {
  return {
    id: "job-001",
    name: "dialer-queue",
    payload: {
      organizationId: "workspace-001",
      campaignId: "camp-001",
      requestedAt: "2026-04-09T05:00:00.000Z",
      triggeredBy: "scheduler",
      ...overrides,
    },
    attempts: 3,
    attemptsMade: 0,
    enqueuedAt: "2026-04-09T05:00:00.000Z",
  };
}

describe("dialer dispatch service", () => {
  it("dispatches eligible contacts in assignment priority order", async () => {
    const repositories = createInMemoryRepositories();
    await repositories.campaigns.assignContacts("camp-001", ["contact-002", "contact-001"]);

    const startOutboundCall = vi.fn(async () => ({
      requestUuid: "request-001",
    }));
    const service = new DialerDispatchService({
      repositories,
      voiceCaller: {
        startOutboundCall,
      },
      now: () => new Date("2026-04-09T05:00:00.000Z"),
    });

    const result = await service.handleJob(createDialerJob());
    const dialerContacts = await repositories.campaigns.listDialerContacts("camp-001");

    expect(result.outcome).toBe("scheduled_contacts");
    expect(result.reservedContacts).toBe(2);
    expect(startOutboundCall).toHaveBeenNthCalledWith(1, {
      campaignId: "camp-001",
      contactId: "contact-002",
      source: "scheduler",
    });
    expect(startOutboundCall).toHaveBeenNthCalledWith(2, {
      campaignId: "camp-001",
      contactId: "contact-001",
      source: "scheduler",
    });
    expect(dialerContacts.slice(0, 2).map((entry) => [entry.contact.id, entry.dispatchStatus, entry.contact.lastContactedAt])).toEqual([
      ["contact-002", "in_progress", "2026-04-09T05:00:00.000Z"],
      ["contact-001", "in_progress", "2026-04-09T05:00:00.000Z"],
    ]);
  });

  it("filters contacts that are blocked by consent or retry window before dispatch", async () => {
    const seed = createSeedState();
    const contactOne = seed.contacts.find((contact) => contact.id === "contact-001");
    const contactTwo = seed.contacts.find((contact) => contact.id === "contact-002");

    if (!contactOne || !contactTwo) {
      throw new Error("Seed contacts were not available for the dialer test.");
    }

    contactOne.lastContactedAt = "2026-04-09T03:30:00.000Z";
    contactTwo.consent = false;

    const repositories = createInMemoryRepositories(seed);
    await repositories.campaigns.assignContacts("camp-001", ["contact-001", "contact-002", "contact-006"]);

    const startOutboundCall = vi.fn(async () => ({
      requestUuid: "request-002",
    }));
    const service = new DialerDispatchService({
      repositories,
      voiceCaller: {
        startOutboundCall,
      },
      now: () => new Date("2026-04-09T05:00:00.000Z"),
    });

    const result = await service.handleJob(createDialerJob());

    expect(result.outcome).toBe("scheduled_contacts");
    expect(result.reservedContacts).toBe(1);
    expect(startOutboundCall).toHaveBeenCalledTimes(1);
    expect(startOutboundCall).toHaveBeenCalledWith({
      campaignId: "camp-001",
      contactId: "contact-006",
      source: "scheduler",
    });
    expect(result.notes).toContain("Skipped 1 contacts because they were missing consent.");
    expect(result.notes).toContain("Skipped 1 contacts because they were still inside retry window.");
  });

  it("reverts a contact back to pending when provider dispatch fails", async () => {
    const repositories = createInMemoryRepositories();
    await repositories.campaigns.assignContacts("camp-001", ["contact-006"]);

    const startOutboundCall = vi.fn(async () => {
      throw new Error("Provider outage");
    });
    const service = new DialerDispatchService({
      repositories,
      voiceCaller: {
        startOutboundCall,
      },
      now: () => new Date("2026-04-09T05:00:00.000Z"),
    });

    const result = await service.handleJob(createDialerJob({
      maxContacts: 1,
    }));
    const dialerContacts = await repositories.campaigns.listDialerContacts("camp-001");
    const failedDispatchContact = dialerContacts.find((entry) => entry.contact.id === "contact-006");

    expect(result.outcome).toBe("idle");
    expect(result.reservedContacts).toBe(0);
    expect(failedDispatchContact?.dispatchStatus).toBe("pending");
    expect(failedDispatchContact?.contact.lastContactedAt).toBeUndefined();
    expect(result.notes).toContain("Reverted 1 contacts to pending after a dispatch failure.");
  });
});
