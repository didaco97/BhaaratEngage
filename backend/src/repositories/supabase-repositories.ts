import { createHash, randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

import { env } from "../config/env.js";
import type {
  CallStatus,
  CampaignStatus,
  ContactStatus,
  JourneyAction,
  JourneyStatus,
  Role,
  SupportedLanguage,
  TranscriptMode,
  Vertical,
} from "../domain/enums.js";
import { getSupabaseAdminClient } from "../db/supabase-admin.js";
import { AppError } from "../lib/http-errors.js";
import {
  buildComplianceAlerts as buildDerivedComplianceAlerts,
  buildTransferQueueSummaries,
} from "../lib/operational-metrics.js";
import { getRequestOrganizationId, getRequestPrincipal } from "../modules/auth/request-auth-context.js";
import {
  callRecordSchema,
  collectedFieldSchema,
  transcriptTurnSchema,
  type CallRecord,
  type CollectedField,
  type TranscriptTurn,
} from "../modules/call-records/call-record.schemas.js";
import {
  campaignDetailSchema,
  campaignSummarySchema,
  type CampaignDetail,
  type CampaignField,
  type CampaignSummary,
  type CreateCampaignRequest,
  type UpdateCampaignRequest,
} from "../modules/campaigns/campaign.schemas.js";
import { contactSchema, type Contact, type CreateContactRequest, type UpdateContactRequest } from "../modules/contacts/contact.schemas.js";
import {
  auditEventSchema,
  complianceAlertSchema,
  dashboardSnapshotSchema,
  dispositionBreakdownItemSchema,
  liveCampaignCardSchema,
  recentAttemptSchema,
  transferQueueSummarySchema,
  voiceThroughputPointSchema,
  type DashboardOverview,
  type DashboardSnapshot,
  type DispositionBreakdownItem,
  type VoiceThroughputPoint,
} from "../modules/dashboard/dashboard.schemas.js";
import { journeyMonitorSchema, type JourneyMonitor } from "../modules/journeys/journey.schemas.js";
import { formatJourneyNextCheckpoint } from "../modules/journeys/journey-read-model.js";
import {
  fieldDropoffSchema,
  providerPerformanceSchema,
  reportsSnapshotSchema,
  type FieldDropoff,
  type ProviderPerformance,
  type ReportsSnapshot,
} from "../modules/reports/report.schemas.js";
import {
  apiAccessConfigSchema,
  apiKeySummarySchema,
  createdApiKeySchema,
  notificationPreferenceSchema,
  securityControlSchema,
  settingsSnapshotSchema,
  teamMemberSchema,
  type ApiKeySummary,
  type CreateApiKeyRequest,
  type CreatedApiKey,
  type InviteTeamMemberRequest,
  workspaceInventorySchema,
  workspaceSettingsSchema,
  type ApiAccessConfig,
  type NotificationPreference,
  type NotificationPreferenceUpdate,
  type SecurityControl,
  type SettingsSnapshot,
  type TeamMember,
  type WebhookConfig,
  type WorkspaceInventory,
  type WorkspaceSettings,
} from "../modules/settings/settings.schemas.js";
import { decryptSensitiveValue, encryptSensitiveValue } from "../lib/sensitive-data.js";
import type {
  AuditRepository,
  AppendVoiceTranscriptTurnInput,
  BackendRepositories,
  CallRecordListFilters,
  CampaignPauseMode,
  CampaignContactDispatchState,
  CampaignDialerContact,
  CampaignListFilters,
  ContactListFilters,
  EnsureVoiceCallSessionInput,
  PreparedContactImport,
  PreparedContactImportRow,
  RecordAuditEventInput,
  ResolveVoiceScopeInput,
  SchedulerCampaign,
  SetCampaignStatusInput,
  TranscriptView,
  UpdateCampaignContactDispatchInput,
  UpsertVoiceCollectedFieldInput,
  UpdateVoiceCallStatusInput,
  VoiceCallSession,
  VoiceSessionCollectedField,
  VoiceScope,
} from "./backend-repositories.js";

interface QueryErrorLike {
  readonly message: string;
  readonly code?: string | null;
}

interface QueryResult<T> {
  readonly data: T | null;
  readonly error: QueryErrorLike | null;
}

interface CountResult {
  readonly count: number | null;
  readonly error: QueryErrorLike | null;
}

type QueryLike<T> = PromiseLike<QueryResult<T>>;
type CountLike = PromiseLike<CountResult>;

interface OrganizationRow {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly created_at: string;
}

interface WorkspaceSettingsRow {
  readonly organization_id: string;
  readonly workspace_name: string;
  readonly default_language: SupportedLanguage;
  readonly calling_window_start: string;
  readonly calling_window_end: string;
  readonly dnd_checks_enabled: boolean;
  readonly quiet_hours_auto_pause: boolean;
  readonly restrict_full_transcripts: boolean;
}

interface TransferQueueRow {
  readonly id: string;
  readonly name: string;
  readonly provider_queue_id?: string | null;
  readonly active_agents: number;
  readonly waiting_count: number;
  readonly current_sla_seconds: number;
}

interface CampaignRow {
  readonly id: string;
  readonly name: string;
  readonly status: CampaignStatus;
  readonly pause_mode: CampaignPauseMode | null;
  readonly language: SupportedLanguage;
  readonly vertical: Vertical;
  readonly template: string;
  readonly caller_identity: string;
  readonly summary: string;
  readonly purpose_statement: string;
  readonly intro_script: string;
  readonly launched_at: string | null;
  readonly calling_window_start: string;
  readonly calling_window_end: string;
  readonly transfer_enabled: boolean;
  readonly transfer_queue_id: string | null;
  readonly retry_window_hours: number;
  readonly max_retries: number;
  readonly concurrency_limit: number;
  readonly pacing_per_minute: number;
  readonly created_at: string;
}

interface CampaignFieldRow {
  readonly campaign_id: string;
  readonly field_key: string;
  readonly label: string;
  readonly prompt: string;
  readonly type: CampaignField["type"];
  readonly required: boolean;
  readonly sensitive: boolean;
  readonly verification_label: string;
  readonly retry_limit: number;
  readonly validation_rule: string;
  readonly ask_order: number;
}

interface CampaignJourneyRuleRow {
  readonly campaign_id: string;
  readonly unanswered_action: JourneyAction;
  readonly partial_action: JourneyAction;
  readonly retry_window_hours: number;
  readonly max_retries: number;
  readonly concurrency_limit: number;
  readonly pacing_per_minute: number;
  readonly csv_source: string;
  readonly next_checkpoint_at: string | null;
}

interface CampaignStatRow {
  readonly campaign_id: string;
  readonly contact_count: number | string;
  readonly completion_rate: number | string;
  readonly answer_rate: number | string;
  readonly confirmation_rate: number | string;
}

interface ContactRow {
  readonly id: string;
  readonly name: string;
  readonly phone: string;
  readonly email: string | null;
  readonly language: SupportedLanguage;
  readonly status: ContactStatus;
  readonly consent: boolean;
  readonly source: string;
  readonly last_contacted_at: string | null;
}

interface CampaignContactReferenceRow {
  readonly campaign_id: string;
  readonly contact_id: string;
  readonly added_at: string;
}

interface CampaignContactAssignmentRow extends CampaignContactReferenceRow {
  readonly priority: number;
  readonly status: string;
}

interface CallRecordRow {
  readonly id: string;
  readonly call_uuid?: string;
  readonly campaign_id: string;
  readonly contact_id: string | null;
  readonly transfer_queue_id?: string | null;
  readonly provider: string;
  readonly status: CallStatus;
  readonly disposition: string;
  readonly confirmed: boolean;
  readonly duration_seconds: number;
  readonly started_at: string;
  readonly ended_at?: string | null;
  readonly recording_url?: string | null;
  readonly transcript_mode: TranscriptMode;
  readonly fields_collected: number;
  readonly fields_total: number;
  readonly error_code: string | null;
}

interface TranscriptTurnRow {
  readonly speaker: TranscriptTurn["speaker"];
  readonly text_raw: string;
  readonly text_redacted: string;
  readonly created_at: string;
}

interface CollectedDataRow {
  readonly call_record_id: string;
  readonly campaign_id: string;
  readonly field_key: string;
  readonly raw_value_encrypted: string;
  readonly masked_value: string;
  readonly extracted_value: string;
  readonly confidence_score: number | string;
  readonly is_confirmed: boolean;
  readonly collected_at: string;
}

interface AuditLogRow {
  readonly id: string;
  readonly actor_id: string | null;
  readonly action: string;
  readonly entity_type: string;
  readonly entity_id: string;
  readonly metadata: unknown;
  readonly created_at: string;
}

interface ComplianceAlertRow {
  readonly title: string;
  readonly detail: string;
  readonly severity: "warning" | "risk" | "info";
}

interface DailyCallVolumeRow {
  readonly day: string;
  readonly calls: number;
  readonly answered: number;
  readonly completed: number;
}

interface DispositionBreakdownRow {
  readonly disposition: string;
  readonly total: number | string;
}

interface FieldDropoffRow {
  readonly field_key: string;
  readonly captured_count: number | string;
  readonly unconfirmed_count: number | string;
}

interface ProviderPerformanceRow {
  readonly provider: string;
  readonly day: string;
  readonly success_rate: number | string;
}

interface JourneyRow {
  readonly id: string;
  readonly campaign_id: string;
  readonly status: JourneyStatus;
  readonly sequence: unknown;
  readonly total_contacts: number;
  readonly processed: number;
  readonly success_rate: number | string;
  readonly retry_window_hours: number;
  readonly concurrency_limit: number;
  readonly pacing_per_minute: number;
  readonly next_checkpoint_at: string | null;
  readonly created_at: string;
}

interface UserProfileRow {
  readonly id: string;
  readonly organization_id?: string;
  readonly full_name: string;
  readonly email: string;
  readonly role: Role;
}

interface NotificationPreferenceRow {
  readonly key: string;
  readonly enabled: boolean;
}

interface ApiKeyRow {
  readonly id: string;
  readonly name: string;
  readonly key_prefix: string;
  readonly last_used_at: string | null;
  readonly created_at: string;
}

interface OutboundWebhookRow {
  readonly url: string;
  readonly events: unknown;
}

interface OrganizationContext {
  readonly organizationId: string;
  readonly organizationName: string;
  readonly organizationSlug: string;
  readonly workspaceName: string;
  readonly defaultLanguage: SupportedLanguage;
  readonly callingWindowStart: string;
  readonly callingWindowEnd: string;
}

interface OrganizationSelector {
  readonly organizationId?: string;
  readonly organizationSlug?: string;
}

const shortDateFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  timeZone: "Asia/Calcutta",
});

const shortTimeFormatter = new Intl.DateTimeFormat("en-IN", {
  hour: "2-digit",
  hour12: false,
  minute: "2-digit",
  timeZone: "Asia/Calcutta",
});

const notificationCatalog: Record<string, { label: string; detail: string }> = {
  campaign_launched: {
    label: "Campaign launched",
    detail: "Notify the team when a campaign starts processing contacts.",
  },
  campaign_completed: {
    label: "Campaign completed",
    detail: "Notify when all contacts have been processed and exports are ready.",
  },
  high_opt_out_rate: {
    label: "High opt-out rate",
    detail: "Alert the workspace when opt-out exceeds the configured threshold.",
  },
  provider_failure: {
    label: "Provider failure",
    detail: "Notify operations when a voice or messaging provider falls below target health.",
  },
  export_ready: {
    label: "Export ready",
    detail: "Send a message when a masked CSV export is available for download.",
  },
};

function maskApiKey(prefix: string) {
  return `${prefix}************************`;
}

function generateRawApiKey() {
  return `bv_live_${randomBytes(18).toString("hex")}`;
}

function hashApiKey(rawKey: string) {
  return createHash("sha256").update(rawKey).digest("hex");
}

async function readRows<T>(operation: QueryLike<T[]>, context: string): Promise<T[]> {
  const { data, error } = await operation;

  if (error) {
    throw new Error(`${context}: ${error.message}`);
  }

  return data ?? [];
}

async function readSingle<T>(operation: QueryLike<T>, context: string): Promise<T> {
  const { data, error } = await operation;

  if (error) {
    throw new Error(`${context}: ${error.message}`);
  }

  if (!data) {
    throw new Error(`${context}: no row returned.`);
  }

  return data;
}

async function readMaybeSingle<T>(operation: QueryLike<T>, context: string): Promise<T | null> {
  const { data, error } = await operation;

  if (error) {
    throw new Error(`${context}: ${error.message}`);
  }

  return data ?? null;
}

async function readCount(operation: CountLike, context: string): Promise<number> {
  const { count, error } = await operation;

  if (error) {
    throw new Error(`${context}: ${error.message}`);
  }

  return count ?? 0;
}

function normalizeQuery(value?: string) {
  return value?.trim().toLowerCase() ?? "";
}

function matchesQuery(query: string, fields: Array<string | undefined | null>) {
  if (!query) {
    return true;
  }

  return fields.some((field) => field?.toLowerCase().includes(query));
}

function toNumber(value: number | string | null | undefined) {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function roundToSingleDecimal(value: number) {
  return Number(value.toFixed(1));
}

function percentageOf(part: number, total: number) {
  if (total <= 0) {
    return 0;
  }

  return roundToSingleDecimal((part / total) * 100);
}

function normalizeTimeValue(value: string | null | undefined, fallback = "09:00") {
  if (!value) {
    return fallback;
  }

  const trimmed = value.trim();
  return trimmed.length >= 5 ? trimmed.slice(0, 5) : fallback;
}

function formatQuietHours(start: string | null | undefined, end: string | null | undefined) {
  return `${normalizeTimeValue(start)} to ${normalizeTimeValue(end)} IST`;
}

function formatShortDateLabel(value: string) {
  return shortDateFormatter.format(new Date(value)).replace(",", "");
}

function formatShortTimeLabel(value: string) {
  return `${shortTimeFormatter.format(new Date(value))} IST`;
}

function formatNextCheckpoint(value: string | null, status: JourneyStatus) {
  return formatJourneyNextCheckpoint({
    status,
    nextCheckpointAt: value,
    formatScheduledCheckpoint(nextCheckpointAt) {
      return `${formatShortDateLabel(nextCheckpointAt)} ${shortTimeFormatter.format(new Date(nextCheckpointAt))} IST`;
    },
  });
}

function toStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0);
}

