import { Router } from "express";

import { z } from "zod";

import { requireRoleAtLeast } from "../auth/authorization.middleware.js";
import type { JourneyService } from "./journey.service.js";

const journeyIdParamSchema = z.object({
  id: z.string().min(1),
});

export function createJourneyRouter(service: JourneyService) {
  const router = Router();

  router.get("/", requireRoleAtLeast("viewer"), async (_request, response) => {
    const journeys = await service.list();
    return response.status(200).json({
      data: journeys,
      meta: { total: journeys.length },
    });
  });

  router.get("/:id", requireRoleAtLeast("viewer"), async (request, response) => {
    const { id } = journeyIdParamSchema.parse(request.params);
    const journey = await service.getById(id);
    return response.status(200).json({ data: journey });
  });

  return router;
}
