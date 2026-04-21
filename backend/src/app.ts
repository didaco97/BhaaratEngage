import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { pinoHttp } from "pino-http";

import { env } from "./config/env.js";
import { logger } from "./lib/logger.js";
import { errorHandler } from "./middleware/error-handler.js";
import { notFoundHandler } from "./middleware/not-found-handler.js";
import type { ApiAuthDependencies } from "./modules/auth/auth.types.js";
import { createVoiceService } from "./modules/voice/voice.service.js";
import { createVoiceWebhookRouter } from "./modules/voice/voice.webhook-routes.js";
import type { BackendRepositories } from "./repositories/backend-repositories.js";
import { createRepositories } from "./repositories/create-repositories.js";
import { createApiRouter } from "./routes/api-router.js";
import { createSystemRouter } from "./routes/system-routes.js";

export interface AppDependencies {
  readonly repositories?: BackendRepositories;
  readonly auth?: ApiAuthDependencies;
}

export function createApp(dependencies: AppDependencies = {}) {
  const app = express();
  const repositories = dependencies.repositories ?? createRepositories();
  const voiceService = createVoiceService(repositories);

  app.disable("x-powered-by");
  app.use(
    helmet({
      crossOriginResourcePolicy: false,
    }),
  );
  app.use(
    cors({
      origin: env.FRONTEND_ORIGIN,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.use(
    pinoHttp({
      logger,
      autoLogging: {
        ignore: (request) => request.url === "/health",
      },
    }),
  );
  app.use(
    "/api",
    rateLimit({
      windowMs: 60_000,
      limit: 120,
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );

  app.use(createSystemRouter());
  app.use("/voice", createVoiceWebhookRouter(voiceService));
  app.use("/api", createApiRouter(repositories, dependencies.auth));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
