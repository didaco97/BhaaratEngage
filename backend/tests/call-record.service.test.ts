import { describe, expect, it, vi } from "vitest";

import { defaultTestPrincipal } from "../src/modules/auth/auth.types.js";
import { runWithRequestPrincipal } from "../src/modules/auth/request-auth-context.js";
import { AuditService } from "../src/modules/audit/audit.service.js";
import { CallRecordService } from "../src/modules/call-records/call-record.service.js";
import type {
  CallRecord,
  CollectedField,
  TranscriptTurn,
} from "../src/modules/call-records/call-record.schemas.js";
import type { CallRecordRepository, SettingsRepository } from "../src/repositories/backend-repositories.js";

const record: CallRecord = {
  id: "call-001",
  campaignId: "camp-001",
  campaignName: "KYC Verification",
  contactName: "Asha Sharma",
  phone: "+919999999999",
  provider: "plivo",
  status: "completed",
  disposition: "verified",
  confirmed: true,
  duration: 96,
  startedAt: "2026-04-08T09:30:00.000Z",
  language: "hindi",
  fieldsCollected: 2,
  fieldsTotal: 2,
  transcriptMode: "restricted",
};

const rawTranscript: TranscriptTurn[] = [
  {
    speaker: "Bot",
    text: "Namaste",
  },
  {
    speaker: "User",
    text: "ABCDE1234F",
  },
];

const redactedTranscript: TranscriptTurn[] = [
  {
    speaker: "Bot",
    text: "Namaste",
  },
  {
    speaker: "User",
    text: "******234F",
  },
];

const collectedData: CollectedField[] = [
  {
    fieldKey: "pan_number",
    label: "PAN number",
    value: "******234F",
    confidenceScore: 0.94,
    confirmed: true,
    masked: true,
  },
];

function createRepositoryStub(overrides: Partial<CallRecordRepository> = {}): CallRecordRepository {
  return {
    list: async () => [record],
    getById: async () => record,
    getTranscript: async (_id, options) => (options?.view === "raw" ? rawTranscript : redactedTranscript),
    getCollectedData: async () => collectedData,
    getRecordingUrl: async () => "https://recordings.example.test/call-001.mp3",
    ...overrides,
  };
}

function createSettingsRepositoryStub(restrictFullTranscripts: boolean): Pick<SettingsRepository, "getSnapshot"> {
  return {
    getSnapshot: async () => ({
      workspaceSettings: {
        workspaceName: "Demo Workspace",
        defaultLanguage: "hindi",
        callingWindowStart: "09:00",
        callingWindowEnd: "21:00",
        dndChecksEnabled: true,
        quietHoursAutoPause: true,
        restrictFullTranscripts,
      },
      workspaces: [],
      teamMembers: [],
      securityControls: [],
      notificationPreferences: [],
      apiAccess: {
        maskedKey: "Not configured",
        webhook: {
          url: "https://example.invalid/webhook",
          events: ["integration.pending"],
        },
      },
      apiKeys: [],
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

describe("call record service audit logging", () => {
  it("records an audit event when exporting masked call records", async () => {
    const auditService = createAuditServiceStub();
    const service = new CallRecordService(createRepositoryStub(), auditService.service);

    const csv = await service.exportCsv({
      status: "completed",
      campaignId: "camp-001",
    });

    expect(csv).toContain("call-001");
    expect(auditService.recordIfPossible).toHaveBeenCalledWith({
      action: "Downloaded masked export",
      entityType: "call_record_export",
      entityId: "call-records-export",
      metadata: {
        displayName: "Call records export",
        exportedRows: 1,
        filters: {
          status: "completed",
          campaignId: "camp-001",
        },
      },
    });
  });

  it("records an audit event when viewing a restricted transcript", async () => {
    const auditService = createAuditServiceStub();
    const service = new CallRecordService(createRepositoryStub(), auditService.service, createSettingsRepositoryStub(true));

    const result = await runWithRequestPrincipal(
      {
        ...defaultTestPrincipal,
        role: "reviewer",
      },
      () => service.getTranscript(record.id),
    );

    expect(result).toEqual(rawTranscript);
    expect(auditService.recordIfPossible).toHaveBeenCalledWith({
      action: "Viewed restricted transcript",
      entityType: "call_record",
      entityId: record.id,
      metadata: {
        displayName: "Asha Sharma - KYC Verification",
      },
    });
  });

  it("downgrades restricted transcripts to a redacted view for non-review roles when policy is enabled", async () => {
    const auditService = createAuditServiceStub();
    const service = new CallRecordService(createRepositoryStub(), auditService.service, createSettingsRepositoryStub(true));

    const [listedRecords, transcript] = await runWithRequestPrincipal(
      {
        ...defaultTestPrincipal,
        role: "campaign_manager",
      },
      async () =>
        Promise.all([
          service.list({}),
          service.getTranscript(record.id),
        ]),
    );

    expect(listedRecords[0]?.transcriptMode).toBe("redacted");
    expect(transcript).toEqual(redactedTranscript);
    expect(auditService.recordIfPossible).toHaveBeenCalledWith({
      action: "Viewed redacted transcript",
      entityType: "call_record",
      entityId: record.id,
      metadata: {
        displayName: "Asha Sharma - KYC Verification",
      },
    });
  });

  it("defaults to a redacted transcript when no principal is present and policy is enabled", async () => {
    const auditService = createAuditServiceStub();
    const service = new CallRecordService(createRepositoryStub(), auditService.service, createSettingsRepositoryStub(true));

    const [listedRecords, transcript] = await Promise.all([
      service.list({}),
      service.getTranscript(record.id),
    ]);

    expect(listedRecords[0]?.transcriptMode).toBe("redacted");
    expect(transcript).toEqual(redactedTranscript);
    expect(auditService.recordIfPossible).toHaveBeenCalledWith({
      action: "Viewed redacted transcript",
      entityType: "call_record",
      entityId: record.id,
      metadata: {
        displayName: "Asha Sharma - KYC Verification",
      },
    });
  });

  it("records an audit event when viewing collected data", async () => {
    const auditService = createAuditServiceStub();
    const service = new CallRecordService(createRepositoryStub(), auditService.service);

    const result = await service.getCollectedData(record.id);

    expect(result).toEqual(collectedData);
    expect(auditService.recordIfPossible).toHaveBeenCalledWith({
      action: "Viewed collected data",
      entityType: "call_record",
      entityId: record.id,
      metadata: {
        displayName: "Asha Sharma - KYC Verification",
      },
    });
  });

  it("records an audit event when viewing a call recording", async () => {
    const auditService = createAuditServiceStub();
    const service = new CallRecordService(createRepositoryStub(), auditService.service);

    const result = await service.getRecordingUrl(record.id);

    expect(result).toBe("https://recordings.example.test/call-001.mp3");
    expect(auditService.recordIfPossible).toHaveBeenCalledWith({
      action: "Viewed call recording",
      entityType: "call_record",
      entityId: record.id,
      metadata: {
        displayName: "Asha Sharma - KYC Verification",
      },
    });
  });
});
