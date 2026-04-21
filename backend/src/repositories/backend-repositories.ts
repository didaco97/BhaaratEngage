import type { CallStatus, CampaignStatus, ContactStatus, SupportedLanguage, TranscriptMode } from "../domain/enums.js";
import type { CollectedField, CallRecord, TranscriptTurn } from "../modules/call-records/call-record.schemas.js";
import type {
  CampaignDetail,
  CampaignField,
  CampaignSummary,
  CreateCampaignRequest,
  UpdateCampaignRequest,
} from "../modules/campaigns/campaign.schemas.js";
import type { Contact, ContactImportSummary, CreateContactRequest, UpdateContactRequest } from "../modules/contacts/contact.schemas.js";
import type { DashboardSnapshot } from "../modules/dashboard/dashboard.schemas.js";
import type { JourneyMonitor } from "../modules/journeys/journey.schemas.js";
import type { ReportsSnapshot } from "../modules/reports/report.schemas.js";
import type {
  ApiKeySummary,
  CreateApiKeyRequest,
  CreatedApiKey,
  InviteTeamMemberRequest,
  NotificationPreferenceUpdate,
  SettingsSnapshot,
  WebhookConfig,
  WorkspaceSettings,
} from "../modules/settings/settings.schemas.js";

export interface CampaignListFilters {
  readonly search?: string;
  readonly status?: CampaignStatus | "all";
}

export type CampaignPauseMode = "manual" | "quiet_hours";

export interface ContactListFilters {
  readonly search?: string;
  readonly status?: ContactStatus | "all";
}

export type CampaignContactDispatchState = "pending" | "in_progress" | CallStatus;

export interface CampaignDialerContact {
  readonly contact: Contact;
  readonly priority: number;
  readonly dispatchStatus: CampaignContactDispatchState;
}

export interface SchedulerCampaign {
  readonly id: string;
  readonly name: string;
  readonly status: CampaignStatus;
  readonly contactCount: number;
  readonly callingWindowStart: string;
  readonly callingWindowEnd: string;
  readonly pauseMode: CampaignPauseMode | null;
}

export interface SetCampaignStatusInput {
  readonly id: string;
  readonly status: CampaignStatus;
  readonly launchedAt?: string;
  readonly pauseMode?: CampaignPauseMode | null;
  readonly expectedCurrentStatus?: CampaignStatus;
  readonly expectedCurrentPauseMode?: CampaignPauseMode | null;
}

export interface UpdateCampaignContactDispatchInput {
  readonly campaignId: string;
  readonly contactId: string;
  readonly dispatchStatus: CampaignContactDispatchState;
  readonly expectedCurrentStatus?: CampaignContactDispatchState;
  readonly lastContactedAt?: string | null;
}

export interface PreparedContactImportRow {
  readonly rowNumber: number;
  readonly payload: Record<string, string>;
  readonly status: "imported" | "duplicate" | "invalid";
  readonly errorMessage?: string;
  readonly contact?: CreateContactRequest;
}

export interface PreparedContactImport {
  readonly filename: string;
  readonly rows: readonly PreparedContactImportRow[];
}

export interface CallRecordListFilters {
  readonly search?: string;
  readonly status?: CallStatus | "all";
  readonly campaignId?: string;
}

export type TranscriptView = "raw" | "redacted";

export interface CampaignRepository {
  list(filters: CampaignListFilters): Promise<CampaignSummary[]>;
  getById(id: string): Promise<CampaignDetail | null>;
  listSchedulerCampaigns(): Promise<SchedulerCampaign[]>;
  listContacts(id: string, filters: ContactListFilters): Promise<Contact[]>;
  listDialerContacts(id: string): Promise<CampaignDialerContact[]>;
  create(input: CreateCampaignRequest): Promise<CampaignDetail>;
  update(id: string, input: UpdateCampaignRequest): Promise<CampaignDetail | null>;
  assignContacts(id: string, contactIds: string[]): Promise<Contact[]>;
  removeContact(id: string, contactId: string): Promise<boolean>;
  setStatus(input: SetCampaignStatusInput): Promise<CampaignDetail | null>;
  duplicate(id: string): Promise<CampaignDetail | null>;
  remove(id: string): Promise<boolean>;
  countDialerContacts(id: string, statuses: readonly CampaignContactDispatchState[]): Promise<number>;
  updateDialerContactDispatch(input: UpdateCampaignContactDispatchInput): Promise<boolean>;
}

export interface ContactRepository {
  list(filters: ContactListFilters): Promise<Contact[]>;
  getById(id: string): Promise<Contact | null>;
  findByPhone(phone: string): Promise<Contact | null>;
  create(input: CreateContactRequest): Promise<Contact>;
  update(id: string, input: UpdateContactRequest): Promise<Contact | null>;
  remove(id: string): Promise<boolean>;
  setStatus(id: string, status: ContactStatus): Promise<Contact | null>;
  importContacts(input: PreparedContactImport): Promise<ContactImportSummary>;
}

export interface CallRecordRepository {
  list(filters: CallRecordListFilters): Promise<CallRecord[]>;
  getById(id: string): Promise<CallRecord | null>;
  getTranscript(id: string, options?: { readonly view?: TranscriptView }): Promise<TranscriptTurn[] | null>;
  getCollectedData(id: string): Promise<CollectedField[] | null>;
  getRecordingUrl(id: string): Promise<string | null>;
}

