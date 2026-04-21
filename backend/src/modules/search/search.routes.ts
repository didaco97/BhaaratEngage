import { Router } from "express";
import { z } from "zod";

import { requireRoleAtLeast } from "../auth/authorization.middleware.js";
import type { SearchService } from "./search.service.js";

const searchQuerySchema = z.object({
  q: z.string().trim().default(""),
});

export function createSearchRouter(service: SearchService) {
  const router = Router();

  router.get("/global", requireRoleAtLeast("operator"), async (request, response) => {
    const { q } = searchQuerySchema.parse(request.query);
    const results = await service.global(q);
    return response.status(200).json({ data: results });
  });

  return router;
}
