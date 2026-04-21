import { Router } from "express";

import { requireRoleAtLeast } from "../auth/authorization.middleware.js";
import type { DashboardService } from "./dashboard.service.js";

export function createDashboardRouter(service: DashboardService) {
  const router = Router();

  router.get("/", requireRoleAtLeast("viewer"), async (_request, response) => {
    const snapshot = await service.getSnapshot();
    return response.status(200).json({ data: snapshot });
  });

  return router;
}
