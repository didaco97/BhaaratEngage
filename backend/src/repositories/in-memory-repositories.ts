import { randomUUID } from "node:crypto";

import type { CampaignStatus } from "../domain/enums.js";
import { AppError } from "../lib/http-errors.js";
import {
  buildComplianceAlerts,
  buildProviderPerformanceSnapshot,
  buildTransferQueueSummaries,
  resolveOperationalReferenceTime,
} from "../lib/operational-metrics.js";
import { getRequestPrincipal } from "../modules/auth/request-auth-context.js";
import type { CallRecord, CollectedField } from "../modules/call-records/call-record.schemas.js";
import type { CampaignDetail, CampaignSummary, CreateCampaignRequest, UpdateCampaignRequest } from "../modules/campaigns/campaign.schemas.js";
import type { Contact, CreateContactRequest } from "../modules/contacts/contact.schemas.js";
import type { DashboardSnapshot, LiveCampaignCard, RecentAttempt } from "../modules/dashboard/dashboard.schemas.js";
import type { JourneyMonitor } from "../modules/journeys/journey.schemas.js";
import { formatJourneyNextCheckpoint } from "../modules/journeys/journey-read-model.js";
import type { ReportsSnapshot } from "../modules/reports/report.schemas.js";
import type {
  ApiKeySummary,
  CreateApiKeyRequest,
  CreatedApiKey,
  InviteTeamMemberRequest,
  SettingsSnapshot,
} from "../modules/settings/settings.schemas.js";
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
import { createSeedState, type SeedState } from "./seed-data.js";

function clone<T>(value: T): T {
  return structuredClone(value);
}

function normalizeQuery(value?: string) {
  return value?.trim().toLowerCase() ?? "";
}

function roundToSingleDecimal(value: number) {
  return Math.round(value * 10) / 10;
}

function percentageOf(part: number, total: number) {
  if (total <= 0) {
    return 0;
  }

  return roundToSingleDecimal((part / total) * 100);
}

function maskApiKey(prefix: string) {
  return `${prefix}************************`;
}

function generateRawApiKey() {
  return `bv_live_${randomUUID().replace(/-/g, "")}`;
}

function syncPrimaryWorkspaceMemberCount(state: SeedState) {
  const primaryWorkspace = state.workspaces[0];

  if (primaryWorkspace) {
    primaryWorkspace.members = state.teamMembers.length;
  }
}

function getPrimaryWorkspaceId(state: SeedState) {
  return state.workspaces[0]?.id ?? "workspace-001";
}

function buildSequencePreview(input: CreateCampaignRequest) {
  const sequence = ["Voice first"];

  if (input.journey.unansweredAction === "sms") {
    sequence.push("SMS if unanswered");
  } else if (input.journey.unansweredAction === "whatsapp") {
    sequence.push("WhatsApp if unanswered");
  } else if (input.journey.unansweredAction === "retry") {
    sequence.push("Retry voice if unanswered");
  }

  if (input.journey.partialAction === "sms") {
    sequence.push("SMS if partial");
  } else if (input.journey.partialAction === "whatsapp") {
    sequence.push("WhatsApp if partial");
  } else if (input.journey.partialAction === "retry") {
    sequence.push("Retry voice if partial");
  }

  return sequence;
}

function toCampaignDetail(input: CreateCampaignRequest): CampaignDetail {
  return {
    id: `camp-${randomUUID()}`,
    name: input.setup.campaignName,
    status: "draft",
    language: input.setup.language,
    vertical: input.setup.vertical,
    template: `${input.setup.vertical} workflow`,
    workspace: "HDFC Collections",
    callerIdentity: input.setup.callerIdentity,
    summary: input.setup.purposeStatement,
    contactCount: 0,
    completionRate: 0,
    answerRate: 0,
    confirmationRate: 0,
    createdAt: new Date().toISOString(),
    quietHours: `${input.setup.callingWindowStart} to ${input.setup.callingWindowEnd} IST`,
    transferQueue: input.setup.transferEnabled ? input.setup.transferQueue : "No transfer queue",
    sensitiveFieldCount: input.fields.filter((field) => field.sensitive).length,
    sequence: buildSequencePreview(input),
    fields: clone(input.fields),
    setup: clone({
      ...input.setup,
      transferQueue: input.setup.transferEnabled ? input.setup.transferQueue : "",
    }),
    journey: clone(input.journey),
  };
}

function toUpdatedCampaignDetail(currentCampaign: CampaignDetail, input: UpdateCampaignRequest): CampaignDetail {
  return {
    ...currentCampaign,
    name: input.setup.campaignName,
    language: input.setup.language,
    vertical: input.setup.vertical,
    template: `${input.setup.vertical} workflow`,
    callerIdentity: input.setup.callerIdentity,
    summary: input.setup.purposeStatement,
    quietHours: `${input.setup.callingWindowStart} to ${input.setup.callingWindowEnd} IST`,
    transferQueue: input.setup.transferEnabled ? input.setup.transferQueue : "No transfer queue",
    sensitiveFieldCount: input.fields.filter((field) => field.sensitive).length,
    sequence: buildSequencePreview(input),
    fields: clone(input.fields),
    setup: clone({
      ...input.setup,
      transferQueue: input.setup.transferEnabled ? input.setup.transferQueue : "",
    }),
    journey: clone(input.journey),
  };
}

function toVoiceCallSession(input: {
  campaign: CampaignDetail;
  contact: Contact;
  callRecord: CallRecord;
  providerCallId: string;
  transferQueueName: string;
  transferTarget: string | null;
  collectedData: readonly VoiceSessionCollectedField[];
}): VoiceCallSession {
  return {
    callRecordId: input.callRecord.id,
    providerCallId: input.providerCallId,
    campaignId: input.campaign.id,
    campaignName: input.campaign.name,
    contactId: input.contact.id,
    contactName: input.contact.name,
    phone: input.contact.phone,
    language: input.campaign.language,
    introPrompt: input.campaign.setup.introScript,
    purposeStatement: input.campaign.setup.purposeStatement,
    transferEnabled: input.transferQueueName.trim().length > 0,
    transferQueue: input.transferQueueName,
    transferTarget: input.transferTarget,
    transcriptMode: input.callRecord.transcriptMode,
    fieldsCollected: input.callRecord.fieldsCollected,
    fieldsTotal: input.callRecord.fieldsTotal,
    fields: clone(input.campaign.fields),
    collectedData: clone(input.collectedData),
  };
}

function toPublicCollectedField(field: VoiceSessionCollectedField): CollectedField {
  return {
    fieldKey: field.fieldKey,
    label: field.label,
    value: field.sensitive ? field.maskedValue : field.rawValue,
    confidenceScore: field.confidenceScore,
    confirmed: field.confirmed,
    masked: field.sensitive,
  };
}

function formatAuditTimeLabel(value: string) {
  const formatter = new Intl.DateTimeFormat("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Kolkata",
  });

  return `${formatter.format(new Date(value))} IST`;
}

