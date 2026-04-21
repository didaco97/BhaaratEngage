import { noopWorkerLogger, type QueuePublisher, type WorkerLogger } from "../contracts.js";
import { WORKER_QUEUE_NAMES } from "../queue-names.js";
import type { DialerDispatchJobData } from "../dialer/dialer.types.js";
import type { JourneyAction, JourneyDispatchJobData, JourneyOutcome } from "../journey/journey.types.js";
import type { CampaignService } from "../../src/modules/campaigns/campaign.service.js";
import type { SchedulerCampaignWindowTransition } from "./scheduler-candidates.js";

export interface SchedulerDialerCandidate {
  readonly organizationId: string;
  readonly campaignId: string;
  readonly cursor?: string;
  readonly maxContacts?: number;
  readonly traceId?: string;
}

export interface SchedulerJourneyCandidate {
  readonly organizationId: string;
  readonly campaignId: string;
  readonly contactId: string;
  readonly action: JourneyAction;
  readonly outcome: JourneyOutcome;
  readonly callRecordId?: string;
  readonly retryWindowHours?: number;
  readonly traceId?: string;
}

export interface SchedulerTickInput {
  readonly triggeredAt?: string;
  readonly dialerCampaigns?: readonly SchedulerDialerCandidate[];
  readonly journeyActions?: readonly SchedulerJourneyCandidate[];
  readonly campaignTransitions?: readonly SchedulerCampaignWindowTransition[];
}

export interface SchedulerTickResult {
  readonly dispatchedDialerJobs: number;
  readonly dispatchedJourneyJobs: number;
  readonly autoPausedCampaigns: number;
  readonly autoResumedCampaigns: number;
}

export interface CampaignSchedulerDependencies {
  readonly dialerQueue: QueuePublisher<DialerDispatchJobData>;
  readonly journeyQueue: QueuePublisher<JourneyDispatchJobData>;
  readonly campaignService: Pick<CampaignService, "autoPauseForQuietHours" | "autoResumeFromQuietHours">;
  readonly logger?: WorkerLogger;
}

export class CampaignSchedulerScaffold {
  private readonly logger: WorkerLogger;

  public constructor(private readonly dependencies: CampaignSchedulerDependencies) {
    this.logger = dependencies.logger ?? noopWorkerLogger;
  }

  public buildDialerJob(candidate: SchedulerDialerCandidate, triggeredAt: string): DialerDispatchJobData {
    return {
      organizationId: candidate.organizationId,
      campaignId: candidate.campaignId,
      requestedAt: triggeredAt,
      triggeredBy: "scheduler",
      cursor: candidate.cursor,
      maxContacts: candidate.maxContacts,
      traceId: candidate.traceId,
    };
  }

  public buildJourneyJob(candidate: SchedulerJourneyCandidate, triggeredAt: string): JourneyDispatchJobData {
    return {
      organizationId: candidate.organizationId,
      campaignId: candidate.campaignId,
      contactId: candidate.contactId,
      action: candidate.action,
      outcome: candidate.outcome,
      requestedAt: triggeredAt,
      callRecordId: candidate.callRecordId,
      retryWindowHours: candidate.retryWindowHours,
      traceId: candidate.traceId,
    };
  }

  private async applyCampaignTransition(transition: SchedulerCampaignWindowTransition) {
    if (transition.action === "auto_pause") {
      return this.dependencies.campaignService.autoPauseForQuietHours(transition.campaignId);
    }

    return this.dependencies.campaignService.autoResumeFromQuietHours(transition.campaignId);
  }

  public async runTick(input: SchedulerTickInput = {}): Promise<SchedulerTickResult> {
    const triggeredAt = input.triggeredAt ?? new Date().toISOString();
    const dialerCampaigns = input.dialerCampaigns ?? [];
    const journeyActions = input.journeyActions ?? [];
    const campaignTransitions = input.campaignTransitions ?? [];
    const resumeBlockedCampaignIds = new Set<string>();
    let dispatchedDialerJobs = 0;
    let autoPausedCampaigns = 0;
    let autoResumedCampaigns = 0;

    for (const transition of campaignTransitions) {
      const updatedCampaign = await this.applyCampaignTransition(transition);

      if (!updatedCampaign && transition.action === "auto_resume") {
        resumeBlockedCampaignIds.add(transition.campaignId);
        continue;
      }

      if (updatedCampaign && transition.action === "auto_pause") {
        autoPausedCampaigns += 1;
      }

      if (updatedCampaign && transition.action === "auto_resume") {
        autoResumedCampaigns += 1;
      }
    }

    for (const candidate of dialerCampaigns) {
      if (resumeBlockedCampaignIds.has(candidate.campaignId)) {
        continue;
      }

      await this.dependencies.dialerQueue.publish({
        name: WORKER_QUEUE_NAMES.dialer,
        payload: this.buildDialerJob(candidate, triggeredAt),
        dedupeKey: `${candidate.organizationId}:${candidate.campaignId}:${triggeredAt}`,
      });
      dispatchedDialerJobs += 1;
    }

    for (const candidate of journeyActions) {
      await this.dependencies.journeyQueue.publish({
        name: WORKER_QUEUE_NAMES.journey,
        payload: this.buildJourneyJob(candidate, triggeredAt),
        dedupeKey: `${candidate.organizationId}:${candidate.contactId}:${candidate.action}:${triggeredAt}`,
      });
    }

    this.logger.info(
      {
        dialerJobs: dispatchedDialerJobs,
        journeyJobs: journeyActions.length,
        autoPausedCampaigns,
        autoResumedCampaigns,
        triggeredAt,
      },
      "Worker scheduler scaffold dispatched queue messages.",
    );

    return {
      dispatchedDialerJobs,
      dispatchedJourneyJobs: journeyActions.length,
      autoPausedCampaigns,
      autoResumedCampaigns,
    };
  }
}

export function createCampaignScheduler(dependencies: CampaignSchedulerDependencies) {
  return new CampaignSchedulerScaffold(dependencies);
}
