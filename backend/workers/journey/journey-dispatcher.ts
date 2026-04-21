import type { BackendRepositories } from "../../src/repositories/backend-repositories.js";
import { JourneyFollowUpService, type JourneyFollowUpServiceDependencies } from "../../src/modules/journeys/journey-dispatch.service.js";
import type { JourneyFollowUpGateway } from "../../src/modules/journeys/journey-followup-gateway.js";
import type { JourneyDispatchJobData, JourneyWorkerResult } from "./journey.types.js";
import { noopWorkerLogger, type QueueMessage, type WorkerLogger } from "../contracts.js";

export interface JourneyDispatchServiceDependencies {
  readonly repositories: Pick<BackendRepositories, "campaigns" | "contacts" | "journeys" | "audit">;
  readonly followUpGateway: JourneyFollowUpGateway;
  readonly logger?: WorkerLogger;
  readonly now?: () => Date;
}

export class JourneyDispatchService {
  private readonly service: JourneyFollowUpService;

  public constructor(dependencies: JourneyDispatchServiceDependencies) {
    this.service = new JourneyFollowUpService({
      ...(dependencies as JourneyFollowUpServiceDependencies),
      logger: dependencies.logger ?? noopWorkerLogger,
    });
  }

  public handleJob(job: QueueMessage<JourneyDispatchJobData>): Promise<JourneyWorkerResult> {
    return this.service.handle(job.payload);
  }
}

export function createJourneyJobHandler(dependencies: JourneyDispatchServiceDependencies) {
  const service = new JourneyDispatchService(dependencies);

  return (job: QueueMessage<JourneyDispatchJobData>) => service.handleJob(job);
}
