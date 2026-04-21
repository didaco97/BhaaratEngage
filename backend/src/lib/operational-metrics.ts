import type { CallStatus, CampaignStatus } from "../domain/enums.js";
import type { ComplianceAlert, TransferQueueSummary } from "../modules/dashboard/dashboard.schemas.js";
import type { ProviderPerformance } from "../modules/reports/report.schemas.js";

interface OperationalCallRecord {
  readonly provider: string;
  readonly status: CallStatus;
  readonly disposition: string;
  readonly startedAt: string;
  readonly endedAt?: string | null;
  readonly errorCode?: string | null;
  readonly transferQueueId?: string | null;
  readonly transferQueueName?: string | null;
}

interface OperationalCampaign {
  readonly id: string;
  readonly name: string;
  readonly status: CampaignStatus;
  readonly pauseMode?: "manual" | "quiet_hours" | null;
  readonly createdAt?: string;
  readonly launchedAt?: string | null;
}

interface OperationalQueue {
  readonly id?: string | null;
  readonly name: string;
  readonly activeAgents?: number;
  readonly waitingCount?: number;
  readonly currentSlaSeconds?: number;
}

interface OperationalSettings {
  readonly quietHoursAutoPause: boolean;
}

interface BuildProviderPerformanceInput {
  readonly callRecords: readonly OperationalCallRecord[];
  readonly referenceTime: string;
}

interface BuildTransferQueueSummariesInput {
  readonly queues: readonly OperationalQueue[];
  readonly callRecords: readonly OperationalCallRecord[];
  readonly referenceTime: string;
  readonly maxQueues?: number;
  readonly liveWindowMinutes?: number;
}

interface BuildComplianceAlertsInput {
  readonly campaigns: readonly OperationalCampaign[];
  readonly callRecords: readonly OperationalCallRecord[];
  readonly settings: OperationalSettings;
  readonly referenceTime: string;
  readonly maxAlerts?: number;
}

const shortDateFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  timeZone: "Asia/Calcutta",
});

function parseTimestamp(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const timestamp = new Date(value);
  return Number.isNaN(timestamp.valueOf()) ? null : timestamp;
}

