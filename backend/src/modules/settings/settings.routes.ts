import { Router } from "express";
import { z } from "zod";

import { requireRoleAtLeast } from "../auth/authorization.middleware.js";
import type { SettingsService } from "./settings.service.js";
import {
  createApiKeyRequestSchema,
  inviteTeamMemberRequestSchema,
  updateTeamMemberRoleRequestSchema,
  updateNotificationPreferencesRequestSchema,
  webhookConfigSchema,
  workspaceSettingsSchema,
} from "./settings.schemas.js";

const userIdParamSchema = z.object({
  userId: z.string().min(1),
});

const apiKeyIdParamSchema = z.object({
  id: z.string().min(1),
});

export function createSettingsRouter(service: SettingsService) {
  const router = Router();

  router.get("/", requireRoleAtLeast("workspace_admin"), async (_request, response) => {
    const snapshot = await service.getSnapshot();
    return response.status(200).json({ data: snapshot });
  });

  router.patch("/workspace", requireRoleAtLeast("workspace_admin"), async (request, response) => {
    const payload = workspaceSettingsSchema.parse(request.body);
    const snapshot = await service.updateWorkspaceSettings(payload);
    return response.status(200).json({ data: snapshot });
  });

  router.patch("/notifications", requireRoleAtLeast("workspace_admin"), async (request, response) => {
    const payload = updateNotificationPreferencesRequestSchema.parse(request.body);
    const snapshot = await service.updateNotificationPreferences(payload.preferences);
    return response.status(200).json({ data: snapshot });
  });

  router.patch("/webhook", requireRoleAtLeast("workspace_admin"), async (request, response) => {
    const payload = webhookConfigSchema.parse(request.body);
    const snapshot = await service.updateWebhookConfig(payload);
    return response.status(200).json({ data: snapshot });
  });

  router.post("/team/invite", requireRoleAtLeast("workspace_admin"), async (request, response) => {
    const payload = inviteTeamMemberRequestSchema.parse(request.body);
    const snapshot = await service.inviteTeamMember(payload);
    return response.status(201).json({ data: snapshot });
  });

  router.put("/team/:userId/role", requireRoleAtLeast("workspace_admin"), async (request, response) => {
    const { userId } = userIdParamSchema.parse(request.params);
    const payload = updateTeamMemberRoleRequestSchema.parse(request.body);
    const snapshot = await service.updateTeamMemberRole(userId, payload.role);
    return response.status(200).json({ data: snapshot });
  });

  router.delete("/team/:userId", requireRoleAtLeast("workspace_admin"), async (request, response) => {
    const { userId } = userIdParamSchema.parse(request.params);
    const snapshot = await service.removeTeamMember(userId);
    return response.status(200).json({ data: snapshot });
  });

  router.get("/api-keys", requireRoleAtLeast("workspace_admin"), async (_request, response) => {
    const apiKeys = await service.listApiKeys();
    return response.status(200).json({
      data: apiKeys,
      meta: { total: apiKeys.length },
    });
  });

  router.post("/api-keys", requireRoleAtLeast("workspace_admin"), async (request, response) => {
    const payload = createApiKeyRequestSchema.parse(request.body);
    const apiKey = await service.createApiKey(payload);
    return response.status(201).json({ data: apiKey });
  });

  router.delete("/api-keys/:id", requireRoleAtLeast("workspace_admin"), async (request, response) => {
    const { id } = apiKeyIdParamSchema.parse(request.params);
    await service.deleteApiKey(id);
    return response.status(204).send();
  });

  return router;
}
