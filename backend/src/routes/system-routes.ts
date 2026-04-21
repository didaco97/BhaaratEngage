import { Router } from "express";

import { env } from "../config/env.js";
import { getReadinessSnapshot } from "../lib/readiness.js";

const serviceVersion = process.env.npm_package_version ?? "0.1.0";

export function createSystemRouter() {
  const router = Router();

  router.get("/health", (_request, response) => {
    return response.status(200).json({
      status: "ok",
      service: "bharatengage-backend",
      version: serviceVersion,
      timestamp: new Date().toISOString(),
    });
  });

  router.get("/ready", (_request, response) => {
    return response.status(200).json(getReadinessSnapshot(env));
  });

  router.get("/api/meta", (_request, response) => {
    return response.status(200).json({
      service: "bharatengage-backend",
      version: serviceVersion,
      phase: "foundation",
      frontendOrigin: env.FRONTEND_ORIGIN,
    });
  });

  return router;
}