function formatShortDateLabel(value: string) {
  return shortDateFormatter.format(new Date(value)).replace(",", "");
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

function normalizeProvider(value: string) {
  return value.trim().toLowerCase();
}

function normalizeQueueKey(input: { readonly id?: string | null; readonly name?: string | null }) {
  const normalizedId = input.id?.trim();

  if (normalizedId) {
    return `id:${normalizedId}`;
  }

  const normalizedName = input.name?.trim().toLowerCase();
  return normalizedName ? `name:${normalizedName}` : null;
}

function isProviderSuccess(status: CallStatus) {
  return status === "completed" || status === "transferred";
}

function isTransferredToQueue(record: OperationalCallRecord) {
  return record.status === "transferred" || record.disposition === "human_transfer";
}

function estimateQueueSlaSeconds(waitingCount: number, activeAgents: number) {
  if (waitingCount <= 0) {
    return 0;
  }

  const effectiveAgents = Math.max(1, activeAgents);
  return Math.max(45, Math.round((waitingCount / effectiveAgents) * 90));
}

function formatSla(seconds: number) {
  const safeSeconds = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;
  return `${minutes}m ${remainingSeconds.toString().padStart(2, "0")}s`;
}

function pushAlert(target: ComplianceAlert[], nextAlert: ComplianceAlert) {
  const duplicate = target.some(
    (alert) =>
      alert.title === nextAlert.title &&
      alert.detail === nextAlert.detail &&
      alert.severity === nextAlert.severity,
  );

  if (!duplicate) {
    target.push(nextAlert);
  }
}

export function resolveOperationalReferenceTime(
  values: ReadonlyArray<string | null | undefined>,
  fallback = new Date().toISOString(),
) {
  let latestTimestamp: Date | null = null;

  for (const value of values) {
    const parsed = parseTimestamp(value);

    if (parsed && (!latestTimestamp || parsed > latestTimestamp)) {
      latestTimestamp = parsed;
    }
  }

  return (latestTimestamp ?? parseTimestamp(fallback) ?? new Date()).toISOString();
}

export function buildProviderPerformanceSnapshot(input: BuildProviderPerformanceInput): ProviderPerformance[] {
  const providerStatsByDay = new Map<
    string,
    {
      date: string;
      plivo: { success: number; total: number };
      exotel: { success: number; total: number };
    }
  >();

  for (const record of input.callRecords) {
    const startedAt = parseTimestamp(record.startedAt);

    if (!startedAt) {
      continue;
    }

    const provider = normalizeProvider(record.provider);

    if (provider !== "plivo" && provider !== "exotel") {
      continue;
    }

    const dayKey = startedAt.toISOString().slice(0, 10);
    const existingEntry = providerStatsByDay.get(dayKey) ?? {
      date: formatShortDateLabel(startedAt.toISOString()),
      plivo: { success: 0, total: 0 },
      exotel: { success: 0, total: 0 },
    };
    const providerStats = provider === "plivo" ? existingEntry.plivo : existingEntry.exotel;
    providerStats.total += 1;

    if (isProviderSuccess(record.status)) {
      providerStats.success += 1;
    }

    providerStatsByDay.set(dayKey, existingEntry);
  }

  if (providerStatsByDay.size === 0) {
    return [
      {
        date: formatShortDateLabel(input.referenceTime),
        plivo: 0,
        exotel: 0,
      },
    ];
  }

  return [...providerStatsByDay.entries()]
    .sort(([leftDay], [rightDay]) => leftDay.localeCompare(rightDay))
    .map(([, row]) => ({
      date: row.date,
      plivo: percentageOf(row.plivo.success, row.plivo.total),
      exotel: percentageOf(row.exotel.success, row.exotel.total),
    }));
}

export function buildTransferQueueSummaries(input: BuildTransferQueueSummariesInput): TransferQueueSummary[] {
  const referenceTimestamp = parseTimestamp(input.referenceTime) ?? new Date();
  const liveWindowMinutes = input.liveWindowMinutes ?? 45;
  const liveWindowStart = new Date(referenceTimestamp.getTime() - liveWindowMinutes * 60 * 1000);
  const queueStateByKey = new Map<
    string,
    {
      name: string;
      activeAgents: number;
      baselineWaitingCount: number;
      baselineSlaSeconds: number;
      liveWaitingCount: number;
    }
  >();

  for (const queue of input.queues) {
    const key = normalizeQueueKey(queue);

    if (!key) {
      continue;
    }

    queueStateByKey.set(key, {
      name: queue.name,
      activeAgents: Math.max(1, queue.activeAgents ?? 1),
      baselineWaitingCount: Math.max(0, queue.waitingCount ?? 0),
      baselineSlaSeconds: Math.max(0, queue.currentSlaSeconds ?? 0),
      liveWaitingCount: 0,
    });
  }

  for (const record of input.callRecords) {
    if (!isTransferredToQueue(record)) {
      continue;
    }

    const effectiveTimestamp = parseTimestamp(record.endedAt ?? record.startedAt);

    if (!effectiveTimestamp || effectiveTimestamp < liveWindowStart || effectiveTimestamp > referenceTimestamp) {
      continue;
    }

    const key = normalizeQueueKey({
      id: record.transferQueueId,
      name: record.transferQueueName,
    });

    if (!key) {
      continue;
    }

    const existingQueue =
      queueStateByKey.get(key) ??
      {
        name: record.transferQueueName?.trim() || "Human transfer queue",
        activeAgents: 1,
        baselineWaitingCount: 0,
        baselineSlaSeconds: 0,
        liveWaitingCount: 0,
      };
    existingQueue.liveWaitingCount += 1;
    queueStateByKey.set(key, existingQueue);
  }

  return [...queueStateByKey.values()]
    .map((queue) => {
      const waiting = queue.liveWaitingCount > 0 ? queue.liveWaitingCount : queue.baselineWaitingCount;
      const liveSlaSeconds = estimateQueueSlaSeconds(queue.liveWaitingCount, queue.activeAgents);
      const fallbackSlaSeconds =
        queue.baselineSlaSeconds > 0 ? queue.baselineSlaSeconds : estimateQueueSlaSeconds(waiting, queue.activeAgents);
      const slaSeconds = waiting === 0 ? 0 : queue.liveWaitingCount > 0 ? Math.max(liveSlaSeconds, fallbackSlaSeconds) : fallbackSlaSeconds;

      return {
        queue: queue.name,
        waiting,
        sla: formatSla(slaSeconds),
      } satisfies TransferQueueSummary;
    })
    .sort((left, right) => right.waiting - left.waiting || left.queue.localeCompare(right.queue))
    .slice(0, input.maxQueues ?? 5);
}

export function buildComplianceAlerts(input: BuildComplianceAlertsInput): ComplianceAlert[] {
  const alerts: ComplianceAlert[] = [];
  const referenceTimestamp = parseTimestamp(input.referenceTime) ?? new Date();
  const providerWindowStart = new Date(referenceTimestamp.getTime() - 24 * 60 * 60 * 1000);
  const providerStats = new Map<string, { total: number; failures: number }>();

  for (const record of input.callRecords) {
    const startedAt = parseTimestamp(record.startedAt);

    if (!startedAt || startedAt < providerWindowStart || startedAt > referenceTimestamp) {
      continue;
    }

    const provider = normalizeProvider(record.provider);
    const existingStats = providerStats.get(provider) ?? { total: 0, failures: 0 };
    existingStats.total += 1;

    if (record.status === "failed" || Boolean(record.errorCode)) {
      existingStats.failures += 1;
    }

    providerStats.set(provider, existingStats);
  }

  for (const [provider, stats] of [...providerStats.entries()].sort(
    ([, left], [, right]) =>
      percentageOf(right.failures, right.total) - percentageOf(left.failures, left.total) || right.failures - left.failures,
  )) {
    if (stats.failures === 0 || stats.total === 0) {
      continue;
    }

    const failureRate = percentageOf(stats.failures, stats.total);
    pushAlert(alerts, {
      title: `${provider.charAt(0).toUpperCase() + provider.slice(1)} reliability degraded`,
      detail: `${stats.failures} provider failure${stats.failures === 1 ? "" : "s"} across ${stats.total} recent attempt${stats.total === 1 ? "" : "s"} (${failureRate}% failure rate).`,
      severity: stats.failures >= 3 || failureRate >= 20 ? "risk" : "warning",
    });
  }

  const quietHourPausedCampaigns = input.campaigns.filter(
    (campaign) => campaign.status === "paused" && campaign.pauseMode === "quiet_hours",
  );

  if (quietHourPausedCampaigns.length > 0) {
    const label =
      quietHourPausedCampaigns.length === 1
        ? quietHourPausedCampaigns[0]?.name ?? "A campaign"
        : `${quietHourPausedCampaigns.length} campaigns`;

    pushAlert(alerts, {
      title: "Quiet hours active",
      detail: `${label} ${quietHourPausedCampaigns.length === 1 ? "is" : "are"} paused automatically until the next calling window opens.`,
      severity: "warning",
    });
  } else if (input.settings.quietHoursAutoPause && input.campaigns.some((campaign) => campaign.status === "active")) {
    pushAlert(alerts, {
      title: "Quiet hours automation armed",
      detail: "Active campaigns will pause automatically when the configured calling window closes.",
      severity: "info",
    });
  }

  const completedCampaign = input.campaigns
    .filter((campaign) => campaign.status === "completed")
    .sort((left, right) =>
      (right.launchedAt ?? right.createdAt ?? "").localeCompare(left.launchedAt ?? left.createdAt ?? ""),
    )[0];

  if (completedCampaign) {
    pushAlert(alerts, {
      title: "Masked export ready",
      detail: `${completedCampaign.name} is complete and ready for masked export review.`,
      severity: "info",
    });
  }

  return alerts.slice(0, input.maxAlerts ?? 5);
}
