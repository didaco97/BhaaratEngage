import type { Redis } from "ioredis";

import { env } from "../src/config/env.js";
import { runWithRequestOrganizationId } from "../src/modules/auth/request-auth-context.js";
import { createRepositories } from "../src/repositories/create-repositories.js";
import { WORKER_QUEUE_NAMES } from "./queue-names.js";
import { BullMqQueueConsumer, createWorkerLogger, createWorkerRedisConnection, waitForShutdownSignal } from "./runtime.js";
import { createJourneyWebhookGateway } from "./journey/journey-followup-gateway.js";
import { createJourneyJobHandler } from "./journey/journey-dispatcher.js";
import { createJourneyWorker } from "./journey/journey-worker.js";
import type { JourneyDispatchJobData, JourneyWorkerResult } from "./journey/journey.types.js";

const workerName = "journey-worker";
const logger = createWorkerLogger(workerName);

async function closeConnection(connection: Redis | null) {
  if (!connection) {
    return;
  }

  await connection.quit();
}

async function main() {
  let connection: Redis | null = null;
  const repositories = createRepositories();
  const handler = createJourneyJobHandler({
    repositories,
    followUpGateway: createJourneyWebhookGateway({
      loadSettings: () => repositories.settings.getSnapshot(),
    }),
    logger,
  });
  const consumer = new BullMqQueueConsumer<JourneyDispatchJobData, JourneyWorkerResult>({
    queueName: WORKER_QUEUE_NAMES.journey,
    connection: (connection = createWorkerRedisConnection()),
    concurrency: env.WORKER_CONCURRENCY,
    logger,
  });
  const worker = createJourneyWorker({
    consumer,
    logger,
    handler: (job) => runWithRequestOrganizationId(job.payload.organizationId, () => handler(job)),
  });

  try {
    await worker.start();
    logger.info(
      {
        queue: consumer.queueName,
        concurrency: env.WORKER_CONCURRENCY,
      },
      "Journey worker is listening for queue jobs.",
    );

    const signal = await waitForShutdownSignal();
    logger.info({ signal, queue: consumer.queueName }, "Stopping journey worker.");
  } finally {
    await worker.stop();
    await closeConnection(connection);
  }
}

void main().catch((error: unknown) => {
  logger.error({ err: error }, "Journey worker failed to start.");
  process.exitCode = 1;
});
