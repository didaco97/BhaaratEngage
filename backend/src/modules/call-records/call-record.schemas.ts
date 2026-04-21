import { z } from "zod";

import { callStatusSchema, transcriptModeSchema } from "../../domain/enums.js";

export const callRecordSchema = z.object({
  id: z.string().uuid().or(z.string().min(1)),
  campaignId: z.string().min(1),
  campaignName: z.string().min(1),
  contactName: z.string().min(1),
  phone: z.string().min(10),
  provider: z.string().min(1),
  status: callStatusSchema,
  disposition: z.string().min(1),
  confirmed: z.boolean(),
  duration: z.number().int().nonnegative(),
  startedAt: z.string(),
  language: z.string().min(1),
  fieldsCollected: z.number().int().nonnegative(),
  fieldsTotal: z.number().int().positive(),
  transcriptMode: transcriptModeSchema,
  errorCode: z.string().optional(),
});

export const transcriptTurnSchema = z.object({
  speaker: z.enum(["Bot", "User", "System"]),
  text: z.string().min(1),
});

export const collectedFieldSchema = z.object({
  fieldKey: z.string().min(1),
  label: z.string().min(1),
  value: z.string().min(1),
  confidenceScore: z.number().min(0).max(1),
  confirmed: z.boolean(),
  masked: z.boolean(),
});

export type CallRecord = z.infer<typeof callRecordSchema>;
export type TranscriptTurn = z.infer<typeof transcriptTurnSchema>;
export type CollectedField = z.infer<typeof collectedFieldSchema>;
