import type { Redis } from "ioredis";

import { env } from "../src/config/env.js";
import { runWithRequestOrganizationId } from "../src/modules/auth/request-auth-context.js";
import { createVoiceService } from "../src/modules/voice/voice.service.js";
import { createRepositories } from "../src/repositories/create-repositories.js";
import { createDialerJobHandler } from "./dialer/dialer-dispatcher.js";
import { createDialerWorker } from "./dialer/dialer-worker.js";
import type { DialerDispatchJobData, DialerWorkerResult } from "./dialer/dialer.types.js";
import { WORKER_QUEUE_NAMES } from "./queue-names.js";
import { BullMqQueueConsumer, createWorkerLogger, createWorkerRedisConnection, waitForShutdownSignal } from "./runtime.js";

const workerName = "dialer-worker";
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
  const voiceService = createVoiceService(repositories);
  const handler = createDialerJobHandler({
    repositories,
    voiceCaller: voiceService,
    logger,
  });
  const consumer = new BullMqQueueConsumer<DialerDispatchJobData, DialerWorkerResult>({
    queueName: WORKER_QUEUE_NAMES.dialer,
    connection: (connection = createWorkerRedisConnection()),
    concurrency: env.WORKER_CONCURRENCY,
    logger,
  });
  const worker = createDialerWorker({
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
      "Dialer worker is listening for queue jobs.",
    );

    const signal = await waitForShutdownSignal();
    logger.info({ signal, queue: consumer.queueName }, "Stopping dialer worker.");
  } finally {
    await worker.stop();
    await closeConnection(connection);
  }
}

void main().catch((error: unknown) => {
  logger.error({ err: error }, "Dialer worker failed to start.");
  process.exitCode = 1;
});
