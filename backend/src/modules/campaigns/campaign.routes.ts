import { Router } from "express";
import { z } from "zod";

import { campaignStatusSchema, contactStatusSchema } from "../../domain/enums.js";
import { requireRoleAtLeast } from "../auth/authorization.middleware.js";
import type { CampaignService } from "./campaign.service.js";
import { createCampaignRequestSchema, updateCampaignRequestSchema } from "./campaign.schemas.js";

const campaignIdParamSchema = z.object({
  id: z.string().min(1),
});

const campaignListQuerySchema = z.object({
  search: z.string().trim().optional(),
  status: z.union([z.literal("all"), campaignStatusSchema]).optional().default("all"),
});

const campaignContactListQuerySchema = z.object({
  search: z.string().trim().optional(),
  status: z.union([z.literal("all"), contactStatusSchema]).optional().default("all"),
});

const campaignContactIdParamSchema = campaignIdParamSchema.extend({
  contactId: z.string().min(1),
});

const assignCampaignContactsRequestSchema = z.object({
  contactIds: z.array(z.string().min(1)).min(1),
});

export function createCampaignRouter(service: CampaignService) {
  const router = Router();

  router.get("/", requireRoleAtLeast("viewer"), async (request, response) => {
    const query = campaignListQuerySchema.parse(request.query);
    const campaigns = await service.list(query);

    return response.status(200).json({
      data: campaigns,
      meta: { total: campaigns.length },
    });
  });

  router.post("/", requireRoleAtLeast("campaign_manager"), async (request, response) => {
    const payload = createCampaignRequestSchema.parse(request.body);
    const campaign = await service.create(payload);

    return response.status(201).json({ data: campaign });
  });

  router.get("/:id/contacts", requireRoleAtLeast("operator"), async (request, response) => {
    const { id } = campaignIdParamSchema.parse(request.params);
    const query = campaignContactListQuerySchema.parse(request.query);
    const contacts = await service.listContacts(id, query);

    return response.status(200).json({
      data: contacts,
      meta: { total: contacts.length },
    });
  });

  router.post("/:id/contacts", requireRoleAtLeast("campaign_manager"), async (request, response) => {
    const { id } = campaignIdParamSchema.parse(request.params);
    const payload = assignCampaignContactsRequestSchema.parse(request.body);
    const contacts = await service.assignContacts(id, payload.contactIds);

    return response.status(200).json({
      data: contacts,
      meta: { total: contacts.length },
    });
  });

  router.delete("/:id/contacts/:contactId", requireRoleAtLeast("campaign_manager"), async (request, response) => {
    const { id, contactId } = campaignContactIdParamSchema.parse(request.params);
    await service.removeContact(id, contactId);
    return response.status(204).send();
  });

  router.get("/:id", requireRoleAtLeast("viewer"), async (request, response) => {
    const { id } = campaignIdParamSchema.parse(request.params);
    const campaign = await service.getById(id);
    return response.status(200).json({ data: campaign });
  });

  router.put("/:id", requireRoleAtLeast("campaign_manager"), async (request, response) => {
    const { id } = campaignIdParamSchema.parse(request.params);
    const payload = updateCampaignRequestSchema.parse(request.body);
    const campaign = await service.update(id, payload);
    return response.status(200).json({ data: campaign });
  });

  router.post("/:id/launch", requireRoleAtLeast("campaign_manager"), async (request, response) => {
    const { id } = campaignIdParamSchema.parse(request.params);
    const campaign = await service.launch(id);
    return response.status(200).json({ data: campaign });
  });

  router.post("/:id/pause", requireRoleAtLeast("campaign_manager"), async (request, response) => {
    const { id } = campaignIdParamSchema.parse(request.params);
    const campaign = await service.pause(id);
    return response.status(200).json({ data: campaign });
  });

  router.post("/:id/resume", requireRoleAtLeast("campaign_manager"), async (request, response) => {
    const { id } = campaignIdParamSchema.parse(request.params);
    const campaign = await service.resume(id);
    return response.status(200).json({ data: campaign });
  });

  router.post("/:id/duplicate", requireRoleAtLeast("campaign_manager"), async (request, response) => {
    const { id } = campaignIdParamSchema.parse(request.params);
    const campaign = await service.duplicate(id);
    return response.status(201).json({ data: campaign });
  });

  router.delete("/:id", requireRoleAtLeast("campaign_manager"), async (request, response) => {
    const { id } = campaignIdParamSchema.parse(request.params);
    await service.remove(id);
    return response.status(204).send();
  });

  return router;
}
