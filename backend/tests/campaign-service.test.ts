import { describe, expect, it, vi } from "vitest";

import { AuditService } from "../src/modules/audit/audit.service.js";
import { CampaignService } from "../src/modules/campaigns/campaign.service.js";
import type { CampaignDetail } from "../src/modules/campaigns/campaign.schemas.js";
import type { Contact } from "../src/modules/contacts/contact.schemas.js";
import type {
  CampaignRepository,
  ContactRepository,
} from "../src/repositories/backend-repositories.js";

function createCampaign(status: CampaignDetail["status"]): CampaignDetail {
  return {
    id: "camp-audit-001",
    name: "Voice Collections",
    status,
    language: "english",
    vertical: "banking",
    template: "collections",
    workspace: "Workspace",
    callerIdentity: "Bhaarat Engage",
    summary: "Collect dues",
    contactCount: 10,
    completionRate: 40,
    answerRate: 60,
    confirmationRate: 45,
    createdAt: "2026-04-08T00:00:00.000Z",
    quietHours: "09:00 to 18:00 IST",
    transferQueue: "Priority Desk",
    sensitiveFieldCount: 1,
    sequence: ["Voice first"],
    fields: [
      {
        field_key: "consent",
        label: "Consent",
        prompt: "Do you consent?",
        type: "boolean",
        required: true,
        sensitive: false,
        verification_label: "Consent",
        retry_limit: 2,
        validation_rule: "Yes or no",
      },
    ],
    setup: {
      campaignName: "Voice Collections",
      vertical: "banking",
      language: "english",
      callerIdentity: "Bhaarat Engage",
      introScript: "Hello from Bhaarat Engage.",
      purposeStatement: "Collect dues.",
      callingWindowStart: "09:00",
      callingWindowEnd: "18:00",
      transferEnabled: true,
      transferQueue: "Priority Desk",
    },
    journey: {
      unansweredAction: "sms",
      partialAction: "retry",
      retryWindowHours: 4,
      maxRetries: 2,
      concurrencyLimit: 5,
      pacingPerMinute: 5,
      csvSource: "seed.csv",
    },
  };
}

function createCampaignRepositoryStub(overrides: Partial<CampaignRepository> = {}): CampaignRepository {
  const campaign = createCampaign("draft");

  return {
    list: async () => [],
    getById: async () => campaign,
    listSchedulerCampaigns: async () => [],
    listContacts: async () => [],
    listDialerContacts: async () => [],
    create: async () => campaign,
    update: async () => campaign,
    assignContacts: async () => [],
    removeContact: async () => false,
    setStatus: async () => campaign,
    duplicate: async () => campaign,
    remove: async () => true,
    countDialerContacts: async () => 0,
    updateDialerContactDispatch: async () => true,
    ...overrides,
  };
}

function createContactRepositoryStub(): ContactRepository {
  const contact: Contact = {
    id: "contact-audit-001",
    name: "Asha Sharma",
    phone: "+919999999999",
    email: "asha@example.com",
    language: "english",
    status: "eligible",
    consent: true,
    workspace: "Workspace",
    source: "Manual",
  };

  return {
    list: async () => [],
    getById: async () => contact,
    findByPhone: async () => contact,
    create: async () => contact,
    update: async () => contact,
    remove: async () => true,
    setStatus: async () => contact,
    importContacts: async () => ({
      jobId: "job-001",
      imported: 1,
      skipped: 0,
      duplicates: 0,
      invalid: 0,
    }),
  };
}

function createAuditServiceStub() {
  const record = vi.fn(async () => undefined);
  const service = new AuditService({ record });

  return {
    service,
    record,
    recordIfPossible: vi.spyOn(service, "recordIfPossible"),
  };
}