function formatJourneyCheckpointLabel(value: string | null, status: JourneyMonitor["status"]) {
  return formatJourneyNextCheckpoint({
    status,
    nextCheckpointAt: value,
    formatScheduledCheckpoint(nextCheckpointAt) {
      const checkpoint = new Date(nextCheckpointAt);

      if (Number.isNaN(checkpoint.valueOf())) {
        return "Not scheduled";
      }

      const dateFormatter = new Intl.DateTimeFormat("en-IN", {
        day: "2-digit",
        month: "short",
        timeZone: "Asia/Kolkata",
      });
      const timeFormatter = new Intl.DateTimeFormat("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: "Asia/Kolkata",
      });

      return `${dateFormatter.format(checkpoint).replace(",", "")} ${timeFormatter.format(checkpoint)} IST`;
    },
  });
}

function resolveInMemoryTransferTarget(queueName: string) {
  const normalized = queueName.trim().toLowerCase();

  if (!normalized || normalized === "no transfer queue") {
    return null;
  }

  const transferTargetByQueueName: Record<string, string> = {
    "mumbai review desk": "+918000000101",
    "renewal specialists": "+918000000102",
    "loan advisors": "+918000000103",
    "scheduling desk": "+918000000104",
    "card support": "+918000000105",
    "priority desk": "+918000000106",
  };

  return transferTargetByQueueName[normalized] ?? `+91800000${Math.abs([...normalized].reduce((sum, char) => sum + char.charCodeAt(0), 0)).toString().slice(0, 4).padStart(4, "0")}`;
}

function resolveInMemoryTransferQueueActiveAgents(queueName: string) {
  const normalized = queueName.trim().toLowerCase();

  if (!normalized || normalized === "no transfer queue") {
    return 1;
  }

  const activeAgentsByQueueName: Record<string, number> = {
    "mumbai review desk": 4,
    "renewal specialists": 3,
    "loan advisors": 2,
    "scheduling desk": 3,
    "card support": 2,
    "priority desk": 5,
  };

  return activeAgentsByQueueName[normalized] ?? 2;
}

function parseInMemorySlaToSeconds(value: string) {
  const match = value.match(/(?<minutes>\d+)m\s+(?<seconds>\d+)s/u);

  if (!match?.groups) {
    return 0;
  }

  return Number(match.groups.minutes) * 60 + Number(match.groups.seconds);
}

function toLiveCampaignCard(campaign: CampaignSummary): LiveCampaignCard {
  return {
    id: campaign.id,
    name: campaign.name,
    status: campaign.status,
    summary: campaign.summary,
    answerRate: campaign.answerRate,
    completionRate: campaign.completionRate,
    confirmationRate: campaign.confirmationRate,
  };
}

function toCampaignSummaryRecord(campaign: CampaignDetail): CampaignSummary {
  const { setup: _setup, journey: _journey, ...summary } = campaign;
  return clone(summary);
}

function toRecentAttempt(record: CallRecord): RecentAttempt {
  return {
    id: record.id,
    contactName: record.contactName,
    phone: record.phone,
    campaignName: record.campaignName,
    provider: record.provider,
    status: record.status,
    durationSeconds: record.duration,
  };
}

function buildDashboardSnapshot(
  state: SeedState,
  options: {
    readonly pauseModeByCampaignId?: ReadonlyMap<string, CampaignPauseMode>;
    readonly transferQueueNameByCallRecordId?: ReadonlyMap<string, string>;
    readonly endedAtByCallRecordId?: ReadonlyMap<string, string>;
  } = {},
): DashboardSnapshot {
  const liveCampaigns = state.campaigns.filter((campaign) => campaign.status === "active").map(toLiveCampaignCard);
  const recentAttempts = [...state.callRecords]
    .sort((left, right) => right.startedAt.localeCompare(left.startedAt))
    .slice(0, 5)
    .map(toRecentAttempt);
  const principal = getRequestPrincipal();
  const campaignById = new Map(state.campaigns.map((campaign) => [campaign.id, campaign] as const));
  const referenceTime = resolveOperationalReferenceTime([
    ...state.callRecords.flatMap((record) => [record.startedAt, options.endedAtByCallRecordId?.get(record.id)]),
    ...state.campaigns.flatMap((campaign) => [campaign.launchedAt ?? campaign.createdAt]),
  ]);
  const operationalCallRecords = state.callRecords.map((record) => {
    const campaign = campaignById.get(record.campaignId);

    return {
      provider: record.provider,
      status: record.status,
      disposition: record.disposition,
      startedAt: record.startedAt,
      endedAt: options.endedAtByCallRecordId?.get(record.id),
      errorCode: record.errorCode,
      transferQueueName:
        options.transferQueueNameByCallRecordId?.get(record.id) ??
        (campaign?.setup.transferEnabled ? campaign.setup.transferQueue : undefined),
    };
  });
  const operationalCampaigns = state.campaigns.map((campaign) => ({
    id: campaign.id,
    name: campaign.name,
    status: campaign.status,
    pauseMode: options.pauseModeByCampaignId?.get(campaign.id) ?? null,
    createdAt: campaign.createdAt,
    launchedAt: campaign.launchedAt ?? null,
  }));
  const mergedComplianceAlerts = [...buildComplianceAlerts({
    campaigns: operationalCampaigns,
    callRecords: operationalCallRecords,
    settings: {
      quietHoursAutoPause: state.workspaceSettings.quietHoursAutoPause,
    },
    referenceTime,
  })];

  for (const alert of state.complianceAlerts) {
    if (!mergedComplianceAlerts.some((entry) => entry.title === alert.title && entry.detail === alert.detail)) {
      mergedComplianceAlerts.push(clone(alert));
    }
  }

  const transferQueueConfigByName = new Map(
    state.transferQueues.map((queue) => [
      queue.queue,
      {
        name: queue.queue,
        activeAgents: resolveInMemoryTransferQueueActiveAgents(queue.queue),
        waitingCount: queue.waiting,
        currentSlaSeconds: parseInMemorySlaToSeconds(queue.sla),
      },
    ] as const),
  );

  for (const campaign of state.campaigns) {
    if (!campaign.setup.transferEnabled || !campaign.setup.transferQueue.trim()) {
      continue;
    }

    if (!transferQueueConfigByName.has(campaign.setup.transferQueue)) {
      transferQueueConfigByName.set(campaign.setup.transferQueue, {
        name: campaign.setup.transferQueue,
        activeAgents: resolveInMemoryTransferQueueActiveAgents(campaign.setup.transferQueue),
        waitingCount: 0,
        currentSlaSeconds: 0,
      });
    }
  }

  return {
    workspace: {
      name: state.workspaceSettings.workspaceName,
    },
    viewer: {
      userId: principal?.userId ?? "workspace-user",
      fullName: principal?.fullName ?? "Workspace User",
      email: principal?.email ?? "workspace@example.com",
      role: principal?.role ?? "workspace_admin",
    },
    overview: {
      ...clone(state.dashboardOverview),
      activeCampaigns: liveCampaigns.length,
      totalCampaigns: state.campaigns.length,
    },
    voiceThroughput: clone(state.voiceThroughput),
    liveCampaigns,
    complianceAlerts: mergedComplianceAlerts.slice(0, 5),
    transferQueues: buildTransferQueueSummaries({
      queues: [...transferQueueConfigByName.values()],
      callRecords: operationalCallRecords,
      referenceTime,
    }),
    auditEvents: clone(state.auditEvents),
    dispositionBreakdown: clone(state.dispositionBreakdown),
    recentAttempts,
  };
}

