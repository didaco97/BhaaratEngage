import { z } from "zod";

import { contactStatusSchema, supportedLanguageSchema } from "../../domain/enums.js";

export const contactSchema = z.object({
  id: z.string().uuid().or(z.string().min(1)),
  name: z.string().min(1).max(120),
  phone: z.string().min(10).max(20),
  email: z.string().email().optional(),
  language: supportedLanguageSchema,
  status: contactStatusSchema,
  consent: z.boolean(),
  campaignId: z.string().optional(),
  workspace: z.string().min(1),
  source: z.string().min(1),
  lastContactedAt: z.string().optional(),
});

const contactMutableFieldsSchema = contactSchema.pick({
  name: true,
  phone: true,
  email: true,
  language: true,
  consent: true,
  source: true,
});

export const createContactRequestSchema = contactMutableFieldsSchema;
export const updateContactRequestSchema = contactMutableFieldsSchema;

export const contactImportRequestSchema = z.object({
  filename: z.string().min(1).max(255),
  csvText: z.string().min(1),
  source: z.string().min(1).max(120).optional(),
  defaultLanguage: supportedLanguageSchema.optional(),
  defaultConsent: z.boolean().optional().default(true),
});

export const contactImportSummarySchema = z.object({
  jobId: z.string().uuid().or(z.string().min(1)),
  imported: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative(),
  duplicates: z.number().int().nonnegative(),
  invalid: z.number().int().nonnegative(),
});

export type Contact = z.infer<typeof contactSchema>;
export type CreateContactRequest = z.infer<typeof createContactRequestSchema>;
export type UpdateContactRequest = z.infer<typeof updateContactRequestSchema>;
export type ContactImportRequest = z.infer<typeof contactImportRequestSchema>;
export type ContactImportSummary = z.infer<typeof contactImportSummarySchema>;
