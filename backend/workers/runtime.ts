import { randomUUID } from "node:crypto";

import { Queue, Worker, type Job, type JobsOptions } from "bullmq";
import { Redis } from "ioredis";

import { env } from "../src/config/env.js";
import { AppError } from "../src/lib/http-errors.js";
import { logger as appLogger } from "../src/lib/logger.js";
import type { QueueConsumer, QueueMessage, QueuePublisher, QueuePublishRequest, WorkerLogger } from "./contracts.js";
import { buildWorkerQueueKey, type WorkerQueueName } from "./queue-names.js";

const DEFAULT_JOB_ATTEMPTS = 3;

function toIsoString(timestamp: number) {
  return new Date(timestamp).toISOString();
}

export function computeQueueDelayMs(runAt?: string, now = Date.now()) {
  if (!runAt) {
    return 0;
  }

  const scheduledAt = new Date(runAt).valueOf();

  if (Number.isNaN(scheduledAt)) {
    throw new RangeError(`Invalid runAt timestamp: ${runAt}`);
  }

  return Math.max(scheduledAt - now, 0);
}

export function resolvePublishedJobId(dedupeKey?: string) {
  const normalized = dedupeKey?.trim();
  return normalized ? normalized : randomUUID();
}

function mapBullMqJob<TPayload>(job: Job<TPayload, unknown, string>): QueueMessage<TPayload> {
  return {
    id: job.id ?? resolvePublishedJobId(),
    name: job.name,
    payload: job.data,
    runAt: job.delay > 0 ? toIsoString(job.timestamp + job.delay) : undefined,
    dedupeKey: job.id ?? undefined,
    attempts: job.opts.attempts,
    attemptsMade: job.attemptsMade,
    enqueuedAt: toIsoString(job.timestamp),
  };
}

function buildPhysicalQueueName(queueName: WorkerQueueName, prefix = env.WORKER_QUEUE_PREFIX) {
  return buildWorkerQueueKey(prefix, queueName);
}

function buildJobsOptions(input: {
  readonly jobId: string;
  readonly runAt?: string;
  readonly attempts?: number;
  readonly defaultAttempts?: number;
}): JobsOptions {
  return {
    jobId: input.jobId,
    delay: computeQueueDelayMs(input.runAt),
    attempts: input.attempts ?? input.defaultAttempts ?? DEFAULT_JOB_ATTEMPTS,
    removeOnComplete: 1_000,
    removeOnFail: 1_000,
  };
}

export interface BullMqQueuePublisherOptions {
  readonly queueName: WorkerQueueName;
  readonly connection: Redis;
  readonly defaultAttempts?: number;
}

export class BullMqQueuePublisher<TPayload> implements QueuePublisher<TPayload> {
  public readonly queueName: string;
  private readonly queue: Queue<TPayload, unknown, string>;

  public constructor(private readonly options: BullMqQueuePublisherOptions) {
    this.queueName = buildPhysicalQueueName(options.queueName);
    this.queue = new Queue<TPayload, unknown, string>(this.queueName, {
      connection: options.connection,
    });
  }

  public async publish(request: QueuePublishRequest<TPayload>) {
    const jobId = resolvePublishedJobId(request.dedupeKey);
    const job = await this.queue.add(
      request.name as Parameters<Queue<TPayload, unknown, string>["add"]>[0],
      request.payload as Parameters<Queue<TPayload, unknown, string>["add"]>[1],
      buildJobsOptions({
        jobId,
        runAt: request.runAt,
        attempts: request.attempts,
        defaultAttempts: this.options.defaultAttempts,
      }),
    );

    return {
      id: job.id ?? jobId,
      ...request,
    };
  }

  public async close() {
    await this.queue.close();
  }
}

export interface BullMqQueueConsumerOptions {
  readonly queueName: WorkerQueueName;
  readonly connection: Redis;
  readonly concurrency?: number;
  readonly logger?: WorkerLogger;
}

export class BullMqQueueConsumer<TPayload, TResult> implements QueueConsumer<TPayload, TResult> {
  public readonly queueName: string;
  private readonly logger: WorkerLogger;
  private readonly concurrency: number;
  private worker: Worker<TPayload, TResult, string> | null = null;

  public constructor(private readonly options: BullMqQueueConsumerOptions) {
    this.queueName = buildPhysicalQueueName(options.queueName);
    this.logger = options.logger ?? createWorkerLogger(this.queueName);
    this.concurrency = options.concurrency ?? env.WORKER_CONCURRENCY;
  }

  public async start(handler: (job: QueueMessage<TPayload>) => Promise<TResult>) {
    if (this.worker) {
      return;
    }

    this.worker = new Worker<TPayload, TResult, string>(
      this.queueName,
      async (job) => handler(mapBullMqJob(job)),
      {
        connection: this.options.connection,
        concurrency: this.concurrency,
      },
    );

    this.worker.on("error", (error) => {
      this.logger.error({ err: error, queue: this.queueName }, "Worker runtime error.");
    });
    this.worker.on("failed", (job, error) => {
      this.logger.error(
        {
          err: error,
          queue: this.queueName,
          jobId: job?.id,
          jobName: job?.name,
        },
        "Worker job failed.",
      );
    });
  }

  public async stop() {
    if (!this.worker) {
      return;
    }

    const activeWorker = this.worker;
    this.worker = null;
    await activeWorker.close();
  }
}

export function createWorkerRedisConnection() {
  const redisUrl = env.REDIS_URL?.trim();

  if (!redisUrl) {
    throw new AppError(503, "worker_redis_not_configured", "REDIS_URL must be configured before background workers can start.");
  }

  return new Redis(redisUrl, {
    maxRetriesPerRequest: null,
  });
}

export function createWorkerLogger(name: string): WorkerLogger {
  const logger = appLogger.child({
    component: "workers",
    worker: name,
  });

  return {
    info(metadata, message) {
      logger.info(metadata, message);
    },
    warn(metadata, message) {
      logger.warn(metadata, message);
    },
    error(metadata, message) {
      logger.error(metadata, message);
    },
  };
}

export function waitForShutdownSignal() {
  return new Promise<NodeJS.Signals>((resolve) => {
    process.once("SIGINT", () => resolve("SIGINT"));
    process.once("SIGTERM", () => resolve("SIGTERM"));
  });
}
