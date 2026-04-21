import { describe, expect, it, vi } from "vitest";

import type { CallRecord } from "../src/modules/call-records/call-record.schemas.js";
import type { CampaignDetail } from "../src/modules/campaigns/campaign.schemas.js";
import type { Contact } from "../src/modules/contacts/contact.schemas.js";
import { AuditService } from "../src/modules/audit/audit.service.js";
import { getRequestOrganizationId } from "../src/modules/auth/request-auth-context.js";
import type { BackendRepositories, VoiceCallSession } from "../src/repositories/backend-repositories.js";
import type { PlivoVoiceGateway } from "../src/modules/voice/plivo.client.js";
import { VoiceService } from "../src/modules/voice/voice.service.js";

const campaign: CampaignDetail = {
  id: "camp-voice-001",
  name: "KYC Verification",
  status: "active",
  language: "hindi",
  vertical: "banking",
  template: "banking workflow",
  workspace: "Workspace",
  callerIdentity: "Bhaarat Engage",
  summary: "Collect KYC details",
  contactCount: 1,
  completionRate: 0,
  answerRate: 0,
  confirmationRate: 0,
  createdAt: "2026-04-06T00:00:00.000Z",
  quietHours: "09:00 to 18:00 IST",
  transferQueue: "Priority Desk",
  sensitiveFieldCount: 1,
  sequence: ["Voice first"],
  fields: [
    {
      field_key: "full_name",
      label: "Full name",
      prompt: "Please confirm your full name.",
      type: "text",
      required: true,
      sensitive: false,
      verification_label: "Full name",
      retry_limit: 2,
      validation_rule: "",
    },
  ],
  setup: {
    campaignName: "KYC Verification",
    vertical: "banking",
    language: "hindi",
    callerIdentity: "Bhaarat Engage",
    introScript: "Namaste, this is Bhaarat Engage calling for KYC verification.",
    purposeStatement: "We need to confirm one KYC detail.",
    callingWindowStart: "09:00",
    callingWindowEnd: "18:00",
    transferEnabled: true,
    transferQueue: "Priority Desk",
  },
  journey: {
    unansweredAction: "sms",
    partialAction: "retry",
    retryWindowHours: 4,
    maxRetries: 3,
    concurrencyLimit: 10,
    pacingPerMinute: 5,
    csvSource: "voice-import.csv",
  },
};

const contact: Contact = {
  id: "contact-voice-001",
  name: "Asha Sharma",
  phone: "+919999999999",
  email: "asha@example.com",
  language: "hindi",
  status: "eligible",
  consent: true,
  workspace: "Workspace",
  source: "Manual",
};

const session: VoiceCallSession = {
  callRecordId: "call-voice-001",
  providerCallId: "plivo-call-001",
  campaignId: campaign.id,
  campaignName: campaign.name,
  contactId: contact.id,
  contactName: contact.name,
  phone: contact.phone,
  language: campaign.language,
  introPrompt: campaign.setup.introScript,
  purposeStatement: campaign.setup.purposeStatement,
  transferEnabled: campaign.setup.transferEnabled,
  transferQueue: campaign.setup.transferQueue,
  transferTarget: "+918000000106",
  transcriptMode: "restricted",
  fieldsCollected: 0,
  fieldsTotal: campaign.fields.length,
  fields: campaign.fields,
  collectedData: [],
};

function buildCallRecord(overrides: Partial<CallRecord> = {}): CallRecord {
  return {
    id: session.callRecordId,
    campaignId: campaign.id,
    campaignName: campaign.name,
    contactName: contact.name,
    phone: contact.phone,
    provider: "plivo",
    status: "completed",
    disposition: "data_collected",
    confirmed: true,
    duration: 32,
    startedAt: "2026-04-09T10:00:00.000Z",
    language: campaign.language,
    fieldsCollected: session.fieldsTotal,
    fieldsTotal: session.fieldsTotal,
    transcriptMode: session.transcriptMode,
    ...overrides,
  };
}

function createRepositoriesStub(overrides: {
  campaigns?: Partial<BackendRepositories["campaigns"]>;
  voice?: Partial<BackendRepositories["voice"]>;
} = {}) {
  return {
    campaigns: {
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
      ...overrides.campaigns,
    },
    contacts: {
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
    },
    voice: {
      resolveScope: async (input) => ({
        organizationId: "org-voice-001",
        campaignId: input.campaignId ?? campaign.id,
        contactId: input.contactId ?? contact.id,
      }),
      ensureCallSession: async () => session,
      appendTranscriptTurn: async () => undefined,
      upsertCollectedField: async () => ({
        fieldKey: "full_name",
        label: "Full name",
        value: "Asha Sharma",
        confidenceScore: 0.9,
        confirmed: false,
        masked: false,
      }),
      clearCollectedData: async () => undefined,
      updateCallStatus: async () => null,
      ...overrides.voice,
    },
  } satisfies Pick<BackendRepositories, "campaigns" | "contacts" | "voice">;
}

