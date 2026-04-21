import type { VoiceDispatchSource } from "../../src/modules/voice/voice.schemas.js";
import type { BackendRepositories } from "../../src/repositories/backend-repositories.js";
import { noopWorkerLogger, type QueueMessage, type WorkerLogger } from "../contracts.js";
import { computeDialerBatchSize, evaluateDialerEligibility, isWithinDialerCallingWindow } from "./dialer-helpers.js";
import type { DialerDispatchJobData, DialerWorkerResult, DialerEligibilityResult } from "./dialer.types.js";

interface OutboundVoiceCaller {
  startOutboundCall(input: {
    campaignId: string;
    contactId: string;
    source: Exclude<VoiceDispatchSource, "test">;
  }): Promise<{
    requestUuid: string;
  }>;
}

export interface DialerDispatchServiceDependencies {
  readonly repositories: Pick<BackendRepositories, "campaigns" | "settings">;
  readonly voiceCaller: OutboundVoiceCaller;
  readonly logger?: WorkerLogger;
  readonly now?: () => Date;
}

const eligibilityReasonLabels: Record<NonNullable<DialerEligibilityResult["reason"]>, string> = {
  dispatch_in_progress: "already in progress",
  dispatch_state: "not pending dispatch",
  contact_status: "blocked by contact status or suppression",
  contact_consent: "missing consent",
  retry_window: "still inside retry window",
  outside_calling_window: "outside the campaign calling window",
};

function incrementReasonCount(map: Map<NonNullable<DialerEligibilityResult["reason"]>, number>, reason: DialerEligibilityResult["reason"]) {
  if (!reason) {
    return;
  }

  map.set(reason, (map.get(reason) ?? 0) + 1);
}

function resolveJobTimestamp(requestedAt: string, nowFactory?: () => Date) {
  const requestedAtDate = new Date(requestedAt);

  if (!Number.isNaN(requestedAtDate.valueOf())) {
    return requestedAtDate;
  }

  return nowFactory?.() ?? new Date();
}

export class DialerDispatchService {
  private readonly logger: WorkerLogger;

  public constructor(private readonly dependencies: DialerDispatchServiceDependencies) {
    this.logger = dependencies.logger ?? noopWorkerLogger;
  }

