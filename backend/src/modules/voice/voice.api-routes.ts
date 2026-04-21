import { Router } from "express";

import { requireRoleAtLeast } from "../auth/authorization.middleware.js";
import type { VoiceService } from "./voice.service.js";
import { voiceCampaignParamSchema, voiceTestCallRequestSchema } from "./voice.schemas.js";

export function createVoiceApiRouter(service: VoiceService) {
  const router = Router();

  router.post("/campaigns/:id/test-call", requireRoleAtLeast("campaign_manager"), async (request, response) => {
    const { id } = voiceCampaignParamSchema.parse(request.params);
    const payload = voiceTestCallRequestSchema.parse(request.body);
    const result = await service.startTestCall(id, payload.contactId);

    return response.status(201).json({
      data: result,
    });
  });

  return router;
}