function createGatewayStub(overrides: Partial<PlivoVoiceGateway> = {}): PlivoVoiceGateway {
  return {
    createCall: async () => ({ requestUuid: "request-001" }),
    buildStreamXml: () => "<Response />",
    buildTransferXml: () => "<Response><Dial /></Response>",
    transferCall: async () => undefined,
    assertValidSignature: () => undefined,
    ...overrides,
  };
}

describe("voice service", () => {
  it("builds outbound callback URLs for a test call", async () => {
    const createCall = vi.fn(async () => ({ requestUuid: "request-123" }));
    const service = new VoiceService({
      repositories: createRepositoriesStub(),
      plivoGateway: createGatewayStub({ createCall }),
      publicBaseUrl: "https://voice.example.com",
    });

    const result = await service.startTestCall(campaign.id, contact.id);

    expect(result.requestUuid).toBe("request-123");
    expect(result.answerUrl).toBe(
      `https://voice.example.com/voice/plivo/answer?campaignId=${campaign.id}&contactId=${contact.id}&source=test`,
    );
    expect(result.statusUrl).toBe(
      `https://voice.example.com/voice/plivo/status?campaignId=${campaign.id}&contactId=${contact.id}&source=test`,
    );
    expect(createCall).toHaveBeenCalledWith({
      to: contact.phone,
      answerUrl: result.answerUrl,
      hangupUrl: result.statusUrl,
      callerName: campaign.callerIdentity,
    });
  });

  it("creates answer XML after ensuring the voice session", async () => {
    const ensureCallSession = vi.fn(async () => session);
    const buildStreamXml = vi.fn(() => "<Response><Stream /></Response>");
    const service = new VoiceService({
      repositories: createRepositoriesStub({
        voice: { ensureCallSession },
      }),
      plivoGateway: createGatewayStub({ buildStreamXml }),
      publicBaseUrl: "https://voice.example.com",
    });

    const xml = await service.buildAnswerXml({
      campaignId: campaign.id,
      contactId: contact.id,
      callUuid: session.providerCallId,
    });

    expect(xml).toContain("<Response>");
    expect(ensureCallSession).toHaveBeenCalledWith({
      campaignId: campaign.id,
      contactId: contact.id,
      providerCallId: session.providerCallId,
      provider: "plivo",
      startedAt: expect.any(String),
      transcriptMode: "restricted",
    });
    expect(buildStreamXml).toHaveBeenCalledWith({
      streamUrl: `wss://voice.example.com/voice/plivo/stream?campaignId=${campaign.id}&contactId=${contact.id}&callUuid=${session.providerCallId}`,
      introPrompt: session.introPrompt,
    });
  });

  it("resolves a voice organization scope before public callback work", async () => {
    const resolveScope = vi.fn(async () => ({
      organizationId: "org-voice-002",
      campaignId: campaign.id,
      contactId: contact.id,
    }));
    const ensureCallSession = vi.fn(async () => {
      expect(getRequestOrganizationId()).toBe("org-voice-002");
      return session;
    });

    const service = new VoiceService({
      repositories: createRepositoriesStub({
        voice: { resolveScope, ensureCallSession },
      }),
      plivoGateway: createGatewayStub(),
      publicBaseUrl: "https://voice.example.com",
    });

    await service.initializeStreamSession({
      campaignId: campaign.id,
      contactId: contact.id,
      callUuid: session.providerCallId,
    });

    expect(resolveScope).toHaveBeenCalledWith({
      campaignId: campaign.id,
      contactId: contact.id,
      providerCallId: session.providerCallId,
    });
    expect(ensureCallSession).toHaveBeenCalledTimes(1);
  });

  it("maps Plivo hangup statuses into internal call outcomes", async () => {
    const ensureCallSession = vi.fn(async () => session);
    const updateCallStatus = vi.fn(async () =>
      buildCallRecord({
        status: "no_answer",
        disposition: "no_answer",
        confirmed: false,
        fieldsCollected: 0,
      }),
    );
    const updateDialerContactDispatch = vi.fn(async () => true);
    const dispatch = vi.fn(async () => undefined);
    const service = new VoiceService({
      repositories: createRepositoriesStub({
        campaigns: {
          updateDialerContactDispatch,
        },
        voice: {
          ensureCallSession,
          updateCallStatus,
        },
      }),
      plivoGateway: createGatewayStub(),
      publicBaseUrl: "https://voice.example.com",
      journeyDispatcher: {
        dispatch,
      },
    });

    await service.processStatusCallback({
      campaignId: campaign.id,
      contactId: contact.id,
      callUuid: session.providerCallId,
      providerStatus: "no-answer",
      source: "scheduler",
      durationSeconds: 17,
      recordingUrl: "https://recordings.example.com/voice.wav",
    });

    expect(ensureCallSession).toHaveBeenCalledTimes(1);
    expect(updateCallStatus).toHaveBeenCalledWith({
      providerCallId: session.providerCallId,
      status: "no_answer",
      disposition: "no_answer",
      durationSeconds: 17,
      recordingUrl: "https://recordings.example.com/voice.wav",
      errorCode: undefined,
      answeredAt: undefined,
      endedAt: expect.any(String),
    });
    expect(updateDialerContactDispatch).toHaveBeenCalledWith({
      campaignId: campaign.id,
      contactId: contact.id,
      dispatchStatus: "no_answer",
      expectedCurrentStatus: "in_progress",
    });
    expect(dispatch).toHaveBeenCalledWith({
      organizationId: "org-voice-001",
      campaignId: campaign.id,
      contactId: contact.id,
      requestedAt: expect.any(String),
      action: "sms",
      outcome: "unanswered",
      callRecordId: session.callRecordId,
      retryWindowHours: campaign.journey.retryWindowHours,
      traceId: session.callRecordId,
    });
  });

  it("does not queue duplicate journey follow-ups once the dispatch state already left in-progress", async () => {
    const ensureCallSession = vi.fn(async () => session);
    const updateCallStatus = vi.fn(async () =>
      buildCallRecord({
        status: "no_answer",
        disposition: "no_answer",
        confirmed: false,
        fieldsCollected: 0,
      }),
    );
    const updateDialerContactDispatch = vi.fn(async () => false);
    const getById = vi.fn(async () => campaign);
    const dispatch = vi.fn(async () => undefined);
    const service = new VoiceService({
      repositories: createRepositoriesStub({
        campaigns: {
          getById,
          updateDialerContactDispatch,
        },
        voice: {
          ensureCallSession,
          updateCallStatus,
        },
      }),
      plivoGateway: createGatewayStub(),
      publicBaseUrl: "https://voice.example.com",
      journeyDispatcher: {
        dispatch,
      },
    });

    await service.processStatusCallback({
      campaignId: campaign.id,
      contactId: contact.id,
      callUuid: session.providerCallId,
      providerStatus: "no-answer",
      source: "scheduler",
      durationSeconds: 17,
    });

    expect(updateCallStatus).toHaveBeenCalledTimes(1);
    expect(updateDialerContactDispatch).toHaveBeenCalledWith({
      campaignId: campaign.id,
      contactId: contact.id,
      dispatchStatus: "no_answer",
      expectedCurrentStatus: "in_progress",
    });
    expect(getById).toHaveBeenCalledTimes(1);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("preserves partial call outcomes and schedules the configured follow-up action", async () => {
    const partialSession: VoiceCallSession = {
      ...session,
      fieldsCollected: 1,
      collectedData: [
        {
          fieldKey: "full_name",
          label: "Full name",
          rawValue: "Asha Sharma",
          maskedValue: "Asha Sharma",
          confidenceScore: 0.93,
          confirmed: false,
          sensitive: false,
        },
      ],
    };
    const ensureCallSession = vi.fn(async () => partialSession);
    const updateCallStatus = vi.fn(async () =>
      buildCallRecord({
        disposition: "partial_collection",
        confirmed: false,
        fieldsCollected: 1,
      }),
    );
    const updateDialerContactDispatch = vi.fn(async () => true);
    const dispatch = vi.fn(async () => undefined);
    const service = new VoiceService({
      repositories: createRepositoriesStub({
        campaigns: {
          getById: async () => ({
            ...campaign,
            journey: {
              ...campaign.journey,
              partialAction: "retry",
            },
          }),
          updateDialerContactDispatch,
        },
        voice: {
          ensureCallSession,
          updateCallStatus,
        },
      }),
      plivoGateway: createGatewayStub(),
      publicBaseUrl: "https://voice.example.com",
      journeyDispatcher: {
        dispatch,
      },
    });

    await service.processStatusCallback({
      campaignId: campaign.id,
      contactId: contact.id,
      callUuid: session.providerCallId,
      providerStatus: "completed",
      source: "retry",
      durationSeconds: 89,
    });

    expect(updateCallStatus).toHaveBeenCalledWith({
      providerCallId: session.providerCallId,
      status: "completed",
      disposition: "partial_collection",
      durationSeconds: 89,
      recordingUrl: undefined,
      errorCode: undefined,
      answeredAt: undefined,
      endedAt: expect.any(String),
    });
    expect(dispatch).toHaveBeenCalledWith({
      organizationId: "org-voice-001",
      campaignId: campaign.id,
      contactId: contact.id,
      requestedAt: expect.any(String),
      action: "retry",
      outcome: "partial",
      callRecordId: session.callRecordId,
      retryWindowHours: campaign.journey.retryWindowHours,
      traceId: session.callRecordId,
    });
    expect(updateDialerContactDispatch).toHaveBeenCalledWith({
      campaignId: campaign.id,
      contactId: contact.id,
      dispatchStatus: "completed",
      expectedCurrentStatus: "in_progress",
    });
  });

  it("builds transfer XML for a configured queue target", async () => {
    const buildTransferXml = vi.fn(() => "<Response><Dial><Number>+918000000106</Number></Dial></Response>");
    const service = new VoiceService({
      repositories: createRepositoriesStub(),
      plivoGateway: createGatewayStub({ buildTransferXml }),
      publicBaseUrl: "https://voice.example.com",
    });

    const xml = await service.buildTransferXml({
      callUuid: session.providerCallId,
    });

    expect(xml).toContain("<Dial>");
    expect(buildTransferXml).toHaveBeenCalledWith({
      announcement: expect.any(String),
      transferTarget: session.transferTarget,
    });
  });

  it("delegates webhook signature validation to the Plivo gateway", () => {
    const assertValidSignature = vi.fn(() => undefined);
    const service = new VoiceService({
      repositories: createRepositoriesStub(),
      plivoGateway: createGatewayStub({ assertValidSignature }),
      publicBaseUrl: "https://voice.example.com",
    });

    service.validateWebhookSignature({
      method: "POST",
      pathWithQuery: `/voice/plivo/status?campaignId=${campaign.id}&contactId=${contact.id}`,
      headers: {
        "x-plivo-signature-v2": "signature",
      },
      params: {
        campaignId: campaign.id,
        contactId: contact.id,
        CallUUID: session.providerCallId,
      },
    });

    expect(assertValidSignature).toHaveBeenCalledWith({
      method: "POST",
      url: `https://voice.example.com/voice/plivo/status?campaignId=${campaign.id}&contactId=${contact.id}`,
      headers: {
        "x-plivo-signature-v2": "signature",
      },
      params: {
        campaignId: campaign.id,
        contactId: contact.id,
        CallUUID: session.providerCallId,
      },
    });
  });

  it("transfers a live call through Plivo and marks the call as transferred", async () => {
    const transferCall = vi.fn(async () => undefined);
    const updateCallStatus = vi.fn(async () => null);
    const updateDialerContactDispatch = vi.fn(async () => true);
    const auditService = new AuditService({
      record: vi.fn(async () => undefined),
    });
    const recordIfPossible = vi.spyOn(auditService, "recordIfPossible");
    const service = new VoiceService({
      repositories: createRepositoriesStub({
        campaigns: {
          updateDialerContactDispatch,
        },
        voice: { updateCallStatus },
      }),
      plivoGateway: createGatewayStub({ transferCall }),
      auditService,
      publicBaseUrl: "https://voice.example.com",
    });

    const result = await service.transferToHuman({
      campaignId: campaign.id,
      contactId: contact.id,
      callUuid: session.providerCallId,
      reason: "caller_request",
    });

    expect(result.transferQueue).toBe(session.transferQueue);
    expect(transferCall).toHaveBeenCalledWith({
      callUuid: session.providerCallId,
      transferUrl: `https://voice.example.com/voice/plivo/transfer?callUuid=${session.providerCallId}`,
      transferMethod: "POST",
    });
    expect(updateCallStatus).toHaveBeenCalledWith({
      providerCallId: session.providerCallId,
      status: "transferred",
      disposition: "human_transfer",
      transcriptMode: session.transcriptMode,
    });
    expect(updateDialerContactDispatch).toHaveBeenCalledWith({
      campaignId: campaign.id,
      contactId: contact.id,
      dispatchStatus: "transferred",
      expectedCurrentStatus: "in_progress",
    });
    expect(recordIfPossible).toHaveBeenCalledWith({
      action: "Transferred call to human agent",
      entityType: "call_record",
      entityId: session.callRecordId,
      metadata: {
        displayName: "Asha Sharma \u2022 KYC Verification",
        transferQueue: session.transferQueue,
        transferReason: "caller_request",
      },
    });
  });
});
