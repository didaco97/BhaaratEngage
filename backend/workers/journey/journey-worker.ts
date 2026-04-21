import { noopWorkerLogger, type QueueConsumer, type QueueMessage, type WorkerLogger, type WorkerModule } from "../contracts.js";
import { WORKER_QUEUE_NAMES } from "../queue-names.js";
import { computeJourneyNextAttemptAt, normalizeJourneyAction } from "./journey-helpers.js";
import type { JourneyDispatchJobData, JourneyWorkerResult } from "./journey.types.js";

export type JourneyJobHandler = (job: QueueMessage<JourneyDispatchJobData>) => Promise<JourneyWorkerResult>;

export interface JourneyWorkerDependencies {
  readonly consumer: QueueConsumer<JourneyDispatchJobData, JourneyWorkerResult>;
  readonly logger?: WorkerLogger;
  readonly handler?: JourneyJobHandler;
}

export function createJourneyPlaceholderResult(job: Pick<QueueMessage<JourneyDispatchJobData>, "payload">): JourneyWorkerResult {
  const action = normalizeJourneyAction(job.payload.action);

  if (action === "retry") {
    return {
      outcome: "scheduled_retry",
      nextAttemptAt: computeJourneyNextAttemptAt({
        requestedAt: job.payload.requestedAt,
        retryWindowHours: job.payload.retryWindowHours,
      }),
      notes: ["Scheduled a retry checkpoint placeholder result."],
    };
  }

  if (action === "sms" || action === "whatsapp") {
    return {
      outcome: "queued_followup",
      nextAttemptAt: job.payload.requestedAt,
      notes: [`Queued a ${action.toUpperCase()} follow-up placeholder result.`],
    };
  }

  return {
    outcome: "skipped",
    notes: ["No follow-up action was requested for this journey job."],
  };
}

class JourneyWorker implements WorkerModule {
  public readonly name = WORKER_QUEUE_NAMES.journey;
  private started = false;

  public constructor(
    private readonly consumer: QueueConsumer<JourneyDispatchJobData, JourneyWorkerResult>,
    private readonly logger: WorkerLogger,
    private readonly handler: JourneyJobHandler,
  ) {}

  public async start() {
    if (this.started) {
      return;
    }

    await this.consumer.start(async (job) => {
      const result = await this.handler(job);

      this.logger.info(
        {
          queue: this.consumer.queueName,
          campaignId: job.payload.campaignId,
          contactId: job.payload.contactId,
          action: job.payload.action,
          outcome: result.outcome,
        },
        "Journey worker processed a job.",
      );

      return result;
    });

    this.started = true;
  }

  public async stop() {
    if (!this.started) {
      return;
    }

    await this.consumer.stop();
    this.started = false;
  }
}

export function createJourneyWorker(dependencies: JourneyWorkerDependencies): WorkerModule {
  return new JourneyWorker(
    dependencies.consumer,
    dependencies.logger ?? noopWorkerLogger,
    dependencies.handler ?? ((job) => Promise.resolve(createJourneyPlaceholderResult(job))),
  );
}
