import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { Router } from "express";
import { z } from "zod";

import { callStatusSchema } from "../../domain/enums.js";
import { AppError } from "../../lib/http-errors.js";
import { requireRoleAtLeast } from "../auth/authorization.middleware.js";
import type { CallRecordService } from "./call-record.service.js";

const callRecordIdParamSchema = z.object({
  id: z.string().min(1),
});

const callRecordListQuerySchema = z.object({
  search: z.string().trim().optional(),
  status: z.union([z.literal("all"), callStatusSchema]).optional().default("all"),
  campaignId: z.string().trim().optional(),
});

export function createCallRecordRouter(service: CallRecordService) {
  const router = Router();

  router.get("/export.csv", requireRoleAtLeast("reviewer"), async (request, response) => {
    const query = callRecordListQuerySchema.parse(request.query);
    const csv = await service.exportCsv(query);

    response.setHeader("Content-Type", "text/csv; charset=utf-8");
    response.setHeader("Content-Disposition", 'attachment; filename="call-records-export.csv"');

    return response.status(200).send(csv);
  });

  router.get("/", requireRoleAtLeast("operator"), async (request, response) => {
    const query = callRecordListQuerySchema.parse(request.query);
    const callRecords = await service.list(query);

    return response.status(200).json({
      data: callRecords,
      meta: { total: callRecords.length },
    });
  });

  router.get("/:id", requireRoleAtLeast("operator"), async (request, response) => {
    const { id } = callRecordIdParamSchema.parse(request.params);
    const callRecord = await service.getById(id);
    return response.status(200).json({ data: callRecord });
  });

  router.get("/:id/recording", requireRoleAtLeast("reviewer"), async (request, response) => {
    const { id } = callRecordIdParamSchema.parse(request.params);
    const recordingUrl = await service.getRecordingUrl(id);
    let upstreamResponse: Response;

    try {
      upstreamResponse = await fetch(recordingUrl, { redirect: "follow" });
    } catch {
      throw new AppError(502, "recording_proxy_failed", `Recording for call record ${id} could not be fetched.`);
    }

    if (!upstreamResponse.ok || !upstreamResponse.body) {
      throw new AppError(502, "recording_proxy_failed", `Recording for call record ${id} could not be fetched.`);
    }

    response.status(200);
    response.setHeader("Cache-Control", "private, no-store");
    response.setHeader("Content-Type", upstreamResponse.headers.get("content-type") ?? "application/octet-stream");

    const forwardedHeaders = ["content-length", "content-disposition", "etag", "last-modified"] as const;

    for (const headerName of forwardedHeaders) {
      const headerValue = upstreamResponse.headers.get(headerName);

      if (headerValue) {
        response.setHeader(headerName, headerValue);
      }
    }

    await pipeline(Readable.fromWeb(upstreamResponse.body), response);
  });

  router.get("/:id/transcript", requireRoleAtLeast("reviewer"), async (request, response) => {
    const { id } = callRecordIdParamSchema.parse(request.params);
    const transcript = await service.getTranscript(id);
    return response.status(200).json({ data: transcript });
  });

  router.get("/:id/data", requireRoleAtLeast("reviewer"), async (request, response) => {
    const { id } = callRecordIdParamSchema.parse(request.params);
    const collectedData = await service.getCollectedData(id);
    return response.status(200).json({ data: collectedData });
  });

  return router;
}
