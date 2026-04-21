import { Router } from "express";
import { z } from "zod";

import { contactStatusSchema } from "../../domain/enums.js";
import { requireRoleAtLeast } from "../auth/authorization.middleware.js";
import type { ContactService } from "./contact.service.js";
import { contactImportRequestSchema, createContactRequestSchema, updateContactRequestSchema } from "./contact.schemas.js";

const contactIdParamSchema = z.object({
  id: z.string().min(1),
});

const contactListQuerySchema = z.object({
  search: z.string().trim().optional(),
  status: z.union([z.literal("all"), contactStatusSchema]).optional().default("all"),
});

export function createContactRouter(service: ContactService) {
  const router = Router();

  router.get("/export.csv", requireRoleAtLeast("reviewer"), async (request, response) => {
    const query = contactListQuerySchema.parse(request.query);
    const csv = await service.exportCsv(query);

    response.setHeader("Content-Type", "text/csv; charset=utf-8");
    response.setHeader("Content-Disposition", 'attachment; filename="contacts-export.csv"');

    return response.status(200).send(csv);
  });

  router.get("/", requireRoleAtLeast("operator"), async (request, response) => {
    const query = contactListQuerySchema.parse(request.query);
    const contacts = await service.list(query);

    return response.status(200).json({
      data: contacts,
      meta: { total: contacts.length },
    });
  });

  router.post("/", requireRoleAtLeast("operator"), async (request, response) => {
    const payload = createContactRequestSchema.parse(request.body);
    const contact = await service.create(payload);
    return response.status(201).json({ data: contact });
  });

  router.post("/import", requireRoleAtLeast("operator"), async (request, response) => {
    const payload = contactImportRequestSchema.parse(request.body);
    const summary = await service.importCsv(payload);
    return response.status(201).json({ data: summary });
  });

  router.put("/:id", requireRoleAtLeast("operator"), async (request, response) => {
    const { id } = contactIdParamSchema.parse(request.params);
    const payload = updateContactRequestSchema.parse(request.body);
    const contact = await service.update(id, payload);
    return response.status(200).json({ data: contact });
  });

  router.post("/:id/do-not-call", requireRoleAtLeast("operator"), async (request, response) => {
    const { id } = contactIdParamSchema.parse(request.params);
    const contact = await service.markDoNotCall(id);
    return response.status(200).json({ data: contact });
  });

  router.delete("/:id", requireRoleAtLeast("operator"), async (request, response) => {
    const { id } = contactIdParamSchema.parse(request.params);
    await service.remove(id);
    return response.status(204).send();
  });

  return router;
}