  public async handleJob(job: QueueMessage<DialerDispatchJobData>): Promise<DialerWorkerResult> {
    const requestedAt = resolveJobTimestamp(job.payload.requestedAt, this.dependencies.now);
    const requestedAtIso = requestedAt.toISOString();
    const [campaign, settings] = await Promise.all([
      this.dependencies.repositories.campaigns.getById(job.payload.campaignId),
      this.dependencies.repositories.settings.getSnapshot(),
    ]);

    if (!campaign) {
      return {
        outcome: "idle",
        reservedContacts: 0,
        notes: [`Campaign ${job.payload.campaignId} could not be found for dialer dispatch.`],
      };
    }

    if (campaign.status !== "active") {
      return {
        outcome: "idle",
        reservedContacts: 0,
        notes: [`Campaign ${campaign.name} is ${campaign.status} and cannot dispatch calls.`],
      };
    }

    const withinCallingWindow = isWithinDialerCallingWindow(
      requestedAt,
      campaign.setup.callingWindowStart,
      campaign.setup.callingWindowEnd,
    );

    if (!withinCallingWindow) {
      return {
        outcome: "idle",
        reservedContacts: 0,
        notes: [
          `Campaign ${campaign.name} is outside its calling window (${campaign.setup.callingWindowStart}-${campaign.setup.callingWindowEnd} IST).`,
        ],
      };
    }

    const [dialerContacts, activeDispatches] = await Promise.all([
      this.dependencies.repositories.campaigns.listDialerContacts(campaign.id),
      this.dependencies.repositories.campaigns.countDialerContacts(campaign.id, ["in_progress"]),
    ]);

    const maxBatchSize = Math.min(job.payload.maxContacts ?? dialerContacts.length, dialerContacts.length);
    const reservedCapacity = computeDialerBatchSize({
      activeCalls: activeDispatches,
      concurrencyLimit: campaign.journey.concurrencyLimit,
      pacingPerMinute: campaign.journey.pacingPerMinute,
      maxBatchSize,
    });

    if (reservedCapacity === 0) {
      return {
        outcome: "idle",
        reservedContacts: 0,
        eligibleContacts: 0,
        skippedContacts: dialerContacts.length,
        notes: [
          `Dialer capacity is exhausted for ${campaign.name} (${activeDispatches}/${campaign.journey.concurrencyLimit} in progress).`,
        ],
      };
    }

    const eligibilityReasonCounts = new Map<NonNullable<DialerEligibilityResult["reason"]>, number>();
    const eligibleContacts = dialerContacts.filter((candidate) => {
      const result = evaluateDialerEligibility({
        candidate: {
          dispatchStatus: candidate.dispatchStatus,
          contactStatus: candidate.contact.status,
          consent: candidate.contact.consent,
          lastContactedAt: candidate.contact.lastContactedAt,
        },
        dndChecksEnabled: settings.workspaceSettings.dndChecksEnabled,
        retryWindowHours: campaign.journey.retryWindowHours,
        now: requestedAt,
        withinCallingWindow,
      });

      if (!result.eligible) {
        incrementReasonCount(eligibilityReasonCounts, result.reason);
      }

      return result.eligible;
    });
    const selectedContacts = eligibleContacts.slice(0, reservedCapacity);

    if (selectedContacts.length === 0) {
      const notes = [...eligibilityReasonCounts.entries()].map(
        ([reason, count]) => `Skipped ${count} contacts because they were ${eligibilityReasonLabels[reason]}.`,
      );

      return {
        outcome: "idle",
        reservedContacts: 0,
        eligibleContacts: 0,
        skippedContacts: dialerContacts.length,
        notes: notes.length > 0 ? notes : [`No eligible contacts were available for ${campaign.name}.`],
      };
    }

    let dispatchedContacts = 0;
    let revertedContacts = 0;

    for (const candidate of selectedContacts) {
      const marked = await this.dependencies.repositories.campaigns.updateDialerContactDispatch({
        campaignId: campaign.id,
        contactId: candidate.contact.id,
        dispatchStatus: "in_progress",
        lastContactedAt: requestedAtIso,
      });

      if (!marked) {
        revertedContacts += 1;
        continue;
      }

      try {
        await this.dependencies.voiceCaller.startOutboundCall({
          campaignId: campaign.id,
          contactId: candidate.contact.id,
          source: job.payload.triggeredBy,
        });
        dispatchedContacts += 1;
      } catch (error) {
        revertedContacts += 1;
        await this.dependencies.repositories.campaigns.updateDialerContactDispatch({
          campaignId: campaign.id,
          contactId: candidate.contact.id,
          dispatchStatus: "pending",
          lastContactedAt: null,
        });
        this.logger.error(
          {
            err: error,
            campaignId: campaign.id,
            contactId: candidate.contact.id,
            organizationId: job.payload.organizationId,
          },
          "Failed to dispatch an outbound call and reverted the contact to pending.",
        );
      }
    }

    const notes = [
      `Selected ${selectedContacts.length} contacts from ${eligibleContacts.length} eligible assignments for ${campaign.name}.`,
      ...[...eligibilityReasonCounts.entries()].map(
        ([reason, count]) => `Skipped ${count} contacts because they were ${eligibilityReasonLabels[reason]}.`,
      ),
    ];

    if (revertedContacts > 0) {
      notes.push(`Reverted ${revertedContacts} contacts to pending after a dispatch failure.`);
    }

    return {
      outcome: dispatchedContacts > 0 ? "scheduled_contacts" : "idle",
      reservedContacts: dispatchedContacts,
      dispatchedContacts,
      eligibleContacts: eligibleContacts.length,
      skippedContacts: Math.max(dialerContacts.length - dispatchedContacts, 0),
      notes,
    };
  }
}

export function createDialerJobHandler(dependencies: DialerDispatchServiceDependencies) {
  const service = new DialerDispatchService(dependencies);

  return (job: QueueMessage<DialerDispatchJobData>) => service.handleJob(job);
}