describe("campaign service audit logging", () => {
  it("records an audit event when a campaign is launched", async () => {
    const launchedCampaign = createCampaign("active");
    const auditService = createAuditServiceStub();
    const setStatus = vi.fn(async () => launchedCampaign);
    const service = new CampaignService(
      createCampaignRepositoryStub({
        getById: async () => createCampaign("draft"),
        setStatus,
      }),
      createContactRepositoryStub(),
      auditService.service,
    );

    const result = await service.launch(launchedCampaign.id);

    expect(result.status).toBe("active");
    expect(setStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        id: launchedCampaign.id,
        status: "active",
        pauseMode: null,
        expectedCurrentStatus: "draft",
      }),
    );
    expect(auditService.recordIfPossible).toHaveBeenCalledWith({
      action: "Launched campaign",
      entityType: "campaign",
      entityId: launchedCampaign.id,
      metadata: {
        displayName: launchedCampaign.name,
      },
    });
  });

  it("records an audit event when a campaign is paused", async () => {
    const pausedCampaign = createCampaign("paused");
    const auditService = createAuditServiceStub();
    const setStatus = vi.fn(async () => pausedCampaign);
    const service = new CampaignService(
      createCampaignRepositoryStub({
        getById: async () => createCampaign("active"),
        setStatus,
      }),
      createContactRepositoryStub(),
      auditService.service,
    );

    const result = await service.pause(pausedCampaign.id);

    expect(result.status).toBe("paused");
    expect(setStatus).toHaveBeenCalledWith({
      id: pausedCampaign.id,
      status: "paused",
      pauseMode: "manual",
      expectedCurrentStatus: "active",
    });
    expect(auditService.recordIfPossible).toHaveBeenCalledWith({
      action: "Paused campaign",
      entityType: "campaign",
      entityId: pausedCampaign.id,
      metadata: {
        displayName: pausedCampaign.name,
      },
    });
  });

  it("records an audit event when a campaign is resumed", async () => {
    const resumedCampaign = createCampaign("active");
    const auditService = createAuditServiceStub();
    const setStatus = vi.fn(async () => resumedCampaign);
    const service = new CampaignService(
      createCampaignRepositoryStub({
        getById: async () => createCampaign("paused"),
        setStatus,
      }),
      createContactRepositoryStub(),
      auditService.service,
    );

    const result = await service.resume(resumedCampaign.id);

    expect(result.status).toBe("active");
    expect(setStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        id: resumedCampaign.id,
        status: "active",
        pauseMode: null,
        expectedCurrentStatus: "paused",
      }),
    );
    expect(auditService.recordIfPossible).toHaveBeenCalledWith({
      action: "Resumed campaign",
      entityType: "campaign",
      entityId: resumedCampaign.id,
      metadata: {
        displayName: resumedCampaign.name,
      },
    });
  });

  it("records an audit event when a campaign is auto-paused for quiet hours", async () => {
    const pausedCampaign = createCampaign("paused");
    const auditService = createAuditServiceStub();
    const setStatus = vi.fn(async () => pausedCampaign);
    const service = new CampaignService(
      createCampaignRepositoryStub({
        setStatus,
      }),
      createContactRepositoryStub(),
      auditService.service,
    );

    const result = await service.autoPauseForQuietHours(pausedCampaign.id);

    expect(result?.status).toBe("paused");
    expect(setStatus).toHaveBeenCalledWith({
      id: pausedCampaign.id,
      status: "paused",
      pauseMode: "quiet_hours",
      expectedCurrentStatus: "active",
    });
    expect(auditService.recordIfPossible).toHaveBeenCalledWith({
      action: "Auto-paused campaign",
      entityType: "campaign",
      entityId: pausedCampaign.id,
      metadata: {
        displayName: pausedCampaign.name,
        pauseMode: "quiet_hours",
      },
    });
  });

  it("records an audit event when a campaign is auto-resumed from quiet hours", async () => {
    const resumedCampaign = createCampaign("active");
    const auditService = createAuditServiceStub();
    const setStatus = vi.fn(async () => resumedCampaign);
    const service = new CampaignService(
      createCampaignRepositoryStub({
        setStatus,
      }),
      createContactRepositoryStub(),
      auditService.service,
    );

    const result = await service.autoResumeFromQuietHours(resumedCampaign.id);

    expect(result?.status).toBe("active");
    expect(setStatus).toHaveBeenCalledWith({
      id: resumedCampaign.id,
      status: "active",
      pauseMode: null,
      expectedCurrentStatus: "paused",
      expectedCurrentPauseMode: "quiet_hours",
    });
    expect(auditService.recordIfPossible).toHaveBeenCalledWith({
      action: "Auto-resumed campaign",
      entityType: "campaign",
      entityId: resumedCampaign.id,
      metadata: {
        displayName: resumedCampaign.name,
        pauseMode: "quiet_hours",
      },
    });
  });
});
