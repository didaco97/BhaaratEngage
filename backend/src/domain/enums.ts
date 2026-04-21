import { z } from "zod";

export const supportedLanguageValues = [
  "hindi",
  "english",
  "tamil",
  "telugu",
  "kannada",
  "bengali",
  "marathi",
  "gujarati",
  "urdu",
] as const;

export const verticalValues = ["banking", "insurance", "lending", "healthcare", "telecom"] as const;
export const roleValues = ["workspace_admin", "campaign_manager", "reviewer", "operator", "viewer"] as const;
export const campaignStatusValues = ["draft", "active", "paused", "completed"] as const;
export const fieldTypeValues = ["text", "number", "date", "boolean", "select"] as const;
export const journeyActionValues = ["sms", "whatsapp", "retry", "none"] as const;
export const contactStatusValues = ["eligible", "opted_out", "suppressed", "dnd"] as const;
export const callStatusValues = ["in_progress", "completed", "no_answer", "busy", "failed", "transferred"] as const;
export const transcriptModeValues = ["redacted", "restricted", "none"] as const;
export const journeyStatusValues = ["active", "paused", "completed"] as const;

export const supportedLanguageSchema = z.enum(supportedLanguageValues);
export const verticalSchema = z.enum(verticalValues);
export const roleSchema = z.enum(roleValues);
export const campaignStatusSchema = z.enum(campaignStatusValues);
export const fieldTypeSchema = z.enum(fieldTypeValues);
export const journeyActionSchema = z.enum(journeyActionValues);
export const contactStatusSchema = z.enum(contactStatusValues);
export const callStatusSchema = z.enum(callStatusValues);
export const transcriptModeSchema = z.enum(transcriptModeValues);
export const journeyStatusSchema = z.enum(journeyStatusValues);

export type SupportedLanguage = z.infer<typeof supportedLanguageSchema>;
export type Vertical = z.infer<typeof verticalSchema>;
export type Role = z.infer<typeof roleSchema>;
export type CampaignStatus = z.infer<typeof campaignStatusSchema>;
export type FieldType = z.infer<typeof fieldTypeSchema>;
export type JourneyAction = z.infer<typeof journeyActionSchema>;
export type ContactStatus = z.infer<typeof contactStatusSchema>;
export type CallStatus = z.infer<typeof callStatusSchema>;
export type TranscriptMode = z.infer<typeof transcriptModeSchema>;
export type JourneyStatus = z.infer<typeof journeyStatusSchema>;
