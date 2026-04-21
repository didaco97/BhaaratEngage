import { Queue } from "bullmq";
import { Redis } from "ioredis";

import { env } from "../../config/env.js";
import { logger as appLogger } from "../../lib/logger.js";
import type { BackendRepositories } from "../../repositories/backend-repositories.js";
import { runWithRequestOrganizationId } from "../auth/request-auth-context.js";
import { JourneyFollowUpService } from "./journey-dispatch.service.js";
import type { JourneyDispatchJobData } from "./journey-dispatch.types.js";
import { createJourneyWebhookGateway } from "./journey-followup-gateway.js";

export interface JourneyJobDispatcher {
  dispatch(job: JourneyDispatchJobData): Promise<void>;
}

let cachedJourneyConnection: Redis | null = null;
let cachedJourneyQueue: Queue<JourneyDispatchJobData, unknown, string> | null = null;
const inlineJourneyDispatchKeys = new Set<string>();
const JOURNEY_QUEUE_NAME = "journey-queue";

function buildJourneyDispatchKey(job: JourneyDispatchJobData) {
  const identity = job.callRecordId ?? `${job.campaignId}:${job.contactId}`;
  return `${job.organizationId}:${identity}:${job.action}`;
}

function buildPhysicalJourneyQueueName() {
  const normalizedPrefix = env.WORKER_QUEUE_PREFIX.trim();
  return normalizedPrefix ? `${normalizedPrefix}-${JOURNEY_QUEUE_NAME}` : JOURNEY_QUEUE_NAME;
}

function getJourneyQueue() {
  const redisUrl = env.REDIS_URL?.trim();

  if (!redisUrl) {
    return null;
  }

  if (!cachedJourneyConnection) {
    cachedJourneyConnection = new Redis(redisUrl, {
      maxRetriesPerRequest: null,
    });
  }

  if (!cachedJourneyQueue) {
    cachedJourneyQueue = new Queue<JourneyDispatchJobData, unknown, string>(buildPhysicalJourneyQueueName(), {
      connection: cachedJourneyConnection,
    });
  }

  return cachedJourneyQueue;
}

export function createJourneyJobDispatcher(
  repositories: Pick<BackendRepositories, "campaigns" | "contacts" | "journeys" | "settings" | "audit">,
): JourneyJobDispatcher {
  const logger = appLogger.child({
    component: "journey-followup-dispatcher",
  });
  const queue = getJourneyQueue();

  if (queue) {
    return {
      async dispatch(job) {
        await queue.add(JOURNEY_QUEUE_NAME, job, {
          jobId: buildJourneyDispatchKey(job),
          attempts: 3,
          removeOnComplete: 1_000,
          removeOnFail: 1_000,
        });
      },
    };
  }

  const handler = new JourneyFollowUpService({
    repositories,
    followUpGateway: createJourneyWebhookGateway({
      loadSettings: () => repositories.settings.getSnapshot(),
    }),
    logger: {
      info(metadata, message) {
        logger.info(metadata, message);
      },
      warn(metadata, message) {
        logger.warn(metadata, message);
      },
      error(metadata, message) {
        logger.error(metadata, message);
      },
    },
  });

  return {
    async dispatch(job) {
      const dispatchKey = buildJourneyDispatchKey(job);

      if (inlineJourneyDispatchKeys.has(dispatchKey)) {
        return;
      }

      inlineJourneyDispatchKeys.add(dispatchKey);

      try {
        await runWithRequestOrganizationId(job.organizationId, () => handler.handle(job));
      } catch (error) {
        inlineJourneyDispatchKeys.delete(dispatchKey);
        throw error;
      }
    },
  };
}