export interface RecordAuditEventInput {
  readonly action: string;
  readonly entityType: string;
  readonly entityId: string;
  readonly metadata?: Record<string, unknown>;
}

export interface AuditRepository {
  record(input: RecordAuditEventInput): Promise<void>;
}

export interface EnsureVoiceCallSessionInput {
  readonly campaignId: string;
  readonly contactId: string;
  readonly providerCallId: string;
  readonly provider: string;
  readonly startedAt: string;
  readonly transcriptMode?: TranscriptMode;
}

export interface UpdateVoiceCallStatusInput {
  readonly providerCallId: string;
  readonly status: CallStatus;
  readonly disposition: string;
  readonly durationSeconds?: number;
  readonly answeredAt?: string;
  readonly endedAt?: string;
  readonly recordingUrl?: string;
  readonly errorCode?: string;
  readonly confirmed?: boolean;
  readonly fieldsCollected?: number;
  readonly fieldsTotal?: number;
  readonly transcriptMode?: TranscriptMode;
}

export interface ResolveVoiceScopeInput {
  readonly campaignId?: string;
  readonly contactId?: string;
  readonly providerCallId?: string;
}

export interface VoiceScope {
  readonly organizationId: string;
  readonly campaignId?: string;
  readonly contactId?: string;
}

export interface AppendVoiceTranscriptTurnInput {
  readonly providerCallId: string;
  readonly speaker: TranscriptTurn["speaker"];
  readonly textRaw: string;
  readonly textRedacted: string;
}

export interface UpsertVoiceCollectedFieldInput {
  readonly providerCallId: string;
  readonly fieldKey: string;
  readonly label: string;
  readonly rawValue?: string;
  readonly maskedValue?: string;
  readonly sensitive: boolean;
  readonly confidenceScore: number;
  readonly confirmed: boolean;
}

export interface VoiceSessionCollectedField {
  readonly fieldKey: string;
  readonly label: string;
  readonly rawValue: string;
  readonly maskedValue: string;
  readonly confidenceScore: number;
  readonly confirmed: boolean;
  readonly sensitive: boolean;
}

export interface VoiceCallSession {
  readonly callRecordId: string;
  readonly providerCallId: string;
  readonly campaignId: string;
  readonly campaignName: string;
  readonly contactId: string;
  readonly contactName: string;
  readonly phone: string;
  readonly language: SupportedLanguage;
  readonly introPrompt: string;
  readonly purposeStatement: string;
  readonly transferEnabled: boolean;
  readonly transferQueue: string;
  readonly transferTarget: string | null;
  readonly transcriptMode: TranscriptMode;
  readonly fieldsCollected: number;
  readonly fieldsTotal: number;
  readonly fields: readonly CampaignField[];
  readonly collectedData: readonly VoiceSessionCollectedField[];
}

export interface VoiceRepository {
  resolveScope(input: ResolveVoiceScopeInput): Promise<VoiceScope>;
  ensureCallSession(input: EnsureVoiceCallSessionInput): Promise<VoiceCallSession>;
  appendTranscriptTurn(input: AppendVoiceTranscriptTurnInput): Promise<void>;
  upsertCollectedField(input: UpsertVoiceCollectedFieldInput): Promise<CollectedField>;
  clearCollectedData(providerCallId: string): Promise<void>;
  updateCallStatus(input: UpdateVoiceCallStatusInput): Promise<CallRecord | null>;
}

export interface SearchRepository {
  global(query: string): Promise<{
    campaigns: CampaignSummary[];
    contacts: Contact[];
    callRecords: CallRecord[];
  }>;
}

export interface DashboardRepository {
  getSnapshot(): Promise<DashboardSnapshot>;
}

export interface JourneyRepository {
  list(): Promise<JourneyMonitor[]>;
  getById(id: string): Promise<JourneyMonitor | null>;
  updateNextCheckpoint(campaignId: string, nextCheckpointAt: string | null): Promise<boolean>;
}

export interface ReportRepository {
  getSnapshot(): Promise<ReportsSnapshot>;
}

export interface SettingsRepository {
  getSnapshot(): Promise<SettingsSnapshot>;
  findTeamMembersByEmail(email: string): Promise<Array<{ id: string; organizationId: string }>>;
  updateWorkspaceSettings(input: WorkspaceSettings): Promise<SettingsSnapshot>;
  updateNotificationPreferences(input: NotificationPreferenceUpdate[]): Promise<SettingsSnapshot>;
  updateWebhookConfig(input: WebhookConfig): Promise<SettingsSnapshot>;
  inviteTeamMember(input: InviteTeamMemberRequest): Promise<SettingsSnapshot>;
  updateTeamMemberRole(userId: string, role: InviteTeamMemberRequest["role"]): Promise<SettingsSnapshot>;
  removeTeamMember(userId: string): Promise<SettingsSnapshot>;
  listApiKeys(): Promise<ApiKeySummary[]>;
  createApiKey(input: CreateApiKeyRequest): Promise<CreatedApiKey>;
  deleteApiKey(id: string): Promise<void>;
}

export interface BackendRepositories {
  readonly campaigns: CampaignRepository;
  readonly contacts: ContactRepository;
  readonly callRecords: CallRecordRepository;
  readonly audit: AuditRepository;
  readonly voice: VoiceRepository;
  readonly search: SearchRepository;
  readonly dashboard: DashboardRepository;
  readonly journeys: JourneyRepository;
  readonly reports: ReportRepository;
  readonly settings: SettingsRepository;
}