function buildSequencePreview(rule?: CampaignJourneyRuleRow | null) {
  const sequence = ["Voice first"];

  if (!rule) {
    return sequence;
  }

  if (rule.unanswered_action === "sms") {
    sequence.push("SMS if unanswered");
  } else if (rule.unanswered_action === "whatsapp") {
    sequence.push("WhatsApp if unanswered");
  } else if (rule.unanswered_action === "retry") {
    sequence.push("Retry voice if unanswered");
  }

  if (rule.partial_action === "sms") {
    sequence.push("SMS if partial");
  } else if (rule.partial_action === "whatsapp") {
    sequence.push("WhatsApp if partial");
  } else if (rule.partial_action === "retry") {
    sequence.push("Retry voice if partial");
  }

  return sequence;
}

function buildCampaignDetail(input: {
  readonly row: CampaignRow;
  readonly workspaceName: string;
  readonly stats?: CampaignStatRow;
  readonly fields: CampaignField[];
  readonly journeyRule?: CampaignJourneyRuleRow | null;
  readonly transferQueue?: TransferQueueRow | null;
}): CampaignDetail {
  const { row, workspaceName, stats, fields, journeyRule, transferQueue } = input;
  const purposeStatement = row.purpose_statement || row.summary || row.name;
  const transferEnabled = row.transfer_enabled;
  const transferQueueName = transferEnabled ? transferQueue?.name ?? "Unassigned transfer queue" : "No transfer queue";

  return campaignDetailSchema.parse({
    id: row.id,
    name: row.name,
    status: row.status,
    language: row.language,
    vertical: row.vertical,
    template: row.template,
    workspace: workspaceName,
    callerIdentity: row.caller_identity,
    summary: row.summary || purposeStatement,
    contactCount: Math.round(toNumber(stats?.contact_count)),
    completionRate: roundToSingleDecimal(toNumber(stats?.completion_rate)),
    answerRate: roundToSingleDecimal(toNumber(stats?.answer_rate)),
    confirmationRate: roundToSingleDecimal(toNumber(stats?.confirmation_rate)),
    createdAt: row.created_at,
    launchedAt: row.launched_at ?? undefined,
    quietHours: formatQuietHours(row.calling_window_start, row.calling_window_end),
    transferQueue: transferQueueName,
    sensitiveFieldCount: fields.filter((field) => field.sensitive).length,
    sequence: buildSequencePreview(journeyRule),
    fields,
    setup: {
      campaignName: row.name,
      vertical: row.vertical,
      language: row.language,
      callerIdentity: row.caller_identity,
      introScript: row.intro_script,
      purposeStatement,
      callingWindowStart: normalizeTimeValue(row.calling_window_start),
      callingWindowEnd: normalizeTimeValue(row.calling_window_end, "21:00"),
      transferEnabled,
      transferQueue: transferEnabled ? transferQueue?.name ?? "" : "",
    },
    journey: {
      unansweredAction: journeyRule?.unanswered_action ?? "none",
      partialAction: journeyRule?.partial_action ?? "none",
      retryWindowHours: journeyRule?.retry_window_hours ?? row.retry_window_hours,
      maxRetries: journeyRule?.max_retries ?? row.max_retries,
      concurrencyLimit: journeyRule?.concurrency_limit ?? row.concurrency_limit,
      pacingPerMinute: journeyRule?.pacing_per_minute ?? row.pacing_per_minute,
      csvSource: journeyRule?.csv_source ?? "Manual upload",
    },
  });
}

function buildZeroVoiceThroughputPoint(): VoiceThroughputPoint {
  const now = new Date().toISOString();

  return voiceThroughputPointSchema.parse({
    date: formatShortDateLabel(now),
    calls: 0,
    answered: 0,
    completed: 0,
  });
}

function buildEmptyDispositionBreakdown(): DispositionBreakdownItem[] {
  return [
    dispositionBreakdownItemSchema.parse({
      name: "No calls",
      value: 100,
      fill: "hsl(var(--muted-foreground))",
    }),
  ];
}

function dispositionFill(disposition: string) {
  switch (disposition) {
    case "data_collected":
      return "hsl(var(--chart-1))";
    case "partial_collection":
      return "hsl(var(--chart-2))";
    case "no_answer":
      return "hsl(var(--chart-3))";
    case "human_transfer":
      return "hsl(var(--chart-4))";
    case "network_error":
      return "hsl(var(--chart-5))";
    case "opted_out":
      return "hsl(var(--muted-foreground))";
    default:
      return "hsl(var(--chart-2))";
  }
}

