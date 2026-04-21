import { Router } from "express";

import type { VoiceService } from "./voice.service.js";
import { plivoAnswerPayloadSchema, plivoStatusPayloadSchema, plivoTransferQuerySchema, plivoVoiceQuerySchema } from "./voice.schemas.js";

function normalizeWebhookParams(value: Record<string, unknown>) {
  const normalized: Record<string, string> = {};

  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === "string") {
      normalized[key] = entry;
      continue;
    }

    if (Array.isArray(entry)) {
      const firstString = entry.find((item): item is string => typeof item === "string");

      if (firstString) {
        normalized[key] = firstString;
      }
    }
  }

  return normalized;
}

export function createVoiceWebhookRouter(service: VoiceService) {
  const router = Router();

  router.post("/plivo/answer", async (request, response) => {
    const query = plivoVoiceQuerySchema.parse(request.query);
    const payload = plivoAnswerPayloadSchema.parse(request.body);
    const requestParams = normalizeWebhookParams({
      ...request.query,
      ...request.body,
    });

    service.validateWebhookSignature({
      method: request.method,
      pathWithQuery: request.originalUrl,
      headers: request.headers,
      params: requestParams,
    });

    const xml = await service.buildAnswerXml({
      campaignId: query.campaignId,
      contactId: query.contactId,
      callUuid: payload.CallUUID,
    });

    response.status(200);
    response.type("application/xml");
    return response.send(xml);
  });

  router.post("/plivo/status", async (request, response) => {
    const query = plivoVoiceQuerySchema.partial().parse(request.query);
    const payload = plivoStatusPayloadSchema.parse(request.body);
    const requestParams = normalizeWebhookParams({
      ...request.query,
      ...request.body,
    });

    service.validateWebhookSignature({
      method: request.method,
      pathWithQuery: request.originalUrl,
      headers: request.headers,
      params: requestParams,
    });

    await service.processStatusCallback({
      campaignId: query.campaignId,
      contactId: query.contactId,
      callUuid: payload.CallUUID,
      providerStatus: payload.CallStatus,
      source: query.source,
      durationSeconds: payload.CallDuration,
      recordingUrl: payload.RecordingUrl,
      errorCode: payload.ErrorCode,
      answeredAt: payload.AnswerTime,
      endedAt: payload.EndTime,
    });

    return response.status(204).send();
  });

  router.post("/plivo/transfer", async (request, response) => {
    const query = plivoTransferQuerySchema.parse(request.query);
    const requestParams = normalizeWebhookParams({
      ...request.query,
      ...request.body,
    });

    service.validateWebhookSignature({
      method: request.method,
      pathWithQuery: request.originalUrl,
      headers: request.headers,
      params: requestParams,
    });

    const xml = await service.buildTransferXml({
      callUuid: query.callUuid,
    });

    response.status(200);
    response.type("application/xml");
    return response.send(xml);
  });

  return router;
}
