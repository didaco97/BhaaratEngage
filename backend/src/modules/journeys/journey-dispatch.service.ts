import type { BackendRepositories } from "../../repositories/backend-repositories.js";
import type { JourneyFollowUpGateway } from "./journey-followup-gateway.js";
import type { JourneyAction, JourneyDispatchJobData, JourneyWorkerResult } from "./journey-dispatch.types.js";

export interface JourneyDispatchLogger {
  info(metadata: Record<string, unknown>, message: string): void;
  warn(metadata: Record<string, unknown>, message: string): void;
  error(metadata: Record<string, unknown>, message: string): void;
}

export const noopJourneyDispatchLogger: JourneyDispatchLogger = {
  info() {},
  warn() {},
  error() {},
};

export interface JourneyFollowUpServiceDependencies {
  readonly repositories: Pick<BackendRepositories, "campaigns" | "contacts" | "journeys" | "audit">;
  readonly followUpGateway: JourneyFollowUpGateway;
  readonly logger?: JourneyDispatchLogger;
  readonly now?: () => Date;
}

const HOUR_IN_MILLISECONDS = 60 * 60 * 1_000;

function normalizeJourneyAction(action: string): JourneyAction {
  const normalized = action.trim().toLowerCase();

  switch (normalized) {
    case "sms":
    case "whatsapp":
    case "retry":
      return normalized;
    default:
      return "none";
  }
}

function computeJourneyNextAttemptAt(input: {
  readonly requestedAt: string;
  readonly retryWindowHours?: number;
}) {
  const requestedAt = new Date(input.requestedAt);

  if (Number.isNaN(requestedAt.valueOf())) {
    throw new RangeError(`Invalid requestedAt timestamp: ${input.requestedAt}`);
  }

  const retryWindowHours = Number.isFinite(input.retryWindowHours) ? Math.max(input.retryWindowHours ?? 0, 0) : 0;
  return new Date(requestedAt.getTime() + retryWindowHours * HOUR_IN_MILLISECONDS).toISOString();
}

function resolveJobTimestamp(requestedAt: string, nowFactory?: () => Date) {
  const requestedAtDate = new Date(requestedAt);

  if (!Number.isNaN(requestedAtDate.valueOf())) {
    return requestedAtDate;
  }

  return nowFactory?.() ?? new Date();
}

function canContactReceiveFollowUp(input: {
  readonly status: string;
  readonly consent: boolean;
}) {
  return input.status === "eligible" && input.consent;
}

export class JourneyFollowUpService {
  private readonly logger: JourneyDispatchLogger;

  public constructor(private readonly dependencies: JourneyFollowUpServiceDependencies) {
    this.logger = dependencies.logger ?? noopJourneyDispatchLogger;
  }

  public async handle(job: JourneyDispatchJobData): Promise<JourneyWorkerResult> {
    const action = normalizeJourneyAction(job.action);
    const requestedAt = resolveJobTimestamp(job.requestedAt, this.dependencies.now);
    const requestedAtIso = requestedAt.toISOString();

    if (action === "none") {
      return {
        outcome: "skipped",
        notes: [`No journey follow-up was requested for contact ${job.contactId}.`],
      };
    }

    const [campaign, contact] = await Promise.all([
      this.dependencies.repositories.campaigns.getById(job.campaignId),
      this.dependencies.repositories.contacts.getById(job.contactId),
    ]);

    if (!campaign) {
      return {
        outcome: "skipped",
        notes: [`Campaign ${job.campaignId} could not be found for journey follow-up.`],
      };
    }

    if (!contact) {
      return {
        outcome: "skipped",
        notes: [`Contact ${job.contactId} could not be found for journey follow-up.`],
      };
    }

    if (!canContactReceiveFollowUp(contact)) {
      return {
        outcome: "skipped",
        notes: [
          `Skipped ${action.toUpperCase()} follow-up for ${contact.name} because the contact is ${contact.status} or missing consent.`,
        ],
      };
    }

    if (action === "retry") {
      if (campaign.status === "completed") {
        return {
          outcome: "skipped",
          notes: [`Skipped retry for ${campaign.name} because the campaign is already completed.`],
        };
      }

      const nextAttemptAt = computeJourneyNextAttemptAt({
        requestedAt: requestedAtIso,
        retryWindowHours: job.retryWindowHours,
      });
      const checkpointUpdated = await this.dependencies.repositories.journeys.updateNextCheckpoint(campaign.id, nextAttemptAt);
      await this.dependencies.repositories.campaigns.updateDialerContactDispatch({
        campaignId: campaign.id,
        contactId: contact.id,
        dispatchStatus: "pending",
      });
      await this.dependencies.repositories.audit.record({
        action: "Scheduled journey retry",
        entityType: "call_record",
        entityId: job.callRecordId ?? `${campaign.id}:${contact.id}`,
        metadata: {
          displayName: `${contact.name} • ${campaign.name}`,
          outcome: job.outcome,
          retryAt: nextAttemptAt,
        },
      });

      return {
        outcome: "scheduled_retry",
        nextAttemptAt,
        notes: [
          `Scheduled a retry for ${contact.name} at ${nextAttemptAt}.`,
          checkpointUpdated
            ? `Updated the next checkpoint for ${campaign.name}.`
            : `Retry was scheduled, but ${campaign.name} has no journey monitor row to update yet.`,
        ],
      };
    }

    const delivery = await this.dependencies.followUpGateway.deliver({
      organizationId: job.organizationId,
      campaign,
      contact,
      action,
      outcome: job.outcome,
      callRecordId: job.callRecordId,
      requestedAt: requestedAtIso,
      traceId: job.traceId,
    });
    await this.dependencies.repositories.audit.record({
      action: `Queued journey ${action.toUpperCase()} follow-up`,
      entityType: "call_record",
      entityId: job.callRecordId ?? `${campaign.id}:${contact.id}`,
      metadata: {
        displayName: `${contact.name} • ${campaign.name}`,
        channel: action,
        outcome: job.outcome,
        acceptedAt: delivery.acceptedAt,
      },
    });

    this.logger.info(
      {
        campaignId: campaign.id,
        contactId: contact.id,
        channel: action,
        outcome: job.outcome,
      },
      "Queued a journey follow-up delivery.",
    );

    return {
      outcome: "queued_followup",
      nextAttemptAt: delivery.acceptedAt,
      notes: [`Queued a ${action.toUpperCase()} follow-up for ${contact.name}.`],
    };
  }
}