function formatDispositionName(disposition: string) {
  return disposition
    .split("_")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function extractAuditEntity(metadata: unknown, fallback: string) {
  if (metadata && typeof metadata === "object") {
    const displayName = (metadata as Record<string, unknown>).displayName;
    const entityName = (metadata as Record<string, unknown>).entityName;

    if (typeof displayName === "string" && displayName.trim()) {
      return displayName;
    }

    if (typeof entityName === "string" && entityName.trim()) {
      return entityName;
    }
  }

  return fallback;
}

function mergeComplianceAlertLists(
  manualAlerts: ReadonlyArray<{
    readonly title: string;
    readonly detail: string;
    readonly severity: "warning" | "risk" | "info";
  }>,
  derivedAlerts: ReadonlyArray<{
    readonly title: string;
    readonly detail: string;
    readonly severity: "warning" | "risk" | "info";
  }>,
) {
  const mergedAlerts = [...derivedAlerts];

  for (const alert of manualAlerts) {
    if (!mergedAlerts.some((entry) => entry.title === alert.title && entry.detail === alert.detail)) {
      mergedAlerts.push(alert);
    }
  }

  return mergedAlerts.slice(0, 5);
}

class OrganizationContextResolver {
  private readonly client: SupabaseClient;
  private readonly cachedContextByKey = new Map<string, Promise<OrganizationContext>>();

  public constructor(client: SupabaseClient) {
    this.client = client;
  }

  public getContext() {
    const selector = this.resolveSelector();
    const cacheKey = selector.organizationId
      ? `organization:${selector.organizationId}`
      : selector.organizationSlug
        ? `slug:${selector.organizationSlug}`
        : "__default__";
    const cachedContext = this.cachedContextByKey.get(cacheKey);

    if (cachedContext) {
      return cachedContext;
    }

    const contextPromise = this.loadContext(selector).catch((error: unknown) => {
      this.cachedContextByKey.delete(cacheKey);
      throw error;
    });
    this.cachedContextByKey.set(cacheKey, contextPromise);
    return contextPromise;
  }

  public invalidate() {
    this.cachedContextByKey.clear();
  }

  private resolveSelector(): OrganizationSelector {
    const requestOrganizationId = getRequestOrganizationId();

    if (requestOrganizationId) {
      return { organizationId: requestOrganizationId };
    }

    if (env.DEFAULT_ORGANIZATION_ID) {
      return { organizationId: env.DEFAULT_ORGANIZATION_ID };
    }

    if (env.DEFAULT_ORGANIZATION_SLUG) {
      return { organizationSlug: env.DEFAULT_ORGANIZATION_SLUG };
    }

    return {};
  }

  private async loadContext(selector: OrganizationSelector): Promise<OrganizationContext> {
    const organization = await this.loadOrganization(selector);
    const workspaceSettings = await readMaybeSingle<WorkspaceSettingsRow>(
      this.client
        .from("workspace_settings")
        .select("organization_id, workspace_name, default_language, calling_window_start, calling_window_end, dnd_checks_enabled, quiet_hours_auto_pause, restrict_full_transcripts")
        .eq("organization_id", organization.id)
        .maybeSingle(),
      "Failed to resolve workspace settings",
    );

    return {
      organizationId: organization.id,
      organizationName: organization.name,
      organizationSlug: organization.slug,
      workspaceName: workspaceSettings?.workspace_name ?? organization.name,
      defaultLanguage: workspaceSettings?.default_language ?? "english",
      callingWindowStart: normalizeTimeValue(workspaceSettings?.calling_window_start, "09:00"),
      callingWindowEnd: normalizeTimeValue(workspaceSettings?.calling_window_end, "21:00"),
    };
  }

  private async loadOrganization(selector: OrganizationSelector) {
    if (selector.organizationId) {
      return readSingle<OrganizationRow>(
        this.client
          .from("organizations")
          .select("id, name, slug, created_at")
          .eq("id", selector.organizationId)
          .single(),
        "Failed to load default organization by id",
      );
    }

    if (selector.organizationSlug) {
      return readSingle<OrganizationRow>(
        this.client
          .from("organizations")
          .select("id, name, slug, created_at")
          .eq("slug", selector.organizationSlug)
          .single(),
        "Failed to load default organization by slug",
      );
    }

    const organizations = await readRows<OrganizationRow>(
      this.client
        .from("organizations")
        .select("id, name, slug, created_at")
        .order("created_at", { ascending: true })
        .limit(1),
      "Failed to load organizations",
    );

    const organization = organizations[0];

    if (!organization) {
      throw new Error("No organizations exist in Supabase. Seed a workspace before starting the backend in supabase mode.");
    }

    return organization;
  }
}

export function createSupabaseRepositories(client: SupabaseClient = getSupabaseAdminClient()): BackendRepositories {
  const contextResolver = new OrganizationContextResolver(client);

  const getContext = () => contextResolver.getContext();

  async function loadTransferQueueMap(queueIds: string[]) {
    if (queueIds.length === 0) {
      return new Map<string, TransferQueueRow>();
    }

    const context = await getContext();
    const rows = await readRows<TransferQueueRow>(
      client
        .from("transfer_queues")
        .select("id, name, provider_queue_id, active_agents, waiting_count, current_sla_seconds")
        .eq("organization_id", context.organizationId)
        .in("id", queueIds),
      "Failed to load transfer queues",
    );

    return new Map(rows.map((row) => [row.id, row] as const));
  }

  async function loadCampaignTransferTarget(campaignId: string) {
    const context = await getContext();
    const campaignRow = await readMaybeSingle<Pick<CampaignRow, "transfer_queue_id">>(
      client
        .from("campaigns")
        .select("transfer_queue_id")
        .eq("organization_id", context.organizationId)
        .eq("id", campaignId)
        .maybeSingle(),
      "Failed to resolve the campaign transfer queue",
    );

    if (!campaignRow?.transfer_queue_id) {
      return null;
    }

    const queueRow = await readMaybeSingle<Pick<TransferQueueRow, "provider_queue_id">>(
      client
        .from("transfer_queues")
        .select("provider_queue_id")
        .eq("organization_id", context.organizationId)
        .eq("id", campaignRow.transfer_queue_id)
        .maybeSingle(),
      "Failed to resolve the transfer queue target",
    );

    return queueRow?.provider_queue_id?.trim() || null;
  }

  async function loadCampaignFieldsMap(campaignIds: string[]) {
    if (campaignIds.length === 0) {
      return new Map<string, CampaignField[]>();
    }

    const rows = await readRows<CampaignFieldRow>(
      client
        .from("campaign_fields")
        .select("campaign_id, field_key, label, prompt, type, required, sensitive, verification_label, retry_limit, validation_rule, ask_order")
        .in("campaign_id", campaignIds)
        .order("ask_order", { ascending: true }),
      "Failed to load campaign fields",
    );

    const fieldsByCampaignId = new Map<string, CampaignField[]>();

    for (const row of rows) {
      const existing = fieldsByCampaignId.get(row.campaign_id) ?? [];
      existing.push({
        field_key: row.field_key,
        label: row.label,
        prompt: row.prompt,
        type: row.type,
        required: row.required,
        sensitive: row.sensitive,
        verification_label: row.verification_label ?? "",
        retry_limit: row.retry_limit,
        validation_rule: row.validation_rule ?? "",
      });
      fieldsByCampaignId.set(row.campaign_id, existing);
    }

    return fieldsByCampaignId;
  }

  async function loadCampaignJourneyRuleMap(campaignIds: string[]) {
    if (campaignIds.length === 0) {
      return new Map<string, CampaignJourneyRuleRow>();
    }

    const rows = await readRows<CampaignJourneyRuleRow>(
      client
        .from("campaign_journey_rules")
        .select("campaign_id, unanswered_action, partial_action, retry_window_hours, max_retries, concurrency_limit, pacing_per_minute, csv_source, next_checkpoint_at")
        .in("campaign_id", campaignIds),
      "Failed to load campaign journey rules",
    );

    return new Map(rows.map((row) => [row.campaign_id, row] as const));
  }

  async function loadCampaignStatsMap(campaignIds: string[]) {
    if (campaignIds.length === 0) {
      return new Map<string, CampaignStatRow>();
    }

    const rows = await readRows<CampaignStatRow>(
      client
        .from("campaign_stats_view")
        .select("campaign_id, contact_count, completion_rate, answer_rate, confirmation_rate")
        .in("campaign_id", campaignIds),
      "Failed to load campaign stats",
    );

    return new Map(rows.map((row) => [row.campaign_id, row] as const));
  }

  async function loadOrganizationCampaignIdSet(campaignIds: string[]) {
    const uniqueCampaignIds = [...new Set(campaignIds)];

    if (uniqueCampaignIds.length === 0) {
      return new Set<string>();
    }

    const context = await getContext();
    const rows = await readRows<Pick<CampaignRow, "id">>(
      client
        .from("campaigns")
        .select("id")
        .eq("organization_id", context.organizationId)
        .is("deleted_at", null)
        .in("id", uniqueCampaignIds),
      "Failed to validate campaign ownership",
    );

    return new Set(rows.map((row) => row.id));
  }

  async function loadCampaignRows(filters: CampaignListFilters = {}) {
    const context = await getContext();
    let query = client
      .from("campaigns")
      .select(
        "id, name, status, pause_mode, language, vertical, template, caller_identity, summary, purpose_statement, intro_script, launched_at, calling_window_start, calling_window_end, transfer_enabled, transfer_queue_id, retry_window_hours, max_retries, concurrency_limit, pacing_per_minute, created_at",
      )
      .eq("organization_id", context.organizationId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (filters.status && filters.status !== "all") {
      query = query.eq("status", filters.status);
    }

    return readRows<CampaignRow>(query, "Failed to load campaigns");
  }

  async function buildCampaignDetails(rows: CampaignRow[]) {
    const context = await getContext();
    const campaignIds = rows.map((row) => row.id);
    const queueIds = rows.map((row) => row.transfer_queue_id).filter((value): value is string => Boolean(value));
    const [statsByCampaignId, fieldsByCampaignId, journeyRuleByCampaignId, transferQueueById] = await Promise.all([
      loadCampaignStatsMap(campaignIds),
      loadCampaignFieldsMap(campaignIds),
      loadCampaignJourneyRuleMap(campaignIds),
      loadTransferQueueMap(queueIds),
    ]);

    return rows.map((row) => {
      const stats = statsByCampaignId.get(row.id);
      const fields = fieldsByCampaignId.get(row.id) ?? [];
      const journeyRule = journeyRuleByCampaignId.get(row.id);
      const transferQueue = row.transfer_queue_id ? transferQueueById.get(row.transfer_queue_id) : null;

      return buildCampaignDetail({
        row,
        workspaceName: context.workspaceName,
        stats,
        fields,
        journeyRule,
        transferQueue,
      });
    });
  }

  async function buildCampaignSummaries(rows: CampaignRow[]) {
    const details = await buildCampaignDetails(rows);
    return details.map((detail) => campaignSummarySchema.parse(detail));
  }

  async function buildSchedulerCampaigns(rows: CampaignRow[]) {
    const statsByCampaignId = await loadCampaignStatsMap(rows.map((row) => row.id));

    return rows.map<SchedulerCampaign>((row) => ({
      id: row.id,
      name: row.name,
      status: row.status,
      contactCount: Math.round(toNumber(statsByCampaignId.get(row.id)?.contact_count)),
      callingWindowStart: normalizeTimeValue(row.calling_window_start),
      callingWindowEnd: normalizeTimeValue(row.calling_window_end, "21:00"),
      pauseMode: row.pause_mode ?? null,
    }));
  }

  async function loadCampaignDetailById(id: string) {
    const context = await getContext();
    const row = await readMaybeSingle<CampaignRow>(
      client
        .from("campaigns")
        .select(
          "id, name, status, pause_mode, language, vertical, template, caller_identity, summary, purpose_statement, intro_script, launched_at, calling_window_start, calling_window_end, transfer_enabled, transfer_queue_id, retry_window_hours, max_retries, concurrency_limit, pacing_per_minute, created_at",
        )
        .eq("organization_id", context.organizationId)
        .is("deleted_at", null)
        .eq("id", id)
        .maybeSingle(),
      "Failed to load campaign",
    );

    if (!row) {
      return null;
    }

    const details = await buildCampaignDetails([row]);
    return details[0] ?? null;
  }

  async function ensureTransferQueueId(name: string, organizationId: string) {
    const trimmedName = name.trim();

    if (!trimmedName) {
      return null;
    }

    const existing = await readMaybeSingle<Pick<TransferQueueRow, "id" | "name">>(
      client
        .from("transfer_queues")
        .select("id, name")
        .eq("organization_id", organizationId)
        .eq("name", trimmedName)
        .maybeSingle(),
      "Failed to load transfer queue",
    );

    if (existing) {
      return existing.id;
    }

    const created = await readSingle<{ id: string }>(
      client
        .from("transfer_queues")
        .insert({
          organization_id: organizationId,
          name: trimmedName,
        })
        .select("id")
        .single(),
      "Failed to create transfer queue",
    );

    return created.id;
  }

  async function ensureJourneyRow(campaignId: string, status: CampaignStatus) {
    if (status !== "active" && status !== "paused" && status !== "completed") {
      return;
    }

    const context = await getContext();
    const [existingJourney, campaignStats, journeyRule, campaignConfig, contactCount, processedContactCount] = await Promise.all([
      readMaybeSingle<Pick<JourneyRow, "id" | "processed">>(
        client
          .from("journeys")
          .select("id, processed")
          .eq("organization_id", context.organizationId)
          .eq("campaign_id", campaignId)
          .maybeSingle(),
        "Failed to load journey row",
      ),
      readMaybeSingle<CampaignStatRow>(
        client
          .from("campaign_stats_view")
          .select("campaign_id, contact_count, completion_rate, answer_rate, confirmation_rate")
          .eq("campaign_id", campaignId)
          .maybeSingle(),
        "Failed to load campaign stats for journey sync",
      ),
      readMaybeSingle<CampaignJourneyRuleRow>(
        client
          .from("campaign_journey_rules")
          .select("campaign_id, unanswered_action, partial_action, retry_window_hours, max_retries, concurrency_limit, pacing_per_minute, csv_source, next_checkpoint_at")
          .eq("campaign_id", campaignId)
          .maybeSingle(),
        "Failed to load campaign journey rule for journey sync",
      ),
      readMaybeSingle<Pick<CampaignRow, "retry_window_hours" | "concurrency_limit" | "pacing_per_minute">>(
        client
          .from("campaigns")
          .select("retry_window_hours, concurrency_limit, pacing_per_minute")
          .eq("organization_id", context.organizationId)
          .eq("id", campaignId)
          .maybeSingle(),
        "Failed to load campaign fallback config for journey sync",
      ),
      readCount(
        client
          .from("campaign_contacts")
          .select("id", { count: "exact", head: true })
          .eq("campaign_id", campaignId),
        "Failed to count campaign contacts",
      ),
      readCount(
        client
          .from("campaign_contacts")
          .select("id", { count: "exact", head: true })
          .eq("campaign_id", campaignId)
          .neq("status", "pending"),
        "Failed to count processed campaign contacts",
      ),
    ]);

    const payload = {
      organization_id: context.organizationId,
      campaign_id: campaignId,
      status: (status === "completed" ? "completed" : status) as JourneyStatus,
      sequence: buildSequencePreview(journeyRule),
      total_contacts: contactCount || Math.round(toNumber(campaignStats?.contact_count)),
      processed: Math.max(existingJourney?.processed ?? 0, processedContactCount),
      success_rate: roundToSingleDecimal(toNumber(campaignStats?.completion_rate)),
      retry_window_hours: journeyRule?.retry_window_hours ?? campaignConfig?.retry_window_hours ?? 4,
      concurrency_limit: journeyRule?.concurrency_limit ?? campaignConfig?.concurrency_limit ?? 50,
      pacing_per_minute: journeyRule?.pacing_per_minute ?? campaignConfig?.pacing_per_minute ?? 20,
      next_checkpoint_at: journeyRule?.next_checkpoint_at ?? null,
    };

    if (existingJourney) {
      await readSingle(
        client
          .from("journeys")
          .update(payload)
          .eq("id", existingJourney.id)
          .select("id")
          .single(),
        "Failed to update journey row",
      );

      return;
    }

    await readSingle(client.from("journeys").insert(payload).select("id").single(), "Failed to create journey row");
  }

  async function loadCampaignStatusById(campaignId: string) {
    const context = await getContext();
    return readMaybeSingle<Pick<CampaignRow, "status">>(
      client
        .from("campaigns")
        .select("status")
        .eq("organization_id", context.organizationId)
        .is("deleted_at", null)
        .eq("id", campaignId)
        .maybeSingle(),
      "Failed to load campaign status",
    );
  }

  async function loadPrimaryCampaignAssignmentByContactId(contactIds: string[]) {
    if (contactIds.length === 0) {
      return new Map<string, string>();
    }

    const rows = await readRows<CampaignContactReferenceRow>(
      client
        .from("campaign_contacts")
        .select("campaign_id, contact_id, added_at")
        .in("contact_id", contactIds)
        .order("added_at", { ascending: false }),
      "Failed to load campaign contact assignments",
    );
    const activeCampaignIds = await loadOrganizationCampaignIdSet(rows.map((row) => row.campaign_id));

    const assignmentByContactId = new Map<string, string>();

    for (const row of rows) {
      if (!activeCampaignIds.has(row.campaign_id)) {
        continue;
      }

      if (!assignmentByContactId.has(row.contact_id)) {
        assignmentByContactId.set(row.contact_id, row.campaign_id);
      }
    }

    return assignmentByContactId;
  }

  async function loadContactsByIds(
    contactIds: string[],
    filters: ContactListFilters = {},
    assignmentByContactIdOverride?: Map<string, string>,
  ) {
    const uniqueContactIds = [...new Set(contactIds)];

    if (uniqueContactIds.length === 0) {
      return [];
    }

    const context = await getContext();
    let query = client
      .from("contacts")
      .select("id, name, phone, email, language, status, consent, source, last_contacted_at")
      .eq("organization_id", context.organizationId)
      .in("id", uniqueContactIds);

    if (filters.status && filters.status !== "all") {
      query = query.eq("status", filters.status);
    }

    const rows = await readRows<ContactRow>(query, "Failed to load contacts by id");
    const assignmentByContactId = assignmentByContactIdOverride ?? (await loadPrimaryCampaignAssignmentByContactId(rows.map((row) => row.id)));
    const normalizedQuery = normalizeQuery(filters.search);
    const contactsById = new Map(
      rows.map((row) => [
        row.id,
        contactSchema.parse({
          id: row.id,
          name: row.name,
          phone: row.phone,
          email: row.email ?? undefined,
          language: row.language,
          status: row.status,
          consent: row.consent,
          campaignId: assignmentByContactId.get(row.id),
          workspace: context.workspaceName,
          source: row.source,
          lastContactedAt: row.last_contacted_at ?? undefined,
        }),
      ] as const),
    );

    return uniqueContactIds
      .map((contactId) => contactsById.get(contactId))
      .filter((contact): contact is Contact => Boolean(contact))
      .filter((contact) => matchesQuery(normalizedQuery, [contact.name, contact.phone, contact.workspace, contact.source]));
  }

  async function loadCampaignContacts(campaignId: string, filters: ContactListFilters = {}) {
    const rows = await readRows<CampaignContactAssignmentRow>(
      client
        .from("campaign_contacts")
        .select("campaign_id, contact_id, priority, status, added_at")
        .eq("campaign_id", campaignId)
        .order("priority", { ascending: true })
        .order("added_at", { ascending: true }),
      "Failed to load campaign contacts",
    );
    const contactIds = [...new Set(rows.map((row) => row.contact_id))];
    const assignmentByContactId = new Map(contactIds.map((contactId) => [contactId, campaignId] as const));

    return loadContactsByIds(contactIds, filters, assignmentByContactId);
  }

  async function loadDialerContacts(campaignId: string): Promise<CampaignDialerContact[]> {
    const rows = await readRows<CampaignContactAssignmentRow>(
      client
        .from("campaign_contacts")
        .select("campaign_id, contact_id, priority, status, added_at")
        .eq("campaign_id", campaignId)
        .order("priority", { ascending: true })
        .order("added_at", { ascending: true }),
      "Failed to load dialer campaign contacts",
    );
    const contactIds = [...new Set(rows.map((row) => row.contact_id))];
    const assignmentByContactId = new Map(contactIds.map((contactId) => [contactId, campaignId] as const));
    const contacts = await loadContactsByIds(contactIds, { status: "all" }, assignmentByContactId);
    const contactsById = new Map(contacts.map((contact) => [contact.id, contact] as const));

    return rows
      .map((row) => {
        const contact = contactsById.get(row.contact_id);

        if (!contact) {
          return null;
        }

        return {
          contact,
          priority: row.priority,
          dispatchStatus: row.status as CampaignContactDispatchState,
        } satisfies CampaignDialerContact;
      })
      .filter((contact): contact is CampaignDialerContact => Boolean(contact));
  }

  async function syncJourneysForCampaignIds(campaignIds: string[]) {
    const uniqueCampaignIds = [...new Set(campaignIds)];

    if (uniqueCampaignIds.length === 0) {
      return;
    }

    const context = await getContext();
    const rows = await readRows<Pick<CampaignRow, "id" | "status">>(
      client
        .from("campaigns")
        .select("id, status")
        .eq("organization_id", context.organizationId)
        .is("deleted_at", null)
        .in("id", uniqueCampaignIds),
      "Failed to load campaigns for journey sync",
    );

    await Promise.all(rows.map(async (row) => ensureJourneyRow(row.id, row.status)));
  }

  async function loadContacts(filters: ContactListFilters = {}) {
    const context = await getContext();
    let query = client
      .from("contacts")
      .select("id, name, phone, email, language, status, consent, source, last_contacted_at")
      .eq("organization_id", context.organizationId)
      .order("created_at", { ascending: false });

    if (filters.status && filters.status !== "all") {
      query = query.eq("status", filters.status);
    }

    const rows = await readRows<ContactRow>(query, "Failed to load contacts");
    const assignmentByContactId = await loadPrimaryCampaignAssignmentByContactId(rows.map((row) => row.id));
    const normalizedQuery = normalizeQuery(filters.search);

    return rows
      .map((row) =>
        contactSchema.parse({
          id: row.id,
          name: row.name,
          phone: row.phone,
          email: row.email ?? undefined,
          language: row.language,
          status: row.status,
          consent: row.consent,
          campaignId: assignmentByContactId.get(row.id),
          workspace: context.workspaceName,
          source: row.source,
          lastContactedAt: row.last_contacted_at ?? undefined,
        }),
      )
      .filter((contact) => matchesQuery(normalizedQuery, [contact.name, contact.phone, contact.workspace, contact.source]));
  }

  async function loadContactById(id: string) {
    const context = await getContext();
    const row = await readMaybeSingle<ContactRow>(
      client
        .from("contacts")
        .select("id, name, phone, email, language, status, consent, source, last_contacted_at")
        .eq("organization_id", context.organizationId)
        .eq("id", id)
        .maybeSingle(),
      "Failed to load contact by id",
    );

    if (!row) {
      return null;
    }

    const assignmentByContactId = await loadPrimaryCampaignAssignmentByContactId([row.id]);

    return contactSchema.parse({
      id: row.id,
      name: row.name,
      phone: row.phone,
      email: row.email ?? undefined,
      language: row.language,
      status: row.status,
      consent: row.consent,
      campaignId: assignmentByContactId.get(row.id),
      workspace: context.workspaceName,
      source: row.source,
      lastContactedAt: row.last_contacted_at ?? undefined,
    });
  }

  async function loadContactByPhone(phone: string) {
    const context = await getContext();
    const row = await readMaybeSingle<ContactRow>(
      client
        .from("contacts")
        .select("id, name, phone, email, language, status, consent, source, last_contacted_at")
        .eq("organization_id", context.organizationId)
        .eq("phone", phone)
        .maybeSingle(),
      "Failed to load contact by phone",
    );

    if (!row) {
      return null;
    }

    const assignmentByContactId = await loadPrimaryCampaignAssignmentByContactId([row.id]);

    return contactSchema.parse({
      id: row.id,
      name: row.name,
      phone: row.phone,
      email: row.email ?? undefined,
      language: row.language,
      status: row.status,
      consent: row.consent,
      campaignId: assignmentByContactId.get(row.id),
      workspace: context.workspaceName,
      source: row.source,
      lastContactedAt: row.last_contacted_at ?? undefined,
    });
  }

  async function loadCampaignNameMap(campaignIds: string[]) {
    if (campaignIds.length === 0) {
      return new Map<string, string>();
    }

    const context = await getContext();
    const rows = await readRows<Pick<CampaignRow, "id" | "name">>(
      client
        .from("campaigns")
        .select("id, name")
        .eq("organization_id", context.organizationId)
        .is("deleted_at", null)
        .in("id", campaignIds),
      "Failed to load campaign names",
    );

    return new Map(rows.map((row) => [row.id, row.name] as const));
  }

  async function loadContactMap(contactIds: string[]) {
    if (contactIds.length === 0) {
      return new Map<string, ContactRow>();
    }

    const context = await getContext();
    const rows = await readRows<ContactRow>(
      client
        .from("contacts")
        .select("id, name, phone, email, language, status, consent, source, last_contacted_at")
        .eq("organization_id", context.organizationId)
        .in("id", contactIds),
      "Failed to load contacts for call records",
    );

    return new Map(rows.map((row) => [row.id, row] as const));
  }

  async function mapCallRecordRows(rows: CallRecordRow[]) {
    const context = await getContext();
    const campaignIds = [...new Set(rows.map((row) => row.campaign_id))];
    const contactIds = [...new Set(rows.map((row) => row.contact_id).filter((value): value is string => Boolean(value)))];
    const [campaignNameById, contactById] = await Promise.all([
      loadCampaignNameMap(campaignIds),
      loadContactMap(contactIds),
    ]);

    return rows.map((row) =>
      callRecordSchema.parse({
        id: row.id,
        campaignId: row.campaign_id,
        campaignName: campaignNameById.get(row.campaign_id) ?? "Unknown campaign",
        contactName: row.contact_id ? contactById.get(row.contact_id)?.name ?? "Unknown contact" : "Unknown contact",
        phone: row.contact_id ? contactById.get(row.contact_id)?.phone ?? "0000000000" : "0000000000",
        provider: row.provider,
        status: row.status,
        disposition: row.disposition,
        confirmed: row.confirmed,
        duration: row.duration_seconds,
        startedAt: row.started_at,
        language: row.contact_id ? contactById.get(row.contact_id)?.language ?? context.defaultLanguage : context.defaultLanguage,
        fieldsCollected: row.fields_collected,
        fieldsTotal: row.fields_total,
        transcriptMode: row.transcript_mode,
        errorCode: row.error_code ?? undefined,
      }),
    );
  }

  async function loadCallRecords(filters: CallRecordListFilters = {}) {
    const context = await getContext();
    let query = client
      .from("call_records")
      .select("id, campaign_id, contact_id, provider, status, disposition, confirmed, duration_seconds, started_at, transcript_mode, fields_collected, fields_total, error_code")
      .eq("organization_id", context.organizationId)
      .order("started_at", { ascending: false });

    if (filters.status && filters.status !== "all") {
      query = query.eq("status", filters.status);
    }

    if (filters.campaignId) {
      query = query.eq("campaign_id", filters.campaignId);
    }

    const rows = await readRows<CallRecordRow>(query, "Failed to load call records");
    const mapped = await mapCallRecordRows(rows);
    const normalizedQuery = normalizeQuery(filters.search);

    return mapped.filter((record) =>
      matchesQuery(normalizedQuery, [record.contactName, record.phone, record.campaignName, record.provider]),
    );
  }

  async function loadCallRecordById(id: string) {
    const context = await getContext();
    const row = await readMaybeSingle<CallRecordRow>(
      client
        .from("call_records")
        .select("id, campaign_id, contact_id, provider, status, disposition, confirmed, duration_seconds, started_at, transcript_mode, fields_collected, fields_total, error_code")
        .eq("organization_id", context.organizationId)
        .eq("id", id)
        .maybeSingle(),
      "Failed to load call record",
    );

    if (!row) {
      return null;
    }

    const records = await mapCallRecordRows([row]);
    return records[0] ?? null;
  }

  async function buildDashboardOverview(): Promise<DashboardOverview> {
    const context = await getContext();
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [
      activeCampaigns,
      totalCampaigns,
      totalContacts,
      totalCalls,
      answeredCalls,
      completedCalls,
      transferredCalls,
      confirmedCalls,
      optedOutContacts,
      auditEventsToday,
      maskedExportsToday,
      durationRows,
    ] = await Promise.all([
      readCount(
        client
          .from("campaigns")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", context.organizationId)
          .is("deleted_at", null)
          .eq("status", "active"),
        "Failed to count active campaigns",
      ),
      readCount(
        client
          .from("campaigns")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", context.organizationId)
          .is("deleted_at", null),
        "Failed to count campaigns",
      ),
      readCount(
        client.from("contacts").select("id", { count: "exact", head: true }).eq("organization_id", context.organizationId),
        "Failed to count contacts",
      ),
      readCount(
        client.from("call_records").select("id", { count: "exact", head: true }).eq("organization_id", context.organizationId),
        "Failed to count call records",
      ),
      readCount(
        client
          .from("call_records")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", context.organizationId)
          .in("status", ["completed", "transferred"]),
        "Failed to count answered calls",
      ),
      readCount(
        client
          .from("call_records")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", context.organizationId)
          .eq("status", "completed"),
        "Failed to count completed calls",
      ),
      readCount(
        client
          .from("call_records")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", context.organizationId)
          .eq("status", "transferred"),
        "Failed to count transferred calls",
      ),
      readCount(
        client
          .from("call_records")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", context.organizationId)
          .eq("confirmed", true)
          .in("status", ["completed", "transferred"]),
        "Failed to count confirmed calls",
      ),
      readCount(
        client
          .from("contacts")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", context.organizationId)
          .eq("status", "opted_out"),
        "Failed to count opted-out contacts",
      ),
      readCount(
        client
          .from("audit_logs")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", context.organizationId)
          .gte("created_at", startOfToday.toISOString()),
        "Failed to count audit events for today",
      ),
      readCount(
        client
          .from("audit_logs")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", context.organizationId)
          .ilike("action", "%export%"),
        "Failed to count masked exports",
      ),
      readRows<{ duration_seconds: number }>(
        client
          .from("call_records")
          .select("duration_seconds")
          .eq("organization_id", context.organizationId)
          .gt("duration_seconds", 0),
        "Failed to load call durations",
      ),
    ]);

    const avgHandlingTime =
      durationRows.length > 0
        ? Math.round(durationRows.reduce((sum, row) => sum + toNumber(row.duration_seconds), 0) / durationRows.length)
        : 0;

    return {
      totalCalls,
      activeCampaigns,
      totalCampaigns,
      totalContacts,
      avgHandlingTime,
      avgAnswerRate: percentageOf(answeredCalls, totalCalls),
      avgCompletionRate: percentageOf(completedCalls, totalCalls),
      avgConfirmationRate: percentageOf(confirmedCalls, Math.max(answeredCalls, 1)),
      optOutRate: percentageOf(optedOutContacts, totalContacts),
      transferRate: percentageOf(transferredCalls, totalCalls),
      auditEventsToday,
      maskedExportsToday,
    };
  }

  async function buildVoiceThroughput() {
    const context = await getContext();
    const rows = await readRows<DailyCallVolumeRow>(
      client
        .from("daily_call_volume_view")
        .select("day, calls, answered, completed")
        .eq("organization_id", context.organizationId)
        .order("day", { ascending: false })
        .limit(10),
      "Failed to load daily call volume",
    );

    if (rows.length === 0) {
      return [buildZeroVoiceThroughputPoint()];
    }

    return rows
      .slice()
      .reverse()
      .map((row) =>
        voiceThroughputPointSchema.parse({
          date: formatShortDateLabel(row.day),
          calls: row.calls,
          answered: row.answered,
          completed: row.completed,
        }),
      );
  }

  async function buildDispositionBreakdown() {
    const context = await getContext();
    const rows = await readRows<DispositionBreakdownRow>(
      client
        .from("disposition_breakdown_view")
        .select("disposition, total")
        .eq("organization_id", context.organizationId),
      "Failed to load disposition breakdown",
    );

    const grandTotal = rows.reduce((sum, row) => sum + toNumber(row.total), 0);

    if (grandTotal === 0) {
      return buildEmptyDispositionBreakdown();
    }

    return rows.map((row) =>
      dispositionBreakdownItemSchema.parse({
        name: formatDispositionName(row.disposition),
        value: percentageOf(toNumber(row.total), grandTotal),
        fill: dispositionFill(row.disposition),
      }),
    );
  }

  async function buildComplianceAlerts() {
    const context = await getContext();
    const [manualAlertRows, campaignRows, callRecordRows, workspaceSettingsRow] = await Promise.all([
      readRows<ComplianceAlertRow>(
        client
          .from("compliance_alerts")
          .select("title, detail, severity")
          .eq("organization_id", context.organizationId)
          .eq("is_active", true)
          .order("created_at", { ascending: false })
          .limit(5),
        "Failed to load compliance alerts",
      ),
      readRows<Pick<CampaignRow, "id" | "name" | "status" | "pause_mode" | "created_at" | "launched_at">>(
        client
          .from("campaigns")
          .select("id, name, status, pause_mode, created_at, launched_at")
          .eq("organization_id", context.organizationId)
          .is("deleted_at", null),
        "Failed to load campaigns for compliance alerts",
      ),
      readRows<Pick<CallRecordRow, "provider" | "status" | "disposition" | "error_code" | "started_at">>(
        client
          .from("call_records")
          .select("provider, status, disposition, error_code, started_at")
          .eq("organization_id", context.organizationId),
        "Failed to load call records for compliance alerts",
      ),
      readMaybeSingle<Pick<WorkspaceSettingsRow, "quiet_hours_auto_pause">>(
        client
          .from("workspace_settings")
          .select("quiet_hours_auto_pause")
          .eq("organization_id", context.organizationId)
          .maybeSingle(),
        "Failed to load quiet-hours settings for compliance alerts",
      ),
    ]);
    const derivedAlerts = buildDerivedComplianceAlerts({
      campaigns: campaignRows.map((row) => ({
        id: row.id,
        name: row.name,
        status: row.status,
        pauseMode: row.pause_mode,
        createdAt: row.created_at,
        launchedAt: row.launched_at,
      })),
      callRecords: callRecordRows.map((row) => ({
        provider: row.provider,
        status: row.status,
        disposition: row.disposition,
        startedAt: row.started_at,
        errorCode: row.error_code,
      })),
      settings: {
        quietHoursAutoPause: workspaceSettingsRow?.quiet_hours_auto_pause ?? true,
      },
      referenceTime: new Date().toISOString(),
    });

    return mergeComplianceAlertLists(
      manualAlertRows.map((row) => ({
        title: row.title,
        detail: row.detail,
        severity: row.severity,
      })),
      derivedAlerts,
    ).map((row) => complianceAlertSchema.parse(row));
  }

  async function buildTransferQueues() {
    const context = await getContext();
    const [queueRows, callRecordRows, campaignRows] = await Promise.all([
      readRows<TransferQueueRow>(
        client
          .from("transfer_queues")
          .select("id, name, active_agents, waiting_count, current_sla_seconds")
          .eq("organization_id", context.organizationId)
          .order("waiting_count", { ascending: false }),
        "Failed to load transfer queues",
      ),
      readRows<Pick<CallRecordRow, "campaign_id" | "transfer_queue_id" | "status" | "disposition" | "started_at" | "ended_at">>(
        client
          .from("call_records")
          .select("campaign_id, transfer_queue_id, status, disposition, started_at, ended_at")
          .eq("organization_id", context.organizationId),
        "Failed to load call records for transfer queue metrics",
      ),
      readRows<Pick<CampaignRow, "id" | "transfer_queue_id">>(
        client
          .from("campaigns")
          .select("id, transfer_queue_id")
          .eq("organization_id", context.organizationId)
          .is("deleted_at", null),
        "Failed to load campaign queue mappings",
      ),
    ]);
    const queueNameById = new Map(queueRows.map((row) => [row.id, row.name] as const));
    const campaignQueueIdById = new Map(
      campaignRows
        .filter((row): row is Pick<CampaignRow, "id" | "transfer_queue_id"> & { transfer_queue_id: string } => Boolean(row.transfer_queue_id))
        .map((row) => [row.id, row.transfer_queue_id] as const),
    );

    return buildTransferQueueSummaries({
      queues: queueRows.map((row) => ({
        id: row.id,
        name: row.name,
        activeAgents: row.active_agents,
        waitingCount: row.waiting_count,
        currentSlaSeconds: row.current_sla_seconds,
      })),
      callRecords: callRecordRows.map((row) => {
        const transferQueueId = row.transfer_queue_id ?? campaignQueueIdById.get(row.campaign_id) ?? null;

        return {
          provider: "",
          status: row.status,
          disposition: row.disposition,
          startedAt: row.started_at,
          endedAt: row.ended_at ?? null,
          transferQueueId,
          transferQueueName: transferQueueId ? queueNameById.get(transferQueueId) ?? null : null,
        };
      }),
      referenceTime: new Date().toISOString(),
    }).map((row) => transferQueueSummarySchema.parse(row));
  }

  async function buildAuditEvents() {
    const context = await getContext();
    const rows = await readRows<AuditLogRow>(
      client
        .from("audit_logs")
        .select("id, actor_id, action, entity_type, entity_id, metadata, created_at")
        .eq("organization_id", context.organizationId)
        .order("created_at", { ascending: false })
        .limit(5),
      "Failed to load audit events",
    );

    const actorIds = rows.map((row) => row.actor_id).filter((value): value is string => Boolean(value));
    const actorRows =
      actorIds.length > 0
        ? await readRows<Pick<UserProfileRow, "id" | "full_name">>(
            client.from("user_profiles").select("id, full_name").in("id", actorIds),
            "Failed to load audit actors",
          )
        : [];
    const actorNameById = new Map(actorRows.map((row) => [row.id, row.full_name] as const));

    return rows.map((row) =>
      auditEventSchema.parse({
        id: row.id,
        actor: row.actor_id ? actorNameById.get(row.actor_id) ?? "System" : "System",
        action: row.action,
        entity: extractAuditEntity(row.metadata, row.entity_id),
        time: formatShortTimeLabel(row.created_at),
      }),
    );
  }

  async function buildRecentAttempts() {
    const rows = await loadCallRecords();
    return rows.slice(0, 5).map((record) =>
      recentAttemptSchema.parse({
        id: record.id,
        contactName: record.contactName,
        phone: record.phone,
        campaignName: record.campaignName,
        provider: record.provider,
        status: record.status,
        durationSeconds: record.duration,
      }),
    );
  }

  async function buildProviderPerformance() {
    const context = await getContext();
    const rows = await readRows<ProviderPerformanceRow>(
      client
        .from("provider_performance_view")
        .select("provider, day, success_rate")
        .eq("organization_id", context.organizationId)
        .order("day", { ascending: true }),
      "Failed to load provider performance",
    );

    if (rows.length === 0) {
      return [
        providerPerformanceSchema.parse({
          date: formatShortDateLabel(new Date().toISOString()),
          plivo: 0,
          exotel: 0,
        }),
      ];
    }

    const byDate = new Map<string, ProviderPerformance>();

    for (const row of rows) {
      const key = formatShortDateLabel(row.day);
      const existing = byDate.get(key) ?? {
        date: key,
        plivo: 0,
        exotel: 0,
      };
      const normalizedProvider = row.provider.toLowerCase();
      const successRate = roundToSingleDecimal(toNumber(row.success_rate));

      if (normalizedProvider === "plivo") {
        existing.plivo = successRate;
      } else if (normalizedProvider === "exotel") {
        existing.exotel = successRate;
      }

      byDate.set(key, existing);
    }

    return [...byDate.values()].map((row) => providerPerformanceSchema.parse(row));
  }

  async function buildFieldDropoff() {
    const context = await getContext();
    const rows = await readRows<FieldDropoffRow>(
      client
        .from("field_dropoff_view")
        .select("field_key, captured_count, unconfirmed_count")
        .eq("organization_id", context.organizationId),
      "Failed to load field drop-off",
    );

    if (rows.length === 0) {
      return [
        fieldDropoffSchema.parse({
          field: "No captured fields yet",
          captured: 0,
          dropped: 0,
        }),
      ];
    }

    const campaignRows = await readRows<Pick<CampaignRow, "id">>(
      client
        .from("campaigns")
        .select("id")
        .eq("organization_id", context.organizationId)
        .is("deleted_at", null),
      "Failed to load campaigns for field labels",
    );
    const campaignIds = campaignRows.map((row) => row.id);
    const fieldRows =
      campaignIds.length > 0
        ? await readRows<Pick<CampaignFieldRow, "campaign_id" | "field_key" | "label">>(
            client.from("campaign_fields").select("campaign_id, field_key, label").in("campaign_id", campaignIds),
            "Failed to load field labels",
          )
        : [];
    const labelByFieldKey = new Map<string, string>();

    for (const row of fieldRows) {
      if (!labelByFieldKey.has(row.field_key)) {
        labelByFieldKey.set(row.field_key, row.label);
      }
    }

    return rows.map((row) => {
      const capturedCount = toNumber(row.captured_count);
      const unconfirmedCount = Math.min(capturedCount, toNumber(row.unconfirmed_count));
      const dropped = percentageOf(unconfirmedCount, Math.max(capturedCount, 1));

      return fieldDropoffSchema.parse({
        field: labelByFieldKey.get(row.field_key) ?? row.field_key,
        captured: roundToSingleDecimal(Math.max(0, 100 - dropped)),
        dropped,
      });
    });
  }

  const campaigns = {
    async list(filters: CampaignListFilters) {
      const rows = await loadCampaignRows(filters);
      const summaries = await buildCampaignSummaries(rows);
      const normalizedQuery = normalizeQuery(filters.search);

      return normalizedQuery
        ? summaries.filter((campaign) => matchesQuery(normalizedQuery, [campaign.name, campaign.vertical, campaign.template]))
        : summaries;
    },

    async getById(id: string) {
      return loadCampaignDetailById(id);
    },

    async listSchedulerCampaigns() {
      const rows = await loadCampaignRows({ status: "all" });
      return buildSchedulerCampaigns(rows);
    },

    async listContacts(id: string, filters: ContactListFilters) {
      return loadCampaignContacts(id, filters);
    },

    async listDialerContacts(id: string) {
      return loadDialerContacts(id);
    },

    async create(input: CreateCampaignRequest) {
      const context = await getContext();
      const transferQueueId = input.setup.transferEnabled ? await ensureTransferQueueId(input.setup.transferQueue, context.organizationId) : null;
      const createdCampaign = await readSingle<{ id: string }>(
        client
          .from("campaigns")
          .insert({
            organization_id: context.organizationId,
            name: input.setup.campaignName,
            status: "draft",
            language: input.setup.language,
            vertical: input.setup.vertical,
            template: `${input.setup.vertical} workflow`,
            caller_identity: input.setup.callerIdentity,
            summary: input.setup.purposeStatement,
            purpose_statement: input.setup.purposeStatement,
            intro_script: input.setup.introScript,
            calling_window_start: input.setup.callingWindowStart,
            calling_window_end: input.setup.callingWindowEnd,
            transfer_enabled: input.setup.transferEnabled,
            transfer_queue_id: transferQueueId,
            retry_window_hours: input.journey.retryWindowHours,
            max_retries: input.journey.maxRetries,
            concurrency_limit: input.journey.concurrencyLimit,
            pacing_per_minute: input.journey.pacingPerMinute,
          })
          .select("id")
          .single(),
        "Failed to create campaign",
      );

      await readRows(
        client.from("campaign_fields").insert(
          input.fields.map((field, index) => ({
            campaign_id: createdCampaign.id,
            field_key: field.field_key,
            label: field.label,
            prompt: field.prompt,
            type: field.type,
            required: field.required,
            sensitive: field.sensitive,
            verification_label: field.verification_label,
            retry_limit: field.retry_limit,
            validation_rule: field.validation_rule,
            ask_order: index + 1,
          })),
        ),
        "Failed to create campaign fields",
      );

      await readSingle(
        client
          .from("campaign_journey_rules")
          .insert({
            campaign_id: createdCampaign.id,
            unanswered_action: input.journey.unansweredAction,
            partial_action: input.journey.partialAction,
            retry_window_hours: input.journey.retryWindowHours,
            max_retries: input.journey.maxRetries,
            concurrency_limit: input.journey.concurrencyLimit,
            pacing_per_minute: input.journey.pacingPerMinute,
            csv_source: input.journey.csvSource,
          })
          .select("campaign_id")
          .single(),
        "Failed to create campaign journey rules",
      );

      const campaign = await loadCampaignDetailById(createdCampaign.id);

      if (!campaign) {
        throw new Error(`Campaign ${createdCampaign.id} was created but could not be reloaded.`);
      }

      return campaign;
    },

    async update(id: string, input: UpdateCampaignRequest) {
      const context = await getContext();
      const existingCampaign = await readMaybeSingle<Pick<CampaignRow, "id" | "status">>(
        client
          .from("campaigns")
          .select("id, status")
          .eq("organization_id", context.organizationId)
          .is("deleted_at", null)
          .eq("id", id)
          .maybeSingle(),
        "Failed to load campaign for update",
      );

      if (!existingCampaign) {
        return null;
      }

      const transferQueueId = input.setup.transferEnabled ? await ensureTransferQueueId(input.setup.transferQueue, context.organizationId) : null;

      await readSingle(
        client
          .from("campaigns")
          .update({
            name: input.setup.campaignName,
            language: input.setup.language,
            vertical: input.setup.vertical,
            template: `${input.setup.vertical} workflow`,
            caller_identity: input.setup.callerIdentity,
            summary: input.setup.purposeStatement,
            purpose_statement: input.setup.purposeStatement,
            intro_script: input.setup.introScript,
            calling_window_start: input.setup.callingWindowStart,
            calling_window_end: input.setup.callingWindowEnd,
            transfer_enabled: input.setup.transferEnabled,
            transfer_queue_id: transferQueueId,
            retry_window_hours: input.journey.retryWindowHours,
            max_retries: input.journey.maxRetries,
            concurrency_limit: input.journey.concurrencyLimit,
            pacing_per_minute: input.journey.pacingPerMinute,
          })
          .eq("organization_id", context.organizationId)
          .is("deleted_at", null)
          .eq("id", id)
          .select("id")
          .single(),
        "Failed to update campaign",
      );

      await readRows(client.from("campaign_fields").delete().eq("campaign_id", id), "Failed to replace campaign fields");
      await readRows(
        client.from("campaign_fields").insert(
          input.fields.map((field, index) => ({
            campaign_id: id,
            field_key: field.field_key,
            label: field.label,
            prompt: field.prompt,
            type: field.type,
            required: field.required,
            sensitive: field.sensitive,
            verification_label: field.verification_label,
            retry_limit: field.retry_limit,
            validation_rule: field.validation_rule,
            ask_order: index + 1,
          })),
        ),
        "Failed to recreate campaign fields",
      );

      await readSingle(
        client
          .from("campaign_journey_rules")
          .upsert(
            {
              campaign_id: id,
              unanswered_action: input.journey.unansweredAction,
              partial_action: input.journey.partialAction,
              retry_window_hours: input.journey.retryWindowHours,
              max_retries: input.journey.maxRetries,
              concurrency_limit: input.journey.concurrencyLimit,
              pacing_per_minute: input.journey.pacingPerMinute,
              csv_source: input.journey.csvSource,
            },
            { onConflict: "campaign_id" },
          )
          .select("campaign_id")
          .single(),
        "Failed to update campaign journey rules",
      );

      await ensureJourneyRow(id, existingCampaign.status);
      return loadCampaignDetailById(id);
    },

    async assignContacts(id: string, contactIds: string[]) {
      const uniqueContactIds = [...new Set(contactIds)];

      if (uniqueContactIds.length === 0) {
        return [];
      }

      const [existingAssignments, targetAssignments] = await Promise.all([
        readRows<CampaignContactReferenceRow>(
          client
            .from("campaign_contacts")
            .select("campaign_id, contact_id, added_at")
            .in("contact_id", uniqueContactIds),
          "Failed to load existing campaign contact assignments",
        ),
        readRows<CampaignContactAssignmentRow>(
          client
            .from("campaign_contacts")
            .select("campaign_id, contact_id, priority, status, added_at")
            .eq("campaign_id", id)
            .order("priority", { ascending: true })
            .order("added_at", { ascending: true }),
          "Failed to load target campaign contact assignments",
        ),
      ]);
      const ownedCampaignIds = await loadOrganizationCampaignIdSet([id, ...existingAssignments.map((row) => row.campaign_id)]);

      if (!ownedCampaignIds.has(id)) {
        throw new AppError(404, "campaign_not_found", `Campaign ${id} was not found.`);
      }

      const crossWorkspaceAssignments = existingAssignments.filter((row) => !ownedCampaignIds.has(row.campaign_id));

      if (crossWorkspaceAssignments.length > 0) {
        throw new AppError(
          409,
          "campaign_assignment_workspace_mismatch",
          "One or more contacts have assignments outside the current workspace. Resolve the data mismatch before reassigning them.",
          {
            contactIds: [...new Set(crossWorkspaceAssignments.map((row) => row.contact_id))],
          },
        );
      }

      const affectedCampaignIds = new Set<string>([id, ...existingAssignments.map((row) => row.campaign_id)]);

      if (existingAssignments.length > 0) {
        await readRows(
          client
            .from("campaign_contacts")
            .delete()
            .in("contact_id", uniqueContactIds)
            .select("contact_id"),
          "Failed to clear previous campaign contact assignments",
        );
      }

      const orderedAssignments = [
        ...uniqueContactIds.map((contactId, index) => ({
          campaign_id: id,
          contact_id: contactId,
          priority: index + 1,
          status: "pending",
        })),
        ...targetAssignments
          .filter((assignment) => !uniqueContactIds.includes(assignment.contact_id))
          .map((assignment, index) => ({
            campaign_id: id,
            contact_id: assignment.contact_id,
            priority: uniqueContactIds.length + index + 1,
            status: assignment.status,
          })),
      ];

      await readRows(
        client
          .from("campaign_contacts")
          .upsert(orderedAssignments, { onConflict: "campaign_id,contact_id" })
          .select("contact_id"),
        "Failed to assign contacts to campaign",
      );

      await syncJourneysForCampaignIds([...affectedCampaignIds]);
      return loadCampaignContacts(id, { status: "all" });
    },

    async setStatus(input: SetCampaignStatusInput) {
      const context = await getContext();
      const nextCampaignUpdate = {
        status: input.status,
        pause_mode: input.status === "paused" ? input.pauseMode ?? "manual" : null,
        ...(input.status === "active" && input.launchedAt ? { launched_at: input.launchedAt } : {}),
      };
      let updateQuery = client
        .from("campaigns")
        .update(nextCampaignUpdate)
        .eq("organization_id", context.organizationId)
        .is("deleted_at", null)
        .eq("id", input.id);

      if (input.expectedCurrentStatus) {
        updateQuery = updateQuery.eq("status", input.expectedCurrentStatus);
      }

      if ("expectedCurrentPauseMode" in input) {
        updateQuery =
          input.expectedCurrentPauseMode === null
            ? updateQuery.is("pause_mode", null)
            : updateQuery.eq("pause_mode", input.expectedCurrentPauseMode);
      }

      const updated = await readMaybeSingle<{ id: string }>(
        updateQuery.select("id").maybeSingle(),
        "Failed to update campaign status",
      );

      if (!updated) {
        return null;
      }

      await ensureJourneyRow(input.id, input.status);
      return loadCampaignDetailById(input.id);
    },

    async duplicate(id: string) {
      const context = await getContext();
      const [sourceCampaign, fieldRows, journeyRule] = await Promise.all([
        readMaybeSingle<CampaignRow>(
          client
            .from("campaigns")
            .select(
              "id, name, status, pause_mode, language, vertical, template, caller_identity, summary, purpose_statement, intro_script, launched_at, calling_window_start, calling_window_end, transfer_enabled, transfer_queue_id, retry_window_hours, max_retries, concurrency_limit, pacing_per_minute, created_at",
            )
            .eq("organization_id", context.organizationId)
            .is("deleted_at", null)
            .eq("id", id)
            .maybeSingle(),
          "Failed to load campaign for duplication",
        ),
        readRows<CampaignFieldRow>(
          client
            .from("campaign_fields")
            .select("campaign_id, field_key, label, prompt, type, required, sensitive, verification_label, retry_limit, validation_rule, ask_order")
            .eq("campaign_id", id)
            .order("ask_order", { ascending: true }),
          "Failed to load campaign fields for duplication",
        ),
        readMaybeSingle<CampaignJourneyRuleRow>(
          client
            .from("campaign_journey_rules")
            .select("campaign_id, unanswered_action, partial_action, retry_window_hours, max_retries, concurrency_limit, pacing_per_minute, csv_source, next_checkpoint_at")
            .eq("campaign_id", id)
            .maybeSingle(),
          "Failed to load campaign journey rules for duplication",
        ),
      ]);

      if (!sourceCampaign) {
        return null;
      }

      const duplicated = await readSingle<{ id: string }>(
        client
          .from("campaigns")
          .insert({
            organization_id: context.organizationId,
            name: `${sourceCampaign.name} copy`,
            status: "draft",
            language: sourceCampaign.language,
            vertical: sourceCampaign.vertical,
            template: sourceCampaign.template,
            caller_identity: sourceCampaign.caller_identity,
            summary: sourceCampaign.summary,
            purpose_statement: sourceCampaign.purpose_statement,
            intro_script: sourceCampaign.intro_script,
            calling_window_start: normalizeTimeValue(sourceCampaign.calling_window_start),
            calling_window_end: normalizeTimeValue(sourceCampaign.calling_window_end),
            transfer_enabled: sourceCampaign.transfer_enabled,
            transfer_queue_id: sourceCampaign.transfer_queue_id,
            retry_window_hours: sourceCampaign.retry_window_hours,
            max_retries: sourceCampaign.max_retries,
            concurrency_limit: sourceCampaign.concurrency_limit,
            pacing_per_minute: sourceCampaign.pacing_per_minute,
          })
          .select("id")
          .single(),
        "Failed to duplicate campaign",
      );

      if (fieldRows.length > 0) {
        await readRows(
          client.from("campaign_fields").insert(
            fieldRows.map((field, index) => ({
              campaign_id: duplicated.id,
              field_key: field.field_key,
              label: field.label,
              prompt: field.prompt,
              type: field.type,
              required: field.required,
              sensitive: field.sensitive,
              verification_label: field.verification_label,
              retry_limit: field.retry_limit,
              validation_rule: field.validation_rule,
              ask_order: index + 1,
            })),
          ),
          "Failed to duplicate campaign fields",
        );
      }

      if (journeyRule) {
        await readSingle(
          client
            .from("campaign_journey_rules")
            .insert({
              campaign_id: duplicated.id,
              unanswered_action: journeyRule.unanswered_action,
              partial_action: journeyRule.partial_action,
              retry_window_hours: journeyRule.retry_window_hours,
              max_retries: journeyRule.max_retries,
              concurrency_limit: journeyRule.concurrency_limit,
              pacing_per_minute: journeyRule.pacing_per_minute,
              csv_source: journeyRule.csv_source,
              next_checkpoint_at: journeyRule.next_checkpoint_at,
            })
            .select("campaign_id")
            .single(),
          "Failed to duplicate campaign journey rule",
        );
      }

      return loadCampaignDetailById(duplicated.id);
    },

    async removeContact(id: string, contactId: string) {
      const deleted = await readMaybeSingle<{ contact_id: string }>(
        client
          .from("campaign_contacts")
          .delete()
          .eq("campaign_id", id)
          .eq("contact_id", contactId)
          .select("contact_id")
          .maybeSingle(),
        "Failed to remove campaign contact assignment",
      );

      if (!deleted) {
        return false;
      }

      await syncJourneysForCampaignIds([id]);
      return true;
    },

    async remove(id: string) {
      const context = await getContext();
      const deleted = await readMaybeSingle<{ id: string }>(
        client
          .from("campaigns")
          .update({ deleted_at: new Date().toISOString() })
          .eq("organization_id", context.organizationId)
          .eq("id", id)
          .is("deleted_at", null)
          .select("id")
          .maybeSingle(),
        "Failed to delete campaign",
      );

      return Boolean(deleted);
    },

    async countDialerContacts(id: string, statuses: readonly CampaignContactDispatchState[]) {
      if (statuses.length === 0) {
        return 0;
      }

      const queryResult = await client
        .from("campaign_contacts")
        .select("id", { count: "exact", head: true })
        .eq("campaign_id", id)
        .in("status", [...new Set(statuses)]);

      if (queryResult.error) {
        throw new Error(`Failed to count dialer campaign contacts: ${queryResult.error.message}`);
      }

      return queryResult.count ?? 0;
    },

    async updateDialerContactDispatch(input: UpdateCampaignContactDispatchInput) {
      const updatedAt = new Date().toISOString();
      let assignmentUpdate = client
        .from("campaign_contacts")
        .update({
          status: input.dispatchStatus,
          updated_at: updatedAt,
        })
        .eq("campaign_id", input.campaignId)
        .eq("contact_id", input.contactId);

      if (input.expectedCurrentStatus) {
        assignmentUpdate = assignmentUpdate.eq("status", input.expectedCurrentStatus);
      }

      const updatedAssignment = await readMaybeSingle<{ contact_id: string }>(
        assignmentUpdate.select("contact_id").maybeSingle(),
        "Failed to update dialer campaign contact state",
      );

      if (!updatedAssignment) {
        return false;
      }

      if ("lastContactedAt" in input) {
        const context = await getContext();

        await readMaybeSingle<{ id: string }>(
          client
            .from("contacts")
            .update({
              last_contacted_at: input.lastContactedAt ?? null,
            })
            .eq("organization_id", context.organizationId)
            .eq("id", input.contactId)
            .select("id")
            .maybeSingle(),
          "Failed to update dialer contact timestamp",
        );
      }

      const campaign = await loadCampaignStatusById(input.campaignId);

      if (campaign) {
        await ensureJourneyRow(input.campaignId, campaign.status);
      }

      return true;
    },
  };

  const contacts = {
    async list(filters: ContactListFilters) {
      return loadContacts(filters);
    },

    async getById(id: string) {
      return loadContactById(id);
    },

    async findByPhone(phone: string) {
      return loadContactByPhone(phone);
    },

    async create(input: CreateContactRequest) {
      const context = await getContext();
      const existing = await loadContactByPhone(input.phone);

      if (existing) {
        throw new AppError(409, "contact_phone_exists", `A contact with phone ${input.phone} already exists.`);
      }

      const created = await readSingle<{ id: string }>(
        client
          .from("contacts")
          .insert({
            organization_id: context.organizationId,
            name: input.name,
            phone: input.phone,
            email: input.email ?? null,
            language: input.language,
            status: "eligible",
            consent: input.consent,
            source: input.source,
          })
          .select("id")
          .single(),
        "Failed to create contact",
      );

      const createdContact = await loadContactById(created.id);

      if (!createdContact) {
        throw new Error(`Contact ${created.id} was created but could not be reloaded.`);
      }

      return createdContact;
    },

    async update(id: string, input: UpdateContactRequest) {
      const context = await getContext();
      const updated = await readMaybeSingle<{ id: string }>(
        client
          .from("contacts")
          .update({
            name: input.name,
            phone: input.phone,
            email: input.email ?? null,
            language: input.language,
            consent: input.consent,
            source: input.source,
          })
          .eq("organization_id", context.organizationId)
          .eq("id", id)
          .select("id")
          .maybeSingle(),
        "Failed to update contact",
      );

      if (!updated) {
        return null;
      }

      return loadContactById(updated.id);
    },

    async remove(id: string) {
      const context = await getContext();
      const deleted = await readMaybeSingle<{ id: string }>(
        client
          .from("contacts")
          .delete()
          .eq("organization_id", context.organizationId)
          .eq("id", id)
          .select("id")
          .maybeSingle(),
        "Failed to delete contact",
      );

      return Boolean(deleted);
    },

    async setStatus(id: string, status: Contact["status"]) {
      const context = await getContext();
      const updated = await readMaybeSingle<{ id: string }>(
        client
          .from("contacts")
          .update({
            status,
            do_not_call: status === "dnd",
            suppression_reason: status === "dnd" ? "Manual do-not-call request" : null,
          })
          .eq("organization_id", context.organizationId)
          .eq("id", id)
          .select("id")
          .maybeSingle(),
        "Failed to update contact status",
      );

      if (!updated) {
        return null;
      }

      return loadContactById(updated.id);
    },

    async importContacts(input: PreparedContactImport) {
      const context = await getContext();
      const importedRows = input.rows.filter(
        (row): row is PreparedContactImportRow & { contact: CreateContactRequest } => row.status === "imported" && Boolean(row.contact),
      );
      const duplicates = input.rows.filter((row) => row.status === "duplicate").length;
      const invalid = input.rows.filter((row) => row.status === "invalid").length;
      const imported = importedRows.length;
      const skipped = duplicates + invalid;
      const job = await readSingle<{ id: string }>(
        client
          .from("contact_import_jobs")
          .insert({
            organization_id: context.organizationId,
            source_filename: input.filename,
            total_rows: input.rows.length,
            imported_rows: imported,
            skipped_rows: skipped,
            duplicate_rows: duplicates,
            invalid_rows: invalid,
            created_by: null,
          })
          .select("id")
          .single(),
        "Failed to create contact import job",
      );

      const contactIdByPhone = new Map<string, string>();

      if (importedRows.length > 0) {
        const createdContacts = await readRows<{ id: string; phone: string }>(
          client
            .from("contacts")
            .insert(
              importedRows.map((row) => ({
                organization_id: context.organizationId,
                name: row.contact.name,
                phone: row.contact.phone,
                email: row.contact.email ?? null,
                language: row.contact.language,
                status: "eligible",
                consent: row.contact.consent,
                source: row.contact.source,
              })),
            )
            .select("id, phone"),
          "Failed to import contacts",
        );

        for (const contact of createdContacts) {
          contactIdByPhone.set(contact.phone, contact.id);
        }
      }

      await readRows(
        client.from("contact_import_rows").insert(
          input.rows.map((row) => ({
            import_job_id: job.id,
            row_number: row.rowNumber,
            payload: row.payload,
            status: row.status,
            error_message: row.errorMessage ?? null,
            contact_id: row.contact ? contactIdByPhone.get(row.contact.phone) ?? null : null,
          })),
        ),
        "Failed to record contact import rows",
      );

      return {
        jobId: job.id,
        imported,
        skipped,
        duplicates,
        invalid,
      };
    },
  };

  async function loadVoiceSessionCollectedData(callRecordId: string): Promise<VoiceSessionCollectedField[]> {
    const rows = await readRows<CollectedDataRow>(
      client
        .from("collected_data")
        .select("call_record_id, campaign_id, field_key, raw_value_encrypted, masked_value, extracted_value, confidence_score, is_confirmed, collected_at")
        .eq("call_record_id", callRecordId)
        .order("collected_at", { ascending: true }),
      "Failed to load collected data",
    );

    if (rows.length === 0) {
      return [];
    }

    const campaignId = rows[0]?.campaign_id;
    const fieldRows =
      campaignId
        ? await readRows<Pick<CampaignFieldRow, "field_key" | "label" | "sensitive">>(
            client.from("campaign_fields").select("field_key, label, sensitive").eq("campaign_id", campaignId),
            "Failed to load collected field labels",
          )
        : [];
    const fieldByKey = new Map(fieldRows.map((row) => [row.field_key, row] as const));

    return rows.map((row) => {
      const field = fieldByKey.get(row.field_key);
      const rawValue = decryptSensitiveValue(row.raw_value_encrypted);
      const maskedValue = row.masked_value || row.extracted_value || rawValue;

      return {
        fieldKey: row.field_key,
        label: field?.label ?? row.field_key,
        rawValue,
        maskedValue,
        confidenceScore: toNumber(row.confidence_score),
        confirmed: row.is_confirmed,
        sensitive: field?.sensitive ?? (Boolean(maskedValue) && maskedValue !== rawValue),
      } satisfies VoiceSessionCollectedField;
    });
  }

  const callRecords = {
    async list(filters: CallRecordListFilters) {
      return loadCallRecords(filters);
    },

    async getById(id: string) {
      return loadCallRecordById(id);
    },

    async getTranscript(id: string, options?: { readonly view?: TranscriptView }) {
      const rows = await readRows<TranscriptTurnRow>(
        client
          .from("call_transcript_turns")
          .select("speaker, text_raw, text_redacted, created_at")
          .eq("call_record_id", id)
          .order("created_at", { ascending: true }),
        "Failed to load transcript turns",
      );

      if (rows.length === 0) {
        return null;
      }

      return rows.map((row) =>
        transcriptTurnSchema.parse({
          speaker: row.speaker,
          text: options?.view === "raw" ? row.text_raw : row.text_redacted,
        }),
      );
    },

    async getCollectedData(id: string) {
      const collectedData = await loadVoiceSessionCollectedData(id);

      if (collectedData.length === 0) {
        return null;
      }

      return collectedData.map((field) =>
        collectedFieldSchema.parse({
          fieldKey: field.fieldKey,
          label: field.label,
          value: field.sensitive ? field.maskedValue : field.rawValue,
          confidenceScore: field.confidenceScore,
          confirmed: field.confirmed,
          masked: field.sensitive,
        }),
      );
    },

    async getRecordingUrl(id: string) {
      const context = await getContext();
      const row = await readMaybeSingle<Pick<CallRecordRow, "id" | "recording_url">>(
        client
          .from("call_records")
          .select("id, recording_url")
          .eq("organization_id", context.organizationId)
          .eq("id", id)
          .maybeSingle(),
        "Failed to load call recording",
      );

      return row?.recording_url ?? null;
    },
  };

  const audit: AuditRepository = {
    async record(input: RecordAuditEventInput) {
      const context = await getContext();
      const principal = getRequestPrincipal();

      await readSingle(
        client
          .from("audit_logs")
          .insert({
            organization_id: context.organizationId,
            actor_id: principal?.userId ?? null,
            action: input.action,
            entity_type: input.entityType,
            entity_id: input.entityId,
            metadata: input.metadata ?? {},
          })
          .select("id")
          .single(),
        "Failed to record an audit event",
      );
    },
  };

  const voice = {
    async resolveScope(input: ResolveVoiceScopeInput): Promise<VoiceScope> {
      const providerCallId = input.providerCallId?.trim();

      if (providerCallId) {
        const existingCallRecord = await readMaybeSingle<{
          organization_id: string;
          campaign_id: string;
          contact_id: string | null;
        }>(
          client
            .from("call_records")
            .select("organization_id, campaign_id, contact_id")
            .eq("call_uuid", providerCallId)
            .maybeSingle(),
          "Failed to resolve voice scope from the call record",
        );

        if (existingCallRecord) {
          if (input.campaignId && existingCallRecord.campaign_id !== input.campaignId) {
            throw new AppError(409, "voice_scope_mismatch", "The voice callback campaign does not match the stored call session.");
          }

          if (input.contactId && existingCallRecord.contact_id && existingCallRecord.contact_id !== input.contactId) {
            throw new AppError(409, "voice_scope_mismatch", "The voice callback contact does not match the stored call session.");
          }

          return {
            organizationId: existingCallRecord.organization_id,
            campaignId: existingCallRecord.campaign_id,
            contactId: existingCallRecord.contact_id ?? undefined,
          };
        }
      }

      const campaignId = input.campaignId?.trim();
      const contactId = input.contactId?.trim();

      if (!campaignId && !contactId) {
        throw new AppError(400, "voice_scope_missing", "A campaign, contact, or call UUID is required to resolve the voice scope.");
      }

      const [campaignRow, contactRow] = await Promise.all([
        campaignId
          ? readMaybeSingle<{
              id: string;
              organization_id: string;
            }>(
              client
                .from("campaigns")
                .select("id, organization_id")
                .eq("id", campaignId)
                .is("deleted_at", null)
                .maybeSingle(),
              "Failed to resolve voice scope from the campaign",
            )
          : Promise.resolve(null),
        contactId
          ? readMaybeSingle<{
              id: string;
              organization_id: string;
            }>(
              client
                .from("contacts")
                .select("id, organization_id")
                .eq("id", contactId)
                .maybeSingle(),
              "Failed to resolve voice scope from the contact",
            )
          : Promise.resolve(null),
      ]);

      if (campaignId && !campaignRow) {
        throw new AppError(404, "campaign_not_found", `Campaign ${campaignId} was not found.`);
      }

      if (contactId && !contactRow) {
        throw new AppError(404, "contact_not_found", `Contact ${contactId} was not found.`);
      }

      if (campaignRow && contactRow && campaignRow.organization_id !== contactRow.organization_id) {
        throw new AppError(
          409,
          "voice_scope_workspace_mismatch",
          "The voice callback campaign and contact do not belong to the same workspace.",
        );
      }

      return {
        organizationId: campaignRow?.organization_id ?? contactRow!.organization_id,
        campaignId: campaignRow?.id ?? campaignId,
        contactId: contactRow?.id ?? contactId,
      };
    },

    async ensureCallSession(input: EnsureVoiceCallSessionInput) {
      const context = await getContext();
      const existingSession = await readMaybeSingle<
        Pick<
          CallRecordRow,
          "id" | "call_uuid" | "campaign_id" | "contact_id" | "transfer_queue_id" | "transcript_mode" | "fields_collected" | "fields_total"
        >
      >(
        client
          .from("call_records")
          .select("id, call_uuid, campaign_id, contact_id, transfer_queue_id, transcript_mode, fields_collected, fields_total")
          .eq("organization_id", context.organizationId)
          .eq("call_uuid", input.providerCallId)
          .maybeSingle(),
        "Failed to load voice call session",
      );

      const campaign = await loadCampaignDetailById(input.campaignId);

      if (!campaign) {
        throw new AppError(404, "campaign_not_found", `Campaign ${input.campaignId} was not found.`);
      }

      const contact = await loadContactById(input.contactId);

      if (!contact) {
        throw new AppError(404, "contact_not_found", `Contact ${input.contactId} was not found.`);
      }

      const campaignTransferQueue = await readMaybeSingle<Pick<CampaignRow, "transfer_queue_id">>(
        client
          .from("campaigns")
          .select("transfer_queue_id")
          .eq("organization_id", context.organizationId)
          .eq("id", campaign.id)
          .is("deleted_at", null)
          .maybeSingle(),
        "Failed to resolve the transfer queue for the voice call session",
      );

      const sessionRecord =
        existingSession ??
        (await readSingle<
          Pick<
            CallRecordRow,
            "id" | "call_uuid" | "campaign_id" | "contact_id" | "transfer_queue_id" | "transcript_mode" | "fields_collected" | "fields_total"
          >
        >(
          client
            .from("call_records")
            .insert({
              organization_id: context.organizationId,
              campaign_id: campaign.id,
              contact_id: contact.id,
              transfer_queue_id: campaignTransferQueue?.transfer_queue_id ?? null,
              call_uuid: input.providerCallId,
              provider: input.provider,
              status: "in_progress",
              disposition: "in_progress",
              started_at: input.startedAt,
              transcript_mode: input.transcriptMode ?? "restricted",
              fields_collected: 0,
              fields_total: campaign.fields.length,
            })
            .select("id, call_uuid, campaign_id, contact_id, transfer_queue_id, transcript_mode, fields_collected, fields_total")
            .single(),
          "Failed to create voice call session",
        ));
      const [collectedData, transferQueueMap, campaignTransferTarget] = await Promise.all([
        loadVoiceSessionCollectedData(sessionRecord.id),
        loadTransferQueueMap(sessionRecord.transfer_queue_id ? [sessionRecord.transfer_queue_id] : []),
        loadCampaignTransferTarget(campaign.id),
      ]);
      const storedTransferQueue = sessionRecord.transfer_queue_id ? transferQueueMap.get(sessionRecord.transfer_queue_id) ?? null : null;
      const transferQueueName = storedTransferQueue?.name ?? (campaign.setup.transferEnabled ? campaign.setup.transferQueue : "");
      const transferTarget = storedTransferQueue?.provider_queue_id?.trim() || campaignTransferTarget;

      return {
        callRecordId: sessionRecord.id,
        providerCallId: sessionRecord.call_uuid ?? input.providerCallId,
        campaignId: campaign.id,
        campaignName: campaign.name,
        contactId: contact.id,
        contactName: contact.name,
        phone: contact.phone,
        language: campaign.language,
        introPrompt: campaign.setup.introScript,
        purposeStatement: campaign.setup.purposeStatement,
        transferEnabled: transferQueueName.trim().length > 0,
        transferQueue: transferQueueName,
        transferTarget,
        transcriptMode: sessionRecord.transcript_mode,
        fieldsCollected: sessionRecord.fields_collected,
        fieldsTotal: sessionRecord.fields_total,
        fields: structuredClone(campaign.fields),
        collectedData: structuredClone(collectedData),
      };
    },

    async appendTranscriptTurn(input: AppendVoiceTranscriptTurnInput) {
      const context = await getContext();
      const callRecord = await readMaybeSingle<Pick<CallRecordRow, "id">>(
        client
          .from("call_records")
          .select("id")
          .eq("organization_id", context.organizationId)
          .eq("call_uuid", input.providerCallId)
          .maybeSingle(),
        "Failed to resolve the call record for transcript persistence",
      );

      if (!callRecord) {
        throw new AppError(404, "voice_session_not_found", `Voice session ${input.providerCallId} was not found.`);
      }

      await readSingle(
        client
          .from("call_transcript_turns")
          .insert({
            call_record_id: callRecord.id,
            speaker: input.speaker,
            text_raw: input.textRaw,
            text_redacted: input.textRedacted,
          })
          .select("call_record_id")
          .single(),
        "Failed to append a transcript turn",
      );
    },

    async upsertCollectedField(input: UpsertVoiceCollectedFieldInput) {
      const context = await getContext();
      const callRecord = await readMaybeSingle<{
        id: string;
        campaign_id: string;
        contact_id: string | null;
      }>(
        client
          .from("call_records")
          .select("id, campaign_id, contact_id")
          .eq("organization_id", context.organizationId)
          .eq("call_uuid", input.providerCallId)
          .maybeSingle(),
        "Failed to resolve the call record for collected data persistence",
      );

      if (!callRecord) {
        throw new AppError(404, "voice_session_not_found", `Voice session ${input.providerCallId} was not found.`);
      }

      const existingRow = await readMaybeSingle<{
        raw_value_encrypted: string;
        masked_value: string;
        extracted_value: string;
      }>(
        client
          .from("collected_data")
          .select("raw_value_encrypted, masked_value, extracted_value")
          .eq("call_record_id", callRecord.id)
          .eq("field_key", input.fieldKey)
          .maybeSingle(),
        "Failed to resolve existing collected field data",
      );
      const rawValue =
        input.rawValue ??
        (existingRow ? decryptSensitiveValue(existingRow.raw_value_encrypted) : undefined) ??
        existingRow?.extracted_value;
      const maskedValue = input.maskedValue ?? existingRow?.masked_value ?? rawValue;

      if (!rawValue || !maskedValue) {
        throw new AppError(400, "voice_field_value_missing", `Collected field ${input.fieldKey} is missing a value.`);
      }

      await readSingle(
        client
          .from("collected_data")
          .upsert(
            {
              organization_id: context.organizationId,
              call_record_id: callRecord.id,
              campaign_id: callRecord.campaign_id,
              contact_id: callRecord.contact_id,
              field_key: input.fieldKey,
              raw_value_encrypted: encryptSensitiveValue(rawValue),
              masked_value: maskedValue,
              extracted_value: input.sensitive ? maskedValue : rawValue,
              confidence_score: input.confidenceScore,
              is_confirmed: input.confirmed,
            },
            { onConflict: "call_record_id,field_key" },
          )
          .select("call_record_id")
          .single(),
        "Failed to persist collected field data",
      );

      return collectedFieldSchema.parse({
        fieldKey: input.fieldKey,
        label: input.label,
        value: input.sensitive ? maskedValue : rawValue,
        confidenceScore: input.confidenceScore,
        confirmed: input.confirmed,
        masked: input.sensitive,
      });
    },

    async clearCollectedData(providerCallId: string) {
      const context = await getContext();
      const callRecord = await readMaybeSingle<Pick<CallRecordRow, "id">>(
        client
          .from("call_records")
          .select("id")
          .eq("organization_id", context.organizationId)
          .eq("call_uuid", providerCallId)
          .maybeSingle(),
        "Failed to resolve the call record before clearing collected data",
      );

      if (!callRecord) {
        throw new AppError(404, "voice_session_not_found", `Voice session ${providerCallId} was not found.`);
      }

      await readRows(
        client.from("collected_data").delete().eq("call_record_id", callRecord.id).select("call_record_id"),
        "Failed to clear collected field data",
      );
    },

    async updateCallStatus(input: UpdateVoiceCallStatusInput) {
      const context = await getContext();
      const updatePayload = {
        status: input.status,
        disposition: input.disposition,
        duration_seconds: input.durationSeconds,
        answered_at: input.answeredAt,
        ended_at: input.endedAt,
        recording_url: input.recordingUrl,
        error_code: input.errorCode,
        ...(typeof input.confirmed === "boolean" ? { confirmed: input.confirmed } : {}),
        ...(typeof input.fieldsCollected === "number" ? { fields_collected: input.fieldsCollected } : {}),
        ...(typeof input.fieldsTotal === "number" ? { fields_total: input.fieldsTotal } : {}),
        ...(input.transcriptMode ? { transcript_mode: input.transcriptMode } : {}),
      };
      const row = await readMaybeSingle<CallRecordRow>(
        client
          .from("call_records")
          .update(updatePayload)
          .eq("organization_id", context.organizationId)
          .eq("call_uuid", input.providerCallId)
          .select("id, campaign_id, contact_id, provider, status, disposition, confirmed, duration_seconds, started_at, transcript_mode, fields_collected, fields_total, error_code")
          .maybeSingle(),
        "Failed to update voice call status",
      );

      if (!row) {
        return null;
      }

      const campaign = await loadCampaignStatusById(row.campaign_id);

      if (campaign) {
        await ensureJourneyRow(row.campaign_id, campaign.status);
      }

      const records = await mapCallRecordRows([row]);
      return records[0] ?? null;
    },
  };

  const search = {
    async global(query: string) {
      const normalizedQuery = normalizeQuery(query);

      if (!normalizedQuery) {
        return {
          campaigns: [],
          contacts: [],
          callRecords: [],
        };
      }

      const [matchedCampaigns, matchedContacts, matchedCallRecords] = await Promise.all([
        campaigns.list({ search: normalizedQuery, status: "all" }),
        contacts.list({ search: normalizedQuery, status: "all" }),
        callRecords.list({ search: normalizedQuery, status: "all" }),
      ]);

      return {
        campaigns: matchedCampaigns.slice(0, 5),
        contacts: matchedContacts.slice(0, 5),
        callRecords: matchedCallRecords.slice(0, 5),
      };
    },
  };

  const dashboard = {
    async getSnapshot(): Promise<DashboardSnapshot> {
      const context = await getContext();
      const [overview, voiceThroughput, liveCampaigns, complianceAlerts, transferQueues, auditEvents, dispositionBreakdown, recentAttempts] =
        await Promise.all([
          buildDashboardOverview(),
          buildVoiceThroughput(),
          campaigns.list({ status: "active" }),
          buildComplianceAlerts(),
          buildTransferQueues(),
          buildAuditEvents(),
          buildDispositionBreakdown(),
          buildRecentAttempts(),
        ]);
      const principal = getRequestPrincipal();

      return dashboardSnapshotSchema.parse({
        workspace: {
          name: context.workspaceName,
        },
        viewer: {
          userId: principal?.userId ?? "workspace-user",
          fullName: principal?.fullName ?? "Workspace User",
          email: principal?.email ?? "workspace@example.com",
          role: principal?.role ?? "workspace_admin",
        },
        overview,
        voiceThroughput,
        liveCampaigns: liveCampaigns.map((campaign) =>
          liveCampaignCardSchema.parse({
            id: campaign.id,
            name: campaign.name,
            status: campaign.status,
            summary: campaign.summary,
            answerRate: campaign.answerRate,
            completionRate: campaign.completionRate,
            confirmationRate: campaign.confirmationRate,
          }),
        ),
        complianceAlerts,
        transferQueues,
        auditEvents,
        dispositionBreakdown,
        recentAttempts,
      });
    },
  };

  async function buildJourneyMonitors(rows: JourneyRow[]) {
    if (rows.length === 0) {
      return [];
    }

    const campaignNameById = await loadCampaignNameMap(rows.map((row) => row.campaign_id));

    return rows.map((row) =>
      journeyMonitorSchema.parse({
        id: row.id,
        campaignId: row.campaign_id,
        campaignName: campaignNameById.get(row.campaign_id) ?? "Unknown campaign",
        sequence: toStringArray(row.sequence).length > 0 ? toStringArray(row.sequence) : ["Voice first"],
        status: row.status,
        totalContacts: row.total_contacts,
        processed: row.processed,
        successRate: roundToSingleDecimal(toNumber(row.success_rate)),
        retryWindowHours: row.retry_window_hours,
        concurrencyLimit: row.concurrency_limit,
        pacingPerMinute: row.pacing_per_minute,
        nextCheckpoint: formatNextCheckpoint(row.next_checkpoint_at, row.status),
      }),
    );
  }

  async function loadJourneyById(id: string) {
    const context = await getContext();
    const row = await readMaybeSingle<JourneyRow>(
      client
        .from("journeys")
        .select("id, campaign_id, status, sequence, total_contacts, processed, success_rate, retry_window_hours, concurrency_limit, pacing_per_minute, next_checkpoint_at, created_at")
        .eq("organization_id", context.organizationId)
        .eq("id", id)
        .maybeSingle(),
      "Failed to load journey",
    );

    if (!row) {
      return null;
    }

    const journeys = await buildJourneyMonitors([row]);
    return journeys[0] ?? null;
  }

  const journeys = {
    async list() {
      const context = await getContext();
      const rows = await readRows<JourneyRow>(
        client
          .from("journeys")
          .select("id, campaign_id, status, sequence, total_contacts, processed, success_rate, retry_window_hours, concurrency_limit, pacing_per_minute, next_checkpoint_at, created_at")
          .eq("organization_id", context.organizationId)
          .order("created_at", { ascending: false }),
        "Failed to load journeys",
      );
      return buildJourneyMonitors(rows);
    },

    async getById(id: string) {
      return loadJourneyById(id);
    },

    async updateNextCheckpoint(campaignId: string, nextCheckpointAt: string | null) {
      const context = await getContext();
      const campaignRow = await readMaybeSingle<Pick<CampaignRow, "status">>(
        client
          .from("campaigns")
          .select("status")
          .eq("organization_id", context.organizationId)
          .is("deleted_at", null)
          .eq("id", campaignId)
          .maybeSingle(),
        "Failed to resolve campaign before updating the journey checkpoint",
      );

      if (!campaignRow) {
        return false;
      }

      await readRows(
        client
          .from("campaign_journey_rules")
          .update({
            next_checkpoint_at: nextCheckpointAt,
          })
          .eq("campaign_id", campaignId)
          .select("campaign_id"),
        "Failed to update campaign journey checkpoint",
      );
      await ensureJourneyRow(campaignId, campaignRow.status);
      return true;
    },
  };

  const reports = {
    async getSnapshot(): Promise<ReportsSnapshot> {
      const [overview, dailyVolume, fieldDropoff, providerPerformance, dispositionBreakdown] = await Promise.all([
        buildDashboardOverview(),
        buildVoiceThroughput(),
        buildFieldDropoff(),
        buildProviderPerformance(),
        buildDispositionBreakdown(),
      ]);

      return reportsSnapshotSchema.parse({
        overview,
        dailyVolume,
        fieldDropoff,
        providerPerformance,
        dispositionBreakdown,
      });
    },
  };

  const settings = {
    async getSnapshot(): Promise<SettingsSnapshot> {
      const context = await getContext();
      const [workspaceSettingsRow, teamMemberRows, notificationPreferenceRows, apiKeyRows, latestWebhook, campaignCount] = await Promise.all([
        readMaybeSingle<WorkspaceSettingsRow>(
          client
            .from("workspace_settings")
            .select("organization_id, workspace_name, default_language, calling_window_start, calling_window_end, dnd_checks_enabled, quiet_hours_auto_pause, restrict_full_transcripts")
            .eq("organization_id", context.organizationId)
            .maybeSingle(),
          "Failed to load workspace settings",
        ),
        readRows<UserProfileRow>(
          client
            .from("user_profiles")
            .select("id, full_name, email, role")
            .eq("organization_id", context.organizationId)
            .order("created_at", { ascending: true }),
          "Failed to load team members",
        ),
        readRows<NotificationPreferenceRow>(
          client
            .from("notification_preferences")
            .select("key, enabled")
            .eq("organization_id", context.organizationId)
            .order("created_at", { ascending: true }),
          "Failed to load notification preferences",
        ),
        readRows<ApiKeyRow>(
          client
            .from("api_keys")
            .select("id, name, key_prefix, last_used_at, created_at")
            .eq("organization_id", context.organizationId)
            .order("created_at", { ascending: false })
            .limit(20),
          "Failed to load API keys",
        ),
        readMaybeSingle<OutboundWebhookRow>(
          client
            .from("outbound_webhooks")
            .select("url, events")
            .eq("organization_id", context.organizationId)
            .eq("is_active", true)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
          "Failed to load webhook configuration",
        ),
        readCount(
          client
            .from("campaigns")
            .select("id", { count: "exact", head: true })
            .eq("organization_id", context.organizationId)
            .is("deleted_at", null),
          "Failed to count campaigns for settings",
        ),
      ]);

      const workspaceSettings: WorkspaceSettings = workspaceSettingsSchema.parse({
        workspaceName: workspaceSettingsRow?.workspace_name ?? context.workspaceName,
        defaultLanguage: workspaceSettingsRow?.default_language ?? context.defaultLanguage,
        callingWindowStart: normalizeTimeValue(workspaceSettingsRow?.calling_window_start, context.callingWindowStart),
        callingWindowEnd: normalizeTimeValue(workspaceSettingsRow?.calling_window_end, context.callingWindowEnd),
        dndChecksEnabled: workspaceSettingsRow?.dnd_checks_enabled ?? true,
        quietHoursAutoPause: workspaceSettingsRow?.quiet_hours_auto_pause ?? true,
        restrictFullTranscripts: workspaceSettingsRow?.restrict_full_transcripts ?? true,
      });

      const workspaces: WorkspaceInventory[] = [
        workspaceInventorySchema.parse({
          id: context.organizationId,
          name: workspaceSettings.workspaceName,
          plan: "Enterprise",
          members: teamMemberRows.length,
          campaigns: campaignCount,
        }),
      ];

      const teamMembers: TeamMember[] = teamMemberRows.map((row) =>
        teamMemberSchema.parse({
          id: row.id,
          name: row.full_name,
          email: row.email,
          role: row.role,
        }),
      );

      const notificationPreferences: NotificationPreference[] =
        notificationPreferenceRows.length > 0
          ? notificationPreferenceRows.map((row) =>
              notificationPreferenceSchema.parse({
                key: row.key,
                label: notificationCatalog[row.key]?.label ?? row.key,
                detail: notificationCatalog[row.key]?.detail ?? "Workspace notification preference.",
                enabled: row.enabled,
              }),
            )
          : Object.entries(notificationCatalog).map(([key, value]) =>
              notificationPreferenceSchema.parse({
                key,
                label: value.label,
                detail: value.detail,
                enabled: false,
              }),
            );

      const apiKeys: ApiKeySummary[] = apiKeyRows.map((row) =>
        apiKeySummarySchema.parse({
          id: row.id,
          name: row.name,
          maskedKey: maskApiKey(row.key_prefix),
          createdAt: row.created_at,
          lastUsedAt: row.last_used_at ?? undefined,
        }),
      );

      const securityControls: SecurityControl[] = [
        securityControlSchema.parse({
          title: "Sensitive field encryption",
          body: workspaceSettings.restrictFullTranscripts
            ? "Transcript access is restricted and sensitive values remain masked by default."
            : "Sensitive values are still encrypted, but transcript access is more permissive.",
          badge: workspaceSettings.restrictFullTranscripts ? "Enabled" : "Review",
        }),
        securityControlSchema.parse({
          title: "Quiet-hour automation",
          body: workspaceSettings.quietHoursAutoPause
            ? "Campaigns can be paused automatically when the calling window closes."
            : "Quiet-hour automation is disabled for this workspace.",
          badge: workspaceSettings.quietHoursAutoPause ? "Active" : "Manual",
        }),
        securityControlSchema.parse({
          title: "DND enforcement",
          body: workspaceSettings.dndChecksEnabled
            ? "Suppression and DND checks are enforced before dial attempts are scheduled."
            : "DND checks are disabled and require immediate review.",
          badge: workspaceSettings.dndChecksEnabled ? "Enabled" : "Disabled",
        }),
      ];

      const apiAccess: ApiAccessConfig = apiAccessConfigSchema.parse({
        maskedKey: apiKeys[0]?.maskedKey ?? "Not configured",
        webhook: {
          url: latestWebhook?.url ?? "https://example.invalid/not-configured",
          events: toStringArray(latestWebhook?.events).length > 0 ? toStringArray(latestWebhook?.events) : ["integration.pending"],
        },
      });

      return settingsSnapshotSchema.parse({
        workspaceSettings,
        workspaces,
        teamMembers,
        securityControls,
        notificationPreferences,
        apiAccess,
        apiKeys,
      });
    },

    async findTeamMembersByEmail(email: string) {
      const normalizedEmail = email.trim().toLowerCase();
      const rows = await readRows<Pick<UserProfileRow, "id" | "organization_id">>(
        client
          .from("user_profiles")
          .select("id, organization_id")
          .ilike("email", normalizedEmail),
        "Failed to check for team members by email",
      );

      return rows.map((row) => ({
        id: row.id,
        organizationId: row.organization_id ?? "",
      }));
    },

    async updateWorkspaceSettings(input: WorkspaceSettings) {
      const context = await getContext();

      await readSingle(
        client
          .from("workspace_settings")
          .upsert({
            organization_id: context.organizationId,
            workspace_name: input.workspaceName,
            default_language: input.defaultLanguage,
            calling_window_start: input.callingWindowStart,
            calling_window_end: input.callingWindowEnd,
            dnd_checks_enabled: input.dndChecksEnabled,
            quiet_hours_auto_pause: input.quietHoursAutoPause,
            restrict_full_transcripts: input.restrictFullTranscripts,
          })
          .select("organization_id")
          .single(),
        "Failed to update workspace settings",
      );

      contextResolver.invalidate();
      return settings.getSnapshot();
    },

    async updateNotificationPreferences(input: NotificationPreferenceUpdate[]) {
      const context = await getContext();

      await readRows(
        client.from("notification_preferences").upsert(
          input.map((item) => ({
            organization_id: context.organizationId,
            key: item.key,
            enabled: item.enabled,
          })),
          { onConflict: "organization_id,key" },
        ),
        "Failed to update notification preferences",
      );

      return settings.getSnapshot();
    },

    async updateWebhookConfig(input: WebhookConfig) {
      const context = await getContext();
      const existingWebhook = await readMaybeSingle<{ id: string }>(
        client
          .from("outbound_webhooks")
          .select("id")
          .eq("organization_id", context.organizationId)
          .eq("is_active", true)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        "Failed to load existing webhook configuration",
      );

      if (existingWebhook) {
        await readSingle(
          client
            .from("outbound_webhooks")
            .update({
              url: input.url,
              events: input.events,
              is_active: true,
            })
            .eq("id", existingWebhook.id)
            .select("id")
            .single(),
          "Failed to update webhook configuration",
        );
      } else {
        await readSingle(
          client
            .from("outbound_webhooks")
            .insert({
              organization_id: context.organizationId,
              url: input.url,
              events: input.events,
              is_active: true,
            })
            .select("id")
            .single(),
          "Failed to create webhook configuration",
        );
      }

      return settings.getSnapshot();
    },

    async inviteTeamMember(input: InviteTeamMemberRequest) {
      const context = await getContext();
      const normalizedEmail = input.email.trim().toLowerCase();
      const existingProfiles = await settings.findTeamMembersByEmail(normalizedEmail);

      if (existingProfiles.some((profile) => profile.organizationId === context.organizationId)) {
        throw new AppError(409, "team_member_exists", `A team member with email ${input.email} already exists.`);
      }

      if (existingProfiles.length > 0) {
        throw new AppError(409, "team_member_other_workspace", `The email ${input.email} is already assigned to another workspace.`);
      }

      const { data, error } = await client.auth.admin.inviteUserByEmail(normalizedEmail, {
        data: {
          full_name: input.name,
          role: input.role,
          organization_id: context.organizationId,
        },
        redirectTo: env.FRONTEND_ORIGIN,
      });

      if (error || !data.user) {
        throw new Error(`Failed to invite team member: ${error?.message ?? "No user was returned by Supabase Auth."}`);
      }

      const existingProfileById = await readMaybeSingle<{ id: string; organization_id: string }>(
        client
          .from("user_profiles")
          .select("id, organization_id")
          .eq("id", data.user.id)
          .maybeSingle(),
        "Failed to validate invited team member ownership",
      );

      if (existingProfileById && existingProfileById.organization_id !== context.organizationId) {
        throw new AppError(
          409,
          "team_member_other_workspace",
          `The email ${input.email} is already assigned to another workspace.`,
        );
      }

      await readSingle(
        client
          .from("user_profiles")
          .upsert(
            {
              id: data.user.id,
              organization_id: context.organizationId,
              full_name: input.name,
              email: normalizedEmail,
              role: input.role,
            },
            { onConflict: "id" },
          )
          .select("id")
          .single(),
        "Failed to create invited team member profile",
      );

      return settings.getSnapshot();
    },

    async updateTeamMemberRole(userId: string, role: InviteTeamMemberRequest["role"]) {
      const context = await getContext();
      const updatedProfile = await readMaybeSingle<{ id: string }>(
        client
          .from("user_profiles")
          .update({
            role,
          })
          .eq("organization_id", context.organizationId)
          .eq("id", userId)
          .select("id")
          .maybeSingle(),
        "Failed to update team member role",
      );

      if (!updatedProfile) {
        throw new AppError(404, "team_member_not_found", `Team member ${userId} was not found.`);
      }

      return settings.getSnapshot();
    },

    async removeTeamMember(userId: string) {
      const context = await getContext();
      const teamMember = await readMaybeSingle<{ id: string }>(
        client
          .from("user_profiles")
          .select("id")
          .eq("organization_id", context.organizationId)
          .eq("id", userId)
          .maybeSingle(),
        "Failed to resolve team member before delete",
      );

      if (!teamMember) {
        throw new AppError(404, "team_member_not_found", `Team member ${userId} was not found.`);
      }

      const { error } = await client.auth.admin.deleteUser(userId);

      if (error) {
        throw new Error(`Failed to remove team member: ${error.message}`);
      }

      return settings.getSnapshot();
    },

    async listApiKeys() {
      const context = await getContext();
      const apiKeyRows = await readRows<ApiKeyRow>(
        client
          .from("api_keys")
          .select("id, name, key_prefix, last_used_at, created_at")
          .eq("organization_id", context.organizationId)
          .order("created_at", { ascending: false })
          .limit(20),
        "Failed to load API keys",
      );

      return apiKeyRows.map((row) =>
        apiKeySummarySchema.parse({
          id: row.id,
          name: row.name,
          maskedKey: maskApiKey(row.key_prefix),
          createdAt: row.created_at,
          lastUsedAt: row.last_used_at ?? undefined,
        }),
      );
    },

    async createApiKey(input: CreateApiKeyRequest): Promise<CreatedApiKey> {
      const context = await getContext();
      const rawKey = generateRawApiKey();
      const keyPrefix = rawKey.slice(0, 12);
      const createdApiKey = await readSingle<{ id: string; created_at: string }>(
        client
          .from("api_keys")
          .insert({
            organization_id: context.organizationId,
            name: input.name,
            key_prefix: keyPrefix,
            key_hash: hashApiKey(rawKey),
            permissions: [],
          })
          .select("id, created_at")
          .single(),
        "Failed to create API key",
      );

      return createdApiKeySchema.parse({
        id: createdApiKey.id,
        name: input.name,
        maskedKey: maskApiKey(keyPrefix),
        createdAt: createdApiKey.created_at,
        rawKey,
      });
    },

    async deleteApiKey(id: string) {
      const context = await getContext();
      const deletedApiKey = await readMaybeSingle<{ id: string }>(
        client
          .from("api_keys")
          .delete()
          .eq("organization_id", context.organizationId)
          .eq("id", id)
          .select("id")
          .maybeSingle(),
        "Failed to delete API key",
      );

      if (!deletedApiKey) {
        throw new AppError(404, "api_key_not_found", `API key ${id} was not found.`);
      }
    },
  };

  return {
    campaigns,
    contacts,
    callRecords,
    audit,
    voice,
    search,
    dashboard,
    journeys,
    reports,
    settings,
  };
}
