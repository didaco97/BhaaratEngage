import { Router } from "express";

import { requireRoleAtLeast } from "../auth/authorization.middleware.js";
import type { ReportService } from "./report.service.js";

export function createReportRouter(service: ReportService) {
  const router = Router();

  router.get("/export.csv", requireRoleAtLeast("reviewer"), async (_request, response) => {
    const csv = await service.exportCsv();

    response.setHeader("Content-Type", "text/csv; charset=utf-8");
    response.setHeader("Content-Disposition", 'attachment; filename="reports-export.csv"');

    return response.status(200).send(csv);
  });

  router.get("/", requireRoleAtLeast("viewer"), async (_request, response) => {
    const snapshot = await service.getSnapshot();
    return response.status(200).json({ data: snapshot });
  });

  return router;
}
