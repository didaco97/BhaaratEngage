import type { Role, TranscriptMode } from "../../domain/enums.js";
import { serializeCsv } from "../../lib/csv.js";
import { AppError } from "../../lib/http-errors.js";
import type {
  CallRecordListFilters,
  CallRecordRepository,
  SettingsRepository,
  TranscriptView,
} from "../../repositories/backend-repositories.js";
import { getRequestPrincipal } from "../auth/request-auth-context.js";
import type { AuditService } from "../audit/audit.service.js";
import type { CallRecord } from "./call-record.schemas.js";

const fullTranscriptRoles = new Set<Role>(["workspace_admin", "reviewer"]);

export class CallRecordService {
  public constructor(
    private readonly repository: CallRecordRepository,
    private readonly auditService?: AuditService,
    private readonly settingsRepository?: Pick<SettingsRepository, "getSnapshot">,
  ) {}

  private async loadWorkspaceTranscriptRestriction() {
    if (!this.settingsRepository) {
      return false;
    }

    const settingsSnapshot = await this.settingsRepository.getSnapshot();
    return settingsSnapshot.workspaceSettings.restrictFullTranscripts;
  }

  private resolveTranscriptAccess(input: {
    record: CallRecord;
    restrictFullTranscripts: boolean;
  }): {
    effectiveMode: TranscriptMode;
    view: TranscriptView;
    auditAction: string;
  } {
    const { record, restrictFullTranscripts } = input;

    if (record.transcriptMode !== "restricted") {
      return {
        effectiveMode: record.transcriptMode,
        view: "redacted",
        auditAction: "Viewed redacted transcript",
      };
    }

    const role = getRequestPrincipal()?.role;
    const canViewRestrictedTranscript = !restrictFullTranscripts || (role ? fullTranscriptRoles.has(role) : false);

    return canViewRestrictedTranscript
      ? {
          effectiveMode: "restricted",
          view: "raw",
          auditAction: "Viewed restricted transcript",
        }
      : {
          effectiveMode: "redacted",
          view: "redacted",
          auditAction: "Viewed redacted transcript",
        };
  }

  private async applyTranscriptPolicy(record: CallRecord) {
    const transcriptAccess = this.resolveTranscriptAccess({
      record,
      restrictFullTranscripts: await this.loadWorkspaceTranscriptRestriction(),
    });

    return {
      ...record,
      transcriptMode: transcriptAccess.effectiveMode,
    } satisfies CallRecord;
  }

  private async getStoredById(id: string) {
    const record = await this.repository.getById(id);

    if (!record) {
      throw new AppError(404, "call_record_not_found", `Call record ${id} was not found.`);
    }

    return record;
  }

  public async list(filters: CallRecordListFilters) {
    const [callRecords, restrictFullTranscripts] = await Promise.all([
      this.repository.list(filters),
      this.loadWorkspaceTranscriptRestriction(),
    ]);

    return callRecords.map((record) => ({
      ...record,
      transcriptMode: this.resolveTranscriptAccess({
        record,
        restrictFullTranscripts,
      }).effectiveMode,
    }));
  }

  public async exportCsv(filters: CallRecordListFilters) {
    const callRecords = await this.list(filters);
    await this.auditService?.recordIfPossible({
      action: "Downloaded masked export",
      entityType: "call_record_export",
      entityId: "call-records-export",
      metadata: {
        displayName: "Call records export",
        exportedRows: callRecords.length,
        filters,
      },
    });

    return serializeCsv(callRecords, [
      { header: "id", value: (record) => record.id },
      { header: "campaign_id", value: (record) => record.campaignId },
      { header: "campaign_name", value: (record) => record.campaignName },
      { header: "contact_name", value: (record) => record.contactName },
      { header: "phone", value: (record) => record.phone },
      { header: "provider", value: (record) => record.provider },
      { header: "status", value: (record) => record.status },
      { header: "disposition", value: (record) => record.disposition },
      { header: "confirmed", value: (record) => record.confirmed },
      { header: "duration_seconds", value: (record) => record.duration },
      { header: "started_at", value: (record) => record.startedAt },
      { header: "language", value: (record) => record.language },
      { header: "fields_collected", value: (record) => record.fieldsCollected },
      { header: "fields_total", value: (record) => record.fieldsTotal },
      { header: "transcript_mode", value: (record) => record.transcriptMode },
      { header: "error_code", value: (record) => record.errorCode },
    ]);
  }

  public async getById(id: string) {
    return this.applyTranscriptPolicy(await this.getStoredById(id));
  }

  public async getTranscript(id: string) {
    const [record, restrictFullTranscripts] = await Promise.all([
      this.getStoredById(id),
      this.loadWorkspaceTranscriptRestriction(),
    ]);
    const transcriptAccess = this.resolveTranscriptAccess({
      record,
      restrictFullTranscripts,
    });
    const transcript = await this.repository.getTranscript(id, {
      view: transcriptAccess.view,
    });

    if (!transcript) {
      throw new AppError(404, "transcript_not_found", `Transcript for call record ${id} was not found.`);
    }

    await this.auditService?.recordIfPossible({
      action: transcriptAccess.auditAction,
      entityType: "call_record",
      entityId: record.id,
      metadata: {
        displayName: `${record.contactName} - ${record.campaignName}`,
      },
    });

    return transcript;
  }

  public async getCollectedData(id: string) {
    const record = await this.getStoredById(id);
    const collectedData = await this.repository.getCollectedData(id);

    if (!collectedData) {
      throw new AppError(404, "collected_data_not_found", `Collected data for call record ${id} was not found.`);
    }

    await this.auditService?.recordIfPossible({
      action: "Viewed collected data",
      entityType: "call_record",
      entityId: record.id,
      metadata: {
        displayName: `${record.contactName} - ${record.campaignName}`,
      },
    });

    return collectedData;
  }

  public async getRecordingUrl(id: string) {
    const record = await this.getStoredById(id);
    const recordingUrl = await this.repository.getRecordingUrl(id);

    if (!recordingUrl) {
      throw new AppError(404, "recording_not_found", `Recording for call record ${id} was not found.`);
    }

    let parsedUrl: URL;

    try {
      parsedUrl = new URL(recordingUrl);
    } catch {
      throw new AppError(502, "invalid_recording_source", `Recording source for call record ${id} is invalid.`);
    }

    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      throw new AppError(502, "invalid_recording_source", `Recording source for call record ${id} is invalid.`);
    }

    await this.auditService?.recordIfPossible({
      action: "Viewed call recording",
      entityType: "call_record",
      entityId: record.id,
      metadata: {
        displayName: `${record.contactName} - ${record.campaignName}`,
      },
    });

    return parsedUrl.toString();
  }
}