function buildReportsSnapshot(
  state: SeedState,
  options: {
    readonly transferQueueNameByCallRecordId?: ReadonlyMap<string, string>;
    readonly endedAtByCallRecordId?: ReadonlyMap<string, string>;
  } = {},
): ReportsSnapshot {
  const campaignById = new Map(state.campaigns.map((campaign) => [campaign.id, campaign] as const));
  const referenceTime = resolveOperationalReferenceTime(state.callRecords.map((record) => record.startedAt));
  const providerPerformance = buildProviderPerformanceSnapshot({
    callRecords: state.callRecords.map((record) => {
      const campaign = campaignById.get(record.campaignId);

      return {
        provider: record.provider,
        status: record.status,
        disposition: record.disposition,
        startedAt: record.startedAt,
        errorCode: record.errorCode,
        transferQueueName:
          options.transferQueueNameByCallRecordId?.get(record.id) ??
          (campaign?.setup.transferEnabled ? campaign.setup.transferQueue : undefined),
      };
    }),
    referenceTime,
  });

  return {
    overview: buildDashboardSnapshot(state, {
      endedAtByCallRecordId: options.endedAtByCallRecordId,
      transferQueueNameByCallRecordId: options.transferQueueNameByCallRecordId,
    }).overview,
    dailyVolume: clone(state.voiceThroughput),
    fieldDropoff: clone(state.fieldDropoff),
    providerPerformance,
    dispositionBreakdown: clone(state.dispositionBreakdown),
  };
}

function buildSettingsSnapshot(state: SeedState): SettingsSnapshot {
  return {
    workspaceSettings: clone(state.workspaceSettings),
    workspaces: clone(state.workspaces),
    teamMembers: clone(state.teamMembers),
    securityControls: clone(state.securityControls),
    notificationPreferences: clone(state.notificationPreferences),
    apiAccess: clone(state.apiAccess),
    apiKeys: clone(state.apiKeys),
  };
}

function adjustCampaignAssignmentCount(state: SeedState, campaignId: string | undefined, delta: number) {
  if (!campaignId || delta === 0) {
    return;
  }

  const campaign = state.campaigns.find((entry) => entry.id === campaignId);

  if (campaign) {
    campaign.contactCount = Math.max(0, campaign.contactCount + delta);
  }

  const journey = state.journeys.find((entry) => entry.campaignId === campaignId);

  if (journey) {
    journey.totalContacts = Math.max(0, journey.totalContacts + delta);
  }
}

interface InMemoryCampaignContactAssignment {
  campaignId: string;
  contactId: string;
  priority: number;
  status: CampaignContactDispatchState;
  addedAt: string;
  updatedAt: string;
}

