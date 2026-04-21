import { z } from "zod";

export const voiceCampaignParamSchema = z.object({
  id: z.coerce.string().trim().min(1),
});

export const voiceTestCallRequestSchema = z.object({
  contactId: z.coerce.string().trim().min(1),
});

export const voiceDispatchSourceSchema = z.enum(["test", "scheduler", "manual", "retry"]);

export const plivoVoiceQuerySchema = z.object({
  campaignId: z.coerce.string().trim().min(1),
  contactId: z.coerce.string().trim().min(1),
  source: voiceDispatchSourceSchema.optional(),
});

export const plivoTransferQuerySchema = z.object({
  callUuid: z.coerce.string().trim().min(1),
});

export const plivoAnswerPayloadSchema = z
  .object({
    CallUUID: z.coerce.string().trim().min(1),
    CallStatus: z.coerce.string().trim().min(1).optional(),
  })
  .passthrough();

export const plivoStatusPayloadSchema = z
  .object({
    CallUUID: z.coerce.string().trim().min(1),
    CallStatus: z.coerce.string().trim().min(1),
    CallDuration: z.coerce.number().int().nonnegative().optional(),
    RecordingUrl: z.string().trim().url().optional(),
    ErrorCode: z.coerce.string().trim().min(1).optional(),
    AnswerTime: z.coerce.string().trim().min(1).optional(),
    EndTime: z.coerce.string().trim().min(1).optional(),
  })
  .passthrough();

export type VoiceTestCallRequest = z.infer<typeof voiceTestCallRequestSchema>;
export type VoiceDispatchSource = z.infer<typeof voiceDispatchSourceSchema>;
export type PlivoVoiceQuery = z.infer<typeof plivoVoiceQuerySchema>;
export type PlivoTransferQuery = z.infer<typeof plivoTransferQuerySchema>;
export type PlivoAnswerPayload = z.infer<typeof plivoAnswerPayloadSchema>;
export type PlivoStatusPayload = z.infer<typeof plivoStatusPayloadSchema>;
