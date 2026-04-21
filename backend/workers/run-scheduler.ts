import { setTimeout as sleep } from "node:timers/promises";

import type { Redis } from "ioredis";

import { createAuditService } from "../src/modules/audit/audit.service.js";
import { CampaignService } from "../src/modules/campaigns/campaign.service.js";
import { env } from "../src/config/env.js";
import { createRepositories } from "../src/repositories/create-repositories.js";
import type { DialerDispatchJobData } from "./dialer/dialer.types.js";
import type { JourneyDispatchJobData } from "./journey/journey.types.js";
import { WORKER_QUEUE_NAMES } from "./queue-names.js";
import { BullMqQueuePublisher, createWorkerLogger, createWorkerRedisConnection, waitForShutdownSignal } from "./runtime.js";
import { createCampaignScheduler } from "./scheduler/campaign-scheduler.js";
import { loadSchedulerWindowPlan } from "./scheduler/scheduler-candidates.js";

const workerName = "campaign-scheduler";
const logger = createWorkerLogger(workerName);

async function closePublisher<TPayload>(publisher: BullMqQueuePublisher<TPayload> | null) {
  if (!publisher) {
    return;
  }

  await publisher.close();
}

async function closeConnection(connection: Redis | null) {
  if (!connection) {
    return;
  }

  await connection.quit();
}

async function main() {
  let connection: Redis | null = null;
  let dialerQueue: BullMqQueuePublisher<DialerDispatchJobData> | null = null;
  let journeyQueue: BullMqQueuePublisher<JourneyDispatchJobData> | null = null;
  const repositories = createRepositories();
  const campaignService = new CampaignService(
    repositories.campaigns,
    repositories.contacts,
    createAuditService(repositories.audit),
  );

  try {
    connection = createWorkerRedisConnection();
    dialerQueue = new BullMqQueuePublisher<DialerDispatchJobData>({
      queueName: WORKER_QUEUE_NAMES.dialer,
      connection,
    });
    journeyQueue = new BullMqQueuePublisher<JourneyDispatchJobData>({
      queueName: WORKER_QUEUE_NAMES.journey,
      connection,
    });

    const scheduler = createCampaignScheduler({
      dialerQueue,
      journeyQueue,
      campaignService,
      logger,
    });
    const shutdownSignal = waitForShutdownSignal();

    logger.info(
      {
        intervalMs: env.WORKER_SCHEDULER_INTERVAL_MS,
        dialerQueue: dialerQueue.queueName,
        journeyQueue: journeyQueue.queueName,
      },
      "Campaign scheduler is polling active campaigns for enqueue.",
    );

    while (true) {
      const schedulerWindowPlan = await loadSchedulerWindowPlan(repositories);
      const result = await scheduler.runTick({
        dialerCampaigns: schedulerWindowPlan.dialerCampaigns,
        journeyActions: [],
        campaignTransitions: schedulerWindowPlan.campaignTransitions,
      });

      logger.info(
        {
          dialerJobs: result.dispatchedDialerJobs,
          journeyJobs: result.dispatchedJourneyJobs,
          autoPausedCampaigns: result.autoPausedCampaigns,
          autoResumedCampaigns: result.autoResumedCampaigns,
        },
        "Campaign scheduler tick completed.",
      );

      const nextSignal = await Promise.race([
        sleep(env.WORKER_SCHEDULER_INTERVAL_MS).then(() => null),
        shutdownSignal,
      ]);

      if (nextSignal) {
        logger.info({ signal: nextSignal }, "Stopping campaign scheduler.");
        break;
      }
    }
  } finally {
    await closePublisher(dialerQueue);
    await closePublisher(journeyQueue);
    await closeConnection(connection);
  }
}

void main().catch((error: unknown) => {
  logger.error({ err: error }, "Campaign scheduler failed to start.");
  process.exitCode = 1;
});
