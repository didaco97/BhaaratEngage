import { noopWorkerLogger, type QueueConsumer, type QueueMessage, type WorkerLogger, type WorkerModule } from "../contracts.js";
import { WORKER_QUEUE_NAMES } from "../queue-names.js";
import { computeDialerBatchSize } from "./dialer-helpers.js";
import type { DialerCapacitySnapshot, DialerDispatchJobData, DialerWorkerResult } from "./dialer.types.js";

export type DialerJobHandler = (job: QueueMessage<DialerDispatchJobData>) => Promise<DialerWorkerResult>;

export interface DialerWorkerDependencies {
  readonly consumer: QueueConsumer<DialerDispatchJobData, DialerWorkerResult>;
  readonly logger?: WorkerLogger;
  readonly handler?: DialerJobHandler;
}

export interface DialerPlaceholderContext extends Partial<DialerCapacitySnapshot> {
  readonly maxContacts?: number;
}

export function createDialerPlaceholderResult(
  job: Pick<QueueMessage<DialerDispatchJobData>, "payload">,
  context: DialerPlaceholderContext = {},
): DialerWorkerResult {
  const reservedContacts = Math.min(
    computeDialerBatchSize({
      activeCalls: context.activeCalls ?? 0,
      concurrencyLimit: context.concurrencyLimit ?? 0,
      pacingPerMinute: context.pacingPerMinute ?? 0,
      maxBatchSize: context.maxContacts ?? job.payload.maxContacts ?? 25,
    }),
    Math.max(job.payload.maxContacts ?? Number.MAX_SAFE_INTEGER, 0),
  );

  return {
    outcome: reservedContacts > 0 ? "scheduled_contacts" : "idle",
    reservedContacts,
    nextCursor: job.payload.cursor,
    notes: [
      "Scaffold only: plug campaign selection, eligibility filters, and provider dispatch into this handler.",
    ],
  };
}

class DialerWorkerScaffold implements WorkerModule {
  public readonly name = WORKER_QUEUE_NAMES.dialer;
  private started = false;

  public constructor(
    private readonly consumer: QueueConsumer<DialerDispatchJobData, DialerWorkerResult>,
    private readonly logger: WorkerLogger,
    private readonly handler: DialerJobHandler,
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
          organizationId: job.payload.organizationId,
          outcome: result.outcome,
          reservedContacts: result.reservedContacts,
        },
        "Dialer worker scaffold processed a job.",
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

export function createDialerWorker(dependencies: DialerWorkerDependencies): WorkerModule {
  return new DialerWorkerScaffold(
    dependencies.consumer,
    dependencies.logger ?? noopWorkerLogger,
    dependencies.handler ?? ((job) => Promise.resolve(createDialerPlaceholderResult(job))),
  );
}