export function createInMemoryRepositories(seed: SeedState = createSeedState()): BackendRepositories {
  const state = clone(seed);
  const rawCollectedValueByCallId = Object.fromEntries(
    Object.entries(state.collectedDataByCallId).map(([callRecordId, fields]) => [
      callRecordId,
      Object.fromEntries(fields.map((field) => [field.fieldKey, field.rawValue])),
    ]),
  ) as Record<string, Record<string, string>>;
  const campaignContactAssignments = state.contacts.reduce<InMemoryCampaignContactAssignment[]>((assignments, contact) => {
    if (!contact.campaignId) {
      return assignments;
    }

    const priority = assignments.filter((entry) => entry.campaignId === contact.campaignId).length + 1;
    const addedAt = contact.lastContactedAt ?? new Date().toISOString();
    assignments.push({
      campaignId: contact.campaignId,
      contactId: contact.id,
      priority,
      status: "pending",
      addedAt,
      updatedAt: addedAt,
    });
    return assignments;
  }, []);
  const campaignPauseModeById = new Map<string, CampaignPauseMode>(
    state.campaigns
      .filter((campaign) => campaign.status === "paused")
      .map((campaign) => [campaign.id, "manual"] as const),
  );
  const campaignById = new Map(state.campaigns.map((campaign) => [campaign.id, campaign] as const));
  const transferQueueNameByCallRecordId = new Map<string, string>();
  const endedAtByCallRecordId = new Map<string, string>();

  for (const record of state.callRecords) {
    const campaign = campaignById.get(record.campaignId);

    if (campaign?.setup.transferEnabled && campaign.setup.transferQueue.trim()) {
      transferQueueNameByCallRecordId.set(record.id, campaign.setup.transferQueue);
    }
  }

  function listCampaignContactAssignments(campaignId: string) {
    return campaignContactAssignments
      .filter((assignment) => assignment.campaignId === campaignId)
      .sort((left, right) => left.priority - right.priority || left.addedAt.localeCompare(right.addedAt));
  }

  function resequenceCampaignContactAssignments(campaignId: string) {
    listCampaignContactAssignments(campaignId).forEach((assignment, index) => {
      assignment.priority = index + 1;
    });
  }

  function upsertCampaignContactAssignment(
    campaignId: string,
    contactId: string,
    input: {
      priority?: number;
      status?: CampaignContactDispatchState;
    } = {},
  ) {
    const now = new Date().toISOString();
    const existingAssignment = campaignContactAssignments.find(
      (assignment) => assignment.campaignId === campaignId && assignment.contactId === contactId,
    );

    if (existingAssignment) {
      existingAssignment.priority = input.priority ?? existingAssignment.priority;
      existingAssignment.status = input.status ?? existingAssignment.status;
      existingAssignment.updatedAt = now;
      resequenceCampaignContactAssignments(campaignId);
      return existingAssignment;
    }

    const nextAssignment: InMemoryCampaignContactAssignment = {
      campaignId,
      contactId,
      priority: input.priority ?? listCampaignContactAssignments(campaignId).length + 1,
      status: input.status ?? "pending",
      addedAt: now,
      updatedAt: now,
    };
    campaignContactAssignments.push(nextAssignment);
    resequenceCampaignContactAssignments(campaignId);
    return nextAssignment;
  }

  function removeCampaignContactAssignment(campaignId: string, contactId: string) {
    const assignmentIndex = campaignContactAssignments.findIndex(
      (assignment) => assignment.campaignId === campaignId && assignment.contactId === contactId,
    );

    if (assignmentIndex === -1) {
      return false;
    }

    campaignContactAssignments.splice(assignmentIndex, 1);
    resequenceCampaignContactAssignments(campaignId);
    return true;
  }

  function removeAssignmentsForContact(contactId: string) {
    const affectedCampaignIds = [...new Set(
      campaignContactAssignments
        .filter((assignment) => assignment.contactId === contactId)
        .map((assignment) => assignment.campaignId),
    )];

    for (let index = campaignContactAssignments.length - 1; index >= 0; index -= 1) {
      if (campaignContactAssignments[index]?.contactId === contactId) {
        campaignContactAssignments.splice(index, 1);
      }
    }

    for (const campaignId of affectedCampaignIds) {
      resequenceCampaignContactAssignments(campaignId);
    }
  }

  function setPrimaryCampaignAssignment(
    contactId: string,
    nextCampaignId?: string,
    input: {
      priority?: number;
      status?: CampaignContactDispatchState;
    } = {},
  ) {
    const index = state.contacts.findIndex((contact) => contact.id === contactId);

    if (index === -1) {
      return null;
    }

    const currentContact = state.contacts[index];

    if (!currentContact) {
      return null;
    }

    const currentCampaignId = currentContact.campaignId;

    if (currentCampaignId !== nextCampaignId) {
      adjustCampaignAssignmentCount(state, currentCampaignId, -1);
      adjustCampaignAssignmentCount(state, nextCampaignId, 1);
    }

    if (currentCampaignId && currentCampaignId !== nextCampaignId) {
      removeCampaignContactAssignment(currentCampaignId, contactId);
    }

    if (nextCampaignId) {
      upsertCampaignContactAssignment(nextCampaignId, contactId, {
        priority: input.priority,
        status: input.status,
      });
    }

    const updatedContact: Contact = {
      ...currentContact,
      campaignId: nextCampaignId,
    };

    state.contacts[index] = updatedContact;
    return updatedContact;
  }

  function toJourneyStatus(status: CampaignStatus): JourneyMonitor["status"] | null {
    if (status === "active" || status === "paused" || status === "completed") {
      return status;
    }

    return null;
  }

  function countProcessedJourneyContacts(campaignId: string) {
    return listCampaignContactAssignments(campaignId).filter((assignment) => assignment.status !== "pending").length;
  }

  function syncJourneyMonitorForCampaign(campaign: CampaignDetail, status: CampaignStatus = campaign.status) {
    const journeyStatus = toJourneyStatus(status);

    if (!journeyStatus) {
      return;
    }

    const existingJourneyIndex = state.journeys.findIndex((entry) => entry.campaignId === campaign.id);
    const existingJourney = existingJourneyIndex >= 0 ? state.journeys[existingJourneyIndex] : null;
    const nextCheckpointAt = state.journeyCheckpointAtByCampaignId[campaign.id] ?? null;
    const nextJourney: JourneyMonitor = {
      id: existingJourney?.id ?? `jrn-${randomUUID()}`,
      campaignId: campaign.id,
      campaignName: campaign.name,
      sequence: clone(campaign.sequence),
      status: journeyStatus,
      totalContacts: campaign.contactCount,
      processed: Math.max(existingJourney?.processed ?? 0, countProcessedJourneyContacts(campaign.id)),
      successRate: campaign.completionRate,
      retryWindowHours: campaign.journey.retryWindowHours,
      concurrencyLimit: campaign.journey.concurrencyLimit,
      pacingPerMinute: campaign.journey.pacingPerMinute,
      nextCheckpoint: formatJourneyCheckpointLabel(nextCheckpointAt, journeyStatus),
    };

    if (existingJourneyIndex >= 0) {
      state.journeys[existingJourneyIndex] = nextJourney;
      return;
    }

    state.journeys.unshift(nextJourney);
  }

  function syncCampaignPerformance(campaignId: string) {
    const campaignIndex = state.campaigns.findIndex((entry) => entry.id === campaignId);

    if (campaignIndex === -1) {
      return;
    }

    const currentCampaign = state.campaigns[campaignIndex];

    if (!currentCampaign) {
      return;
    }

    const relatedCallRecords = state.callRecords.filter((record) => record.campaignId === campaignId);
    const updatedCampaign: CampaignDetail = {
      ...currentCampaign,
      completionRate: percentageOf(
        relatedCallRecords.filter((record) => record.status === "completed").length,
        relatedCallRecords.length,
      ),
      answerRate: percentageOf(
        relatedCallRecords.filter((record) => record.status === "completed" || record.status === "transferred").length,
        relatedCallRecords.length,
      ),
      confirmationRate: percentageOf(
        relatedCallRecords.filter((record) => record.confirmed).length,
        relatedCallRecords.length,
      ),
    };

    state.campaigns[campaignIndex] = updatedCampaign;
    syncJourneyMonitorForCampaign(updatedCampaign);
  }

  const audit: AuditRepository = {
    async record(input: RecordAuditEventInput) {
      const principal = getRequestPrincipal();
      const createdAt = new Date().toISOString();
      state.auditEvents.unshift({
        id: `evt-${randomUUID()}`,
        actor: principal?.fullName ?? "System",
        action: input.action,
        entity:
          (typeof input.metadata?.displayName === "string" && input.metadata.displayName.trim()) ||
          (typeof input.metadata?.entityName === "string" && input.metadata.entityName.trim()) ||
          input.entityId,
        time: formatAuditTimeLabel(createdAt),
      });
      state.auditEvents = state.auditEvents.slice(0, 20);
      state.dashboardOverview.auditEventsToday += 1;

      if (input.action.toLowerCase().includes("export")) {
        state.dashboardOverview.maskedExportsToday += 1;
      }
    },
  };

  const campaigns = {
    async list(filters: CampaignListFilters) {
      const query = normalizeQuery(filters.search);

      return state.campaigns
        .filter((campaign) => {
          const matchesStatus = !filters.status || filters.status === "all" || campaign.status === filters.status;
          const matchesQuery =
            query.length === 0 ||
            campaign.name.toLowerCase().includes(query) ||
            campaign.vertical.toLowerCase().includes(query) ||
            campaign.template.toLowerCase().includes(query);

          return matchesStatus && matchesQuery;
        })
        .map(toCampaignSummaryRecord);
    },

    async getById(id: string) {
      const campaign = state.campaigns.find((entry) => entry.id === id);
      return campaign ? clone(campaign) : null;
    },

    async listSchedulerCampaigns() {
      return state.campaigns.map<SchedulerCampaign>((campaign) => ({
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        contactCount: campaign.contactCount,
        callingWindowStart: campaign.setup.callingWindowStart,
        callingWindowEnd: campaign.setup.callingWindowEnd,
        pauseMode: campaignPauseModeById.get(campaign.id) ?? null,
      }));
    },

    async listContacts(id: string, filters: ContactListFilters) {
      const query = normalizeQuery(filters.search);
      const contactsById = new Map(state.contacts.map((contact) => [contact.id, contact] as const));

      return listCampaignContactAssignments(id)
        .map((assignment) => contactsById.get(assignment.contactId))
        .filter((contact): contact is Contact => Boolean(contact))
        .filter((contact) => {
          const matchesStatus = !filters.status || filters.status === "all" || contact.status === filters.status;
          const matchesQuery =
            query.length === 0 ||
            contact.name.toLowerCase().includes(query) ||
            contact.phone.includes(query) ||
            contact.workspace.toLowerCase().includes(query) ||
            contact.source.toLowerCase().includes(query);

          return matchesStatus && matchesQuery;
        })
        .map(clone);
    },

    async listDialerContacts(id: string) {
      const contactsById = new Map(state.contacts.map((contact) => [contact.id, contact] as const));

      return listCampaignContactAssignments(id)
        .map((assignment) => {
          const contact = contactsById.get(assignment.contactId);

          if (!contact) {
            return null;
          }

          const dialerContact: CampaignDialerContact = {
            contact: clone(contact),
            priority: assignment.priority,
            dispatchStatus: assignment.status,
          };

          return dialerContact;
        })
        .filter((contact): contact is CampaignDialerContact => Boolean(contact));
    },

    async create(input: CreateCampaignRequest) {
      const campaign = toCampaignDetail(input);
      state.campaigns.unshift(campaign);
      return clone(campaign);
    },

    async update(id: string, input: UpdateCampaignRequest) {
      const index = state.campaigns.findIndex((entry) => entry.id === id);

      if (index === -1) {
        return null;
      }

      const currentCampaign = state.campaigns[index];

      if (!currentCampaign) {
        return null;
      }

      const updatedCampaign = toUpdatedCampaignDetail(currentCampaign, input);
      state.campaigns[index] = updatedCampaign;
      state.callRecords = state.callRecords.map((record) =>
        record.campaignId === id
          ? {
              ...record,
              campaignName: updatedCampaign.name,
              language: updatedCampaign.language,
            }
          : record,
      );
      state.journeys = state.journeys.map((journey) =>
        journey.campaignId === id
          ? {
              ...journey,
              campaignName: updatedCampaign.name,
              sequence: clone(updatedCampaign.sequence),
              retryWindowHours: input.journey.retryWindowHours,
              concurrencyLimit: input.journey.concurrencyLimit,
              pacingPerMinute: input.journey.pacingPerMinute,
            }
          : journey,
      );
      syncJourneyMonitorForCampaign(updatedCampaign);

      return clone(updatedCampaign);
    },

    async assignContacts(id: string, contactIds: string[]) {
      const uniqueContactIds = [...new Set(contactIds)];
      const existingContactIds = listCampaignContactAssignments(id)
        .map((assignment) => assignment.contactId)
        .filter((contactId) => !uniqueContactIds.includes(contactId));
      const orderedContactIds = [...uniqueContactIds, ...existingContactIds];

      for (const contactId of uniqueContactIds) {
        setPrimaryCampaignAssignment(contactId, id, {
          status: "pending",
        });
      }

      orderedContactIds.forEach((contactId, index) => {
        upsertCampaignContactAssignment(id, contactId, {
          priority: index + 1,
          status: uniqueContactIds.includes(contactId)
            ? "pending"
            : campaignContactAssignments.find((assignment) => assignment.campaignId === id && assignment.contactId === contactId)?.status,
        });
      });

      return campaigns.listContacts(id, { status: "all" });
    },

    async setStatus(input: SetCampaignStatusInput) {
      const index = state.campaigns.findIndex((entry) => entry.id === input.id);

      if (index === -1) {
        return null;
      }

      const currentCampaign = state.campaigns[index];

      if (!currentCampaign) {
        return null;
      }

      if (input.expectedCurrentStatus && currentCampaign.status !== input.expectedCurrentStatus) {
        return null;
      }

      const currentPauseMode = campaignPauseModeById.get(input.id) ?? null;

      if ("expectedCurrentPauseMode" in input && input.expectedCurrentPauseMode !== currentPauseMode) {
        return null;
      }

      const updatedCampaign: CampaignDetail = {
        ...currentCampaign,
        status: input.status,
        launchedAt:
          input.status === "active"
            ? input.launchedAt ?? currentCampaign.launchedAt ?? new Date().toISOString()
            : currentCampaign.launchedAt,
      };
      const nextJourneyStatus =
        input.status === "active" || input.status === "paused" || input.status === "completed" ? input.status : null;

      if (input.status === "paused") {
        campaignPauseModeById.set(input.id, input.pauseMode ?? "manual");
      } else {
        campaignPauseModeById.delete(input.id);
      }

      state.campaigns[index] = updatedCampaign;
      if (nextJourneyStatus) {
        syncJourneyMonitorForCampaign(updatedCampaign, input.status);
      }

      return clone(updatedCampaign);
    },

    async duplicate(id: string) {
      const original = state.campaigns.find((entry) => entry.id === id);

      if (!original) {
        return null;
      }

      const duplicateCampaign: CampaignDetail = {
        ...clone(original),
        id: `camp-${randomUUID()}`,
        name: `${original.name} copy`,
        status: "draft",
        createdAt: new Date().toISOString(),
        launchedAt: undefined,
        contactCount: 0,
        completionRate: 0,
        answerRate: 0,
        confirmationRate: 0,
        setup: {
          ...clone(original.setup),
          campaignName: `${original.name} copy`,
        },
      };

      state.campaigns.unshift(duplicateCampaign);
      campaignPauseModeById.delete(duplicateCampaign.id);
      delete state.journeyCheckpointAtByCampaignId[duplicateCampaign.id];
      return clone(duplicateCampaign);
    },

    async removeContact(id: string, contactId: string) {
      const contact = state.contacts.find((entry) => entry.id === contactId);

      if (!contact || contact.campaignId !== id) {
        return false;
      }

      setPrimaryCampaignAssignment(contactId, undefined);
      return true;
    },

    async remove(id: string) {
      const nextCampaigns = state.campaigns.filter((entry) => entry.id !== id);
      const removed = nextCampaigns.length !== state.campaigns.length;

      if (!removed) {
        return false;
      }

      state.campaigns = nextCampaigns;
      campaignPauseModeById.delete(id);
      delete state.journeyCheckpointAtByCampaignId[id];
      state.journeys = state.journeys.filter((journey) => journey.campaignId !== id);

      const removedCallRecordIds = state.callRecords
        .filter((record) => record.campaignId === id)
        .map((record) => record.id);

      state.callRecords = state.callRecords.filter((record) => record.campaignId !== id);
      state.dashboardOverview.totalCalls = Math.max(0, state.dashboardOverview.totalCalls - removedCallRecordIds.length);

      for (const callRecordId of removedCallRecordIds) {
        delete state.recordingUrlsByCallId[callRecordId];
        delete state.transcriptsByCallId[callRecordId];
        delete state.collectedDataByCallId[callRecordId];
        delete rawCollectedValueByCallId[callRecordId];
        endedAtByCallRecordId.delete(callRecordId);
      }

      state.contacts = state.contacts.map((contact) =>
        contact.campaignId === id
          ? {
              ...contact,
              campaignId: undefined,
            }
          : contact,
      );
      for (let index = campaignContactAssignments.length - 1; index >= 0; index -= 1) {
        if (campaignContactAssignments[index]?.campaignId === id) {
          campaignContactAssignments.splice(index, 1);
        }
      }

      return removed;
    },

    async countDialerContacts(id: string, statuses: readonly CampaignContactDispatchState[]) {
      if (statuses.length === 0) {
        return 0;
      }

      const statusSet = new Set(statuses);

      return listCampaignContactAssignments(id).filter((assignment) => statusSet.has(assignment.status)).length;
    },

    async updateDialerContactDispatch(input: UpdateCampaignContactDispatchInput) {
      const assignment = campaignContactAssignments.find(
        (entry) => entry.campaignId === input.campaignId && entry.contactId === input.contactId,
      );

      if (!assignment) {
        return false;
      }

      if (input.expectedCurrentStatus && assignment.status !== input.expectedCurrentStatus) {
        return false;
      }

      assignment.status = input.dispatchStatus;
      assignment.updatedAt = new Date().toISOString();

      if ("lastContactedAt" in input) {
        const contactIndex = state.contacts.findIndex((contact) => contact.id === input.contactId);

        if (contactIndex >= 0) {
          const currentContact = state.contacts[contactIndex];

          if (currentContact) {
            state.contacts[contactIndex] = {
              ...currentContact,
              lastContactedAt: input.lastContactedAt ?? undefined,
            };
          }
        }
      }

      const campaign = state.campaigns.find((entry) => entry.id === input.campaignId);

      if (campaign) {
        syncJourneyMonitorForCampaign(campaign);
      }

      return true;
    },
  };

  const contacts = {
    async list(filters: ContactListFilters) {
      const query = normalizeQuery(filters.search);

      return state.contacts
        .filter((contact) => {
          const matchesStatus = !filters.status || filters.status === "all" || contact.status === filters.status;
          const matchesQuery =
            query.length === 0 ||
            contact.name.toLowerCase().includes(query) ||
            contact.phone.includes(query) ||
            contact.workspace.toLowerCase().includes(query) ||
            contact.source.toLowerCase().includes(query);

          return matchesStatus && matchesQuery;
        })
        .map(clone);
    },

    async getById(id: string) {
      const matchedContact = state.contacts.find((contact) => contact.id === id);
      return matchedContact ? clone(matchedContact) : null;
    },

    async findByPhone(phone: string) {
      const matchedContact = state.contacts.find((contact) => contact.phone === phone);
      return matchedContact ? clone(matchedContact) : null;
    },

    async create(input: CreateContactRequest) {
      if (state.contacts.some((contact) => contact.phone === input.phone)) {
        throw new AppError(409, "contact_phone_exists", `A contact with phone ${input.phone} already exists.`);
      }

      const contact: Contact = {
        id: `contact-${randomUUID()}`,
        name: input.name,
        phone: input.phone,
        email: input.email,
        language: input.language,
        status: "eligible",
        consent: input.consent,
        workspace: state.workspaceSettings.workspaceName,
        source: input.source,
      };

      state.contacts.unshift(contact);
      state.dashboardOverview.totalContacts += 1;
      return clone(contact);
    },

    async update(id: string, input: CreateContactRequest) {
      const index = state.contacts.findIndex((contact) => contact.id === id);

      if (index === -1) {
        return null;
      }

      const currentContact = state.contacts[index];

      if (!currentContact) {
        return null;
      }

      const updatedContact: Contact = {
        ...currentContact,
        name: input.name,
        phone: input.phone,
        email: input.email,
        language: input.language,
        consent: input.consent,
        source: input.source,
      };

      state.contacts[index] = updatedContact;
      return clone(updatedContact);
    },

    async remove(id: string) {
      const existingContact = state.contacts.find((contact) => contact.id === id);
      const nextContacts = state.contacts.filter((contact) => contact.id !== id);
      const removed = nextContacts.length !== state.contacts.length;

      if (!removed) {
        return false;
      }

      adjustCampaignAssignmentCount(state, existingContact?.campaignId, -1);
      removeAssignmentsForContact(id);
      state.contacts = nextContacts;
      state.dashboardOverview.totalContacts = Math.max(0, state.dashboardOverview.totalContacts - 1);
      return true;
    },

    async setStatus(id: string, status: Contact["status"]) {
      const index = state.contacts.findIndex((contact) => contact.id === id);

      if (index === -1) {
        return null;
      }

      const currentContact = state.contacts[index];

      if (!currentContact) {
        return null;
      }

      const updatedContact: Contact = {
        ...currentContact,
        status,
      };

      state.contacts[index] = updatedContact;
      return clone(updatedContact);
    },

    async importContacts(input: PreparedContactImport) {
      for (const row of input.rows) {
        if (row.status === "imported" && row.contact) {
          await contacts.create(row.contact);
        }
      }

      const duplicates = input.rows.filter((row) => row.status === "duplicate").length;
      const invalid = input.rows.filter((row) => row.status === "invalid").length;
      const imported = input.rows.filter((row) => row.status === "imported").length;

      return {
        jobId: `import-${randomUUID()}`,
        imported,
        skipped: duplicates + invalid,
        duplicates,
        invalid,
      };
    },
  };

  const callRecords = {
    async list(filters: CallRecordListFilters) {
      const query = normalizeQuery(filters.search);

      return state.callRecords
        .filter((record) => {
          const matchesStatus = !filters.status || filters.status === "all" || record.status === filters.status;
          const matchesCampaign = !filters.campaignId || record.campaignId === filters.campaignId;
          const matchesQuery =
            query.length === 0 ||
            record.contactName.toLowerCase().includes(query) ||
            record.phone.includes(query) ||
            record.campaignName.toLowerCase().includes(query) ||
            record.provider.toLowerCase().includes(query);

          return matchesStatus && matchesCampaign && matchesQuery;
        })
        .sort((left, right) => right.startedAt.localeCompare(left.startedAt))
        .map(clone);
    },

    async getById(id: string) {
      const record = state.callRecords.find((entry) => entry.id === id);
      return record ? clone(record) : null;
    },

    async getTranscript(id: string, options?: { readonly view?: TranscriptView }) {
      const transcript = state.transcriptsByCallId[id];

      if (!transcript) {
        return null;
      }

      const selectedTranscript = options?.view === "raw" ? transcript.raw : transcript.redacted;
      return clone(selectedTranscript);
    },

    async getCollectedData(id: string) {
      const collectedData = state.collectedDataByCallId[id];
      return collectedData ? collectedData.map((field) => toPublicCollectedField(field)) : null;
    },

    async getRecordingUrl(id: string) {
      return state.recordingUrlsByCallId[id] ?? null;
    },
  };

  const voice = {
    async resolveScope(input: ResolveVoiceScopeInput): Promise<VoiceScope> {
      if (input.providerCallId) {
        const existingCallRecordId = state.callRecordIdByProviderCallId[input.providerCallId];

        if (existingCallRecordId) {
          const existingRecord = state.callRecords.find((record) => record.id === existingCallRecordId);

          if (!existingRecord) {
            throw new AppError(409, "voice_session_corrupt", "The stored voice session is missing its call record.");
          }

          if (input.campaignId && existingRecord.campaignId !== input.campaignId) {
            throw new AppError(
              409,
              "voice_scope_mismatch",
              "The voice callback campaign does not match the stored call session.",
            );
          }

          const matchedContact = state.contacts.find((entry) => entry.phone === existingRecord.phone);

          if (input.contactId && matchedContact?.id !== input.contactId) {
            throw new AppError(
              409,
              "voice_scope_mismatch",
              "The voice callback contact does not match the stored call session.",
            );
          }

          return {
            organizationId: getPrimaryWorkspaceId(state),
            campaignId: existingRecord.campaignId,
            contactId: matchedContact?.id ?? input.contactId,
          };
        }
      }

      const campaignId = input.campaignId?.trim();
      const contactId = input.contactId?.trim();

      if (!campaignId && !contactId) {
        throw new AppError(400, "voice_scope_missing", "A campaign, contact, or call UUID is required to resolve the voice scope.");
      }

      if (campaignId && !state.campaigns.some((entry) => entry.id === campaignId)) {
        throw new AppError(404, "campaign_not_found", `Campaign ${campaignId} was not found.`);
      }

      if (contactId && !state.contacts.some((entry) => entry.id === contactId)) {
        throw new AppError(404, "contact_not_found", `Contact ${contactId} was not found.`);
      }

      return {
        organizationId: getPrimaryWorkspaceId(state),
        campaignId,
        contactId,
      };
    },

    async ensureCallSession(input: EnsureVoiceCallSessionInput) {
      const existingCallRecordId = state.callRecordIdByProviderCallId[input.providerCallId];

      if (existingCallRecordId) {
        const existingRecord = state.callRecords.find((record) => record.id === existingCallRecordId);
        const campaign = state.campaigns.find((entry) => entry.id === input.campaignId);
        const contact = state.contacts.find((entry) => entry.id === input.contactId);
        const storedTransferQueueName =
          transferQueueNameByCallRecordId.get(existingCallRecordId) ??
          (campaign?.setup.transferEnabled ? campaign.setup.transferQueue : "");

        if (!existingRecord || !campaign || !contact) {
          throw new AppError(409, "voice_session_corrupt", "The stored voice session is missing campaign, contact, or call record data.");
        }

        return toVoiceCallSession({
          campaign,
          contact,
          callRecord: existingRecord,
          providerCallId: input.providerCallId,
          transferQueueName: storedTransferQueueName,
          transferTarget: resolveInMemoryTransferTarget(storedTransferQueueName),
          collectedData: state.collectedDataByCallId[existingRecord.id] ?? [],
        });
      }

      const campaign = state.campaigns.find((entry) => entry.id === input.campaignId);

      if (!campaign) {
        throw new AppError(404, "campaign_not_found", `Campaign ${input.campaignId} was not found.`);
      }

      const contact = state.contacts.find((entry) => entry.id === input.contactId);

      if (!contact) {
        throw new AppError(404, "contact_not_found", `Contact ${input.contactId} was not found.`);
      }

      const callRecord: CallRecord = {
        id: `call-${randomUUID()}`,
        campaignId: campaign.id,
        campaignName: campaign.name,
        contactName: contact.name,
        phone: contact.phone,
        provider: input.provider,
        status: "in_progress",
        disposition: "in_progress",
        confirmed: false,
        duration: 0,
        startedAt: input.startedAt,
        language: campaign.language,
        fieldsCollected: 0,
        fieldsTotal: campaign.fields.length,
        transcriptMode: input.transcriptMode ?? "restricted",
      };

      state.callRecords.unshift(callRecord);
      state.callRecordIdByProviderCallId[input.providerCallId] = callRecord.id;
      state.transcriptsByCallId[callRecord.id] = {
        raw: [],
        redacted: [],
      };
      state.collectedDataByCallId[callRecord.id] = [];
      rawCollectedValueByCallId[callRecord.id] = {};
      state.dashboardOverview.totalCalls += 1;
      const storedTransferQueueName = campaign.setup.transferEnabled ? campaign.setup.transferQueue : "";

      if (storedTransferQueueName.trim()) {
        transferQueueNameByCallRecordId.set(callRecord.id, storedTransferQueueName);
      }

      return toVoiceCallSession({
        campaign,
        contact,
        callRecord,
        providerCallId: input.providerCallId,
        transferQueueName: storedTransferQueueName,
        transferTarget: resolveInMemoryTransferTarget(storedTransferQueueName),
        collectedData: state.collectedDataByCallId[callRecord.id] ?? [],
      });
    },

    async appendTranscriptTurn(input: AppendVoiceTranscriptTurnInput) {
      const callRecordId = state.callRecordIdByProviderCallId[input.providerCallId];

      if (!callRecordId) {
        throw new AppError(404, "voice_session_not_found", `Voice session ${input.providerCallId} was not found.`);
      }

      const transcript = state.transcriptsByCallId[callRecordId] ?? {
        raw: [],
        redacted: [],
      };
      transcript.raw.push({
        speaker: input.speaker,
        text: input.textRaw,
      });
      transcript.redacted.push({
        speaker: input.speaker,
        text: input.textRedacted,
      });
      state.transcriptsByCallId[callRecordId] = transcript;
    },

    async upsertCollectedField(input: UpsertVoiceCollectedFieldInput) {
      const callRecordId = state.callRecordIdByProviderCallId[input.providerCallId];

      if (!callRecordId) {
        throw new AppError(404, "voice_session_not_found", `Voice session ${input.providerCallId} was not found.`);
      }

      const collectedData = state.collectedDataByCallId[callRecordId] ?? [];
      const existingField = collectedData.find((field) => field.fieldKey === input.fieldKey);
      const rawFieldValues = (rawCollectedValueByCallId[callRecordId] ??= {});
      const rawValue = input.rawValue ?? rawFieldValues[input.fieldKey] ?? existingField?.rawValue;
      const maskedValue = input.maskedValue ?? existingField?.maskedValue ?? rawValue;

      if (!rawValue || !maskedValue) {
        throw new AppError(400, "voice_field_value_missing", `Collected field ${input.fieldKey} is missing a value.`);
      }

      const nextField: VoiceSessionCollectedField = {
        fieldKey: input.fieldKey,
        label: input.label,
        rawValue,
        maskedValue,
        confidenceScore: input.confidenceScore,
        confirmed: input.confirmed,
        sensitive: input.sensitive,
      };
      const existingIndex = collectedData.findIndex((field) => field.fieldKey === input.fieldKey);

      if (existingIndex >= 0) {
        collectedData[existingIndex] = nextField;
      } else {
        collectedData.push(nextField);
      }

      state.collectedDataByCallId[callRecordId] = collectedData;
      rawFieldValues[input.fieldKey] = rawValue;
      return toPublicCollectedField(nextField);
    },

    async clearCollectedData(providerCallId: string) {
      const callRecordId = state.callRecordIdByProviderCallId[providerCallId];

      if (!callRecordId) {
        throw new AppError(404, "voice_session_not_found", `Voice session ${providerCallId} was not found.`);
      }

      state.collectedDataByCallId[callRecordId] = [];
      rawCollectedValueByCallId[callRecordId] = {};
    },

    async updateCallStatus(input: UpdateVoiceCallStatusInput) {
      const callRecordId = state.callRecordIdByProviderCallId[input.providerCallId];

      if (!callRecordId) {
        return null;
      }

      const recordIndex = state.callRecords.findIndex((record) => record.id === callRecordId);

      if (recordIndex === -1) {
        return null;
      }

      const existingRecord = state.callRecords[recordIndex];

      if (!existingRecord) {
        return null;
      }

      const nextRecord: CallRecord = {
        ...existingRecord,
        status: input.status,
        disposition: input.disposition,
        duration: input.durationSeconds ?? existingRecord.duration,
        confirmed: input.confirmed ?? existingRecord.confirmed,
        fieldsCollected: input.fieldsCollected ?? existingRecord.fieldsCollected,
        fieldsTotal: input.fieldsTotal ?? existingRecord.fieldsTotal,
        transcriptMode: input.transcriptMode ?? existingRecord.transcriptMode,
        errorCode: input.errorCode ?? existingRecord.errorCode,
      };

      state.callRecords[recordIndex] = nextRecord;

      if (input.recordingUrl) {
        state.recordingUrlsByCallId[callRecordId] = input.recordingUrl;
      }

      if (input.endedAt) {
        endedAtByCallRecordId.set(callRecordId, input.endedAt);
      }

      syncCampaignPerformance(nextRecord.campaignId);

      return clone(nextRecord);
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
    async getSnapshot() {
      return buildDashboardSnapshot(state, {
        endedAtByCallRecordId,
        pauseModeByCampaignId: campaignPauseModeById,
        transferQueueNameByCallRecordId,
      });
    },
  };

  const journeys = {
    async list() {
      return state.journeys.map(clone);
    },

    async getById(id: string) {
      const journey = state.journeys.find((entry) => entry.id === id);
      return journey ? clone(journey) : null;
    },

    async updateNextCheckpoint(campaignId: string, nextCheckpointAt: string | null) {
      const journeyIndex = state.journeys.findIndex((entry) => entry.campaignId === campaignId);

      if (journeyIndex === -1) {
        return false;
      }

      const journey = state.journeys[journeyIndex];

      if (!journey) {
        return false;
      }

      state.journeys[journeyIndex] = {
        ...journey,
        nextCheckpoint: formatJourneyCheckpointLabel(nextCheckpointAt, journey.status),
      };
      state.journeyCheckpointAtByCampaignId[campaignId] = nextCheckpointAt;

      return true;
    },
  };

  const reports = {
    async getSnapshot() {
      return buildReportsSnapshot(state, {
        endedAtByCallRecordId,
        transferQueueNameByCallRecordId,
      });
    },
  };

  const settings = {
    async getSnapshot() {
      return buildSettingsSnapshot(state);
    },

    async findTeamMembersByEmail(email: string) {
      const normalizedEmail = email.trim().toLowerCase();

      return state.teamMembers
        .filter((member) => member.email.toLowerCase() === normalizedEmail)
        .map((member) => ({
          id: member.id,
          organizationId: state.workspaces[0]?.id ?? "workspace-001",
        }));
    },

    async updateWorkspaceSettings(input: SettingsSnapshot["workspaceSettings"]) {
      state.workspaceSettings = clone(input);
      return buildSettingsSnapshot(state);
    },

    async updateNotificationPreferences(input: Array<{ key: string; enabled: boolean }>) {
      const enabledByKey = new Map(input.map((item) => [item.key, item.enabled] as const));

      state.notificationPreferences = state.notificationPreferences.map((preference) =>
        enabledByKey.has(preference.key)
          ? {
              ...preference,
              enabled: enabledByKey.get(preference.key) ?? preference.enabled,
            }
          : preference,
      );

      for (const item of input) {
        if (!state.notificationPreferences.some((preference) => preference.key === item.key)) {
          state.notificationPreferences.push({
            key: item.key,
            label: item.key,
            detail: "Workspace notification preference.",
            enabled: item.enabled,
          });
        }
      }

      return buildSettingsSnapshot(state);
    },

    async updateWebhookConfig(input: SettingsSnapshot["apiAccess"]["webhook"]) {
      state.apiAccess = {
        ...state.apiAccess,
        webhook: clone(input),
      };

      return buildSettingsSnapshot(state);
    },

    async inviteTeamMember(input: InviteTeamMemberRequest) {
      const normalizedEmail = input.email.trim().toLowerCase();

      if (state.teamMembers.some((member) => member.email.toLowerCase() === normalizedEmail)) {
        throw new AppError(409, "team_member_exists", `A team member with email ${input.email} already exists.`);
      }

      state.teamMembers.push({
        id: `user-${randomUUID()}`,
        name: input.name,
        email: normalizedEmail,
        role: input.role,
      });
      syncPrimaryWorkspaceMemberCount(state);

      return buildSettingsSnapshot(state);
    },

    async updateTeamMemberRole(userId: string, role: InviteTeamMemberRequest["role"]) {
      const memberIndex = state.teamMembers.findIndex((member) => member.id === userId);

      if (memberIndex === -1) {
        throw new AppError(404, "team_member_not_found", `Team member ${userId} was not found.`);
      }

      const currentMember = state.teamMembers[memberIndex];

      if (!currentMember) {
        throw new AppError(404, "team_member_not_found", `Team member ${userId} was not found.`);
      }

      state.teamMembers[memberIndex] = {
        ...currentMember,
        role,
      };

      return buildSettingsSnapshot(state);
    },

    async removeTeamMember(userId: string) {
      const nextTeamMembers = state.teamMembers.filter((member) => member.id !== userId);

      if (nextTeamMembers.length === state.teamMembers.length) {
        throw new AppError(404, "team_member_not_found", `Team member ${userId} was not found.`);
      }

      state.teamMembers = nextTeamMembers;
      syncPrimaryWorkspaceMemberCount(state);
      return buildSettingsSnapshot(state);
    },

    async listApiKeys() {
      return clone(state.apiKeys);
    },

    async createApiKey(input: CreateApiKeyRequest): Promise<CreatedApiKey> {
      const rawKey = generateRawApiKey();
      const prefix = rawKey.slice(0, 12);
      const apiKeySummary: ApiKeySummary = {
        id: `api-key-${randomUUID()}`,
        name: input.name,
        maskedKey: maskApiKey(prefix),
        createdAt: new Date().toISOString(),
      };

      state.apiKeys.unshift(apiKeySummary);
      state.apiAccess = {
        ...state.apiAccess,
        maskedKey: apiKeySummary.maskedKey,
      };

      return {
        ...clone(apiKeySummary),
        rawKey,
      };
    },

    async deleteApiKey(id: string) {
      const nextApiKeys = state.apiKeys.filter((apiKey) => apiKey.id !== id);

      if (nextApiKeys.length === state.apiKeys.length) {
        throw new AppError(404, "api_key_not_found", `API key ${id} was not found.`);
      }

      state.apiKeys = nextApiKeys;
      state.apiAccess = {
        ...state.apiAccess,
        maskedKey: nextApiKeys[0]?.maskedKey ?? "Not configured",
      };
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
