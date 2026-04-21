import { z } from "zod";

import {
  campaignStatusSchema,
  fieldTypeSchema,
  journeyActionSchema,
  supportedLanguageSchema,
  verticalSchema,
} from "../../domain/enums.js";

const timeValueSchema = z.string().regex(/^\d{2}:\d{2}$/u, "Expected time in HH:MM format.");

export const campaignFieldSchema = z.object({
  field_key: z.string().min(1).max(64),
  label: z.string().min(1).max(120),
  prompt: z.string().min(1).max(2000),
  type: fieldTypeSchema,
  required: z.boolean(),
  sensitive: z.boolean(),
  verification_label: z.string().max(120).optional().default(""),
  retry_limit: z.number().int().min(1).max(5),
  validation_rule: z.string().max(255).optional().default(""),
});

export const campaignJourneyRuleSchema = z.object({
  unansweredAction: journeyActionSchema,
  partialAction: journeyActionSchema,
  retryWindowHours: z.coerce.number().int().min(0).max(168),
  maxRetries: z.coerce.number().int().min(0).max(10),
  concurrencyLimit: z.coerce.number().int().min(1).max(500),
  pacingPerMinute: z.coerce.number().int().min(1).max(500),
  csvSource: z.string().min(1).max(200),
});

export const campaignSetupSchema = z.object({
  campaignName: z.string().min(1).max(120),
  vertical: verticalSchema,
  language: supportedLanguageSchema,
  callerIdentity: z.string().min(1).max(120),
  introScript: z.string().min(1).max(4000),
  purposeStatement: z.string().min(1).max(4000),
  callingWindowStart: timeValueSchema,
  callingWindowEnd: timeValueSchema,
  transferEnabled: z.boolean(),
  transferQueue: z.string().max(120),
}).superRefine((value, context) => {
  if (value.transferEnabled && value.transferQueue.trim().length === 0) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["transferQueue"],
      message: "Transfer queue is required when transfer is enabled.",
    });
  }
});

export const createCampaignRequestSchema = z.object({
  setup: campaignSetupSchema,
  fields: z.array(campaignFieldSchema).min(1),
  journey: campaignJourneyRuleSchema,
});

export const updateCampaignRequestSchema = createCampaignRequestSchema;

export const campaignSummarySchema = z.object({
  id: z.string().uuid().or(z.string().min(1)),
  name: z.string().min(1),
  status: campaignStatusSchema,
  language: supportedLanguageSchema,
  vertical: verticalSchema,
  template: z.string().min(1),
  workspace: z.string().min(1),
  callerIdentity: z.string().min(1),
  summary: z.string().min(1),
  contactCount: z.number().int().nonnegative(),
  completionRate: z.number().min(0).max(100),
  answerRate: z.number().min(0).max(100),
  confirmationRate: z.number().min(0).max(100),
  createdAt: z.string(),
  launchedAt: z.string().optional(),
  quietHours: z.string().min(1),
  transferQueue: z.string().min(1),
  sensitiveFieldCount: z.number().int().nonnegative(),
  sequence: z.array(z.string().min(1)).min(1),
  fields: z.array(campaignFieldSchema),
});

export const campaignDetailSchema = campaignSummarySchema.extend({
  setup: campaignSetupSchema,
  journey: campaignJourneyRuleSchema,
});

export type CampaignField = z.infer<typeof campaignFieldSchema>;
export type CampaignJourneyRule = z.infer<typeof campaignJourneyRuleSchema>;
export type CampaignSetup = z.infer<typeof campaignSetupSchema>;
export type CreateCampaignRequest = z.infer<typeof createCampaignRequestSchema>;
export type UpdateCampaignRequest = z.infer<typeof updateCampaignRequestSchema>;
export type CampaignSummary = z.infer<typeof campaignSummarySchema>;
export type CampaignDetail = z.infer<typeof campaignDetailSchema>;
