import { z } from "zod";

export const supportedLanguageSchema = z.enum([
  "hindi",
  "english",
  "tamil",
  "telugu",
  "kannada",
  "bengali",
  "marathi",
  "gujarati",
  "urdu",
]);

export const verticalSchema = z.enum(["banking", "insurance", "lending", "healthcare", "telecom"]);
export const roleSchema = z.enum(["workspace_admin", "campaign_manager", "reviewer", "operator", "viewer"]);
export const campaignStatusSchema = z.enum(["draft", "active", "paused", "completed"]);
export const fieldTypeSchema = z.enum(["text", "number", "date", "boolean", "select"]);
export const journeyActionSchema = z.enum(["sms", "whatsapp", "retry", "none"]);
export const contactStatusSchema = z.enum(["eligible", "opted_out", "suppressed", "dnd"]);
export const callStatusSchema = z.enum(["in_progress", "completed", "no_answer", "busy", "failed", "transferred"]);
export const transcriptModeSchema = z.enum(["redacted", "restricted", "none"]);
export const journeyStatusSchema = z.enum(["active", "paused", "completed"]);

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
  retryWindowHours: z.number().int().min(0).max(168),
  maxRetries: z.number().int().min(0).max(10),
  concurrencyLimit: z.number().int().min(1).max(500),
  pacingPerMinute: z.number().int().min(1).max(500),
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

export const campaignSchema = z.object({
  id: z.string().min(1),
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

export const campaignDetailSchema = campaignSchema.extend({
  setup: campaignSetupSchema,
  journey: campaignJourneyRuleSchema,
});

export const contactSchema = z.object({
  id: z.string().min(1),
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
  jobId: z.string().min(1),
  imported: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative(),
  duplicates: z.number().int().nonnegative(),
  invalid: z.number().int().nonnegative(),
});

export const callRecordSchema = z.object({
  id: z.string().min(1),
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

export const dashboardOverviewSchema = z.object({
  totalCalls: z.number().int().nonnegative(),
  activeCampaigns: z.number().int().nonnegative(),
  totalCampaigns: z.number().int().nonnegative(),
  totalContacts: z.number().int().nonnegative(),
  avgHandlingTime: z.number().int().nonnegative(),
  avgAnswerRate: z.number().min(0).max(100),
  avgCompletionRate: z.number().min(0).max(100),
  avgConfirmationRate: z.number().min(0).max(100),
  optOutRate: z.number().min(0).max(100),
  transferRate: z.number().min(0).max(100),
  auditEventsToday: z.number().int().nonnegative(),
  maskedExportsToday: z.number().int().nonnegative(),
});

export const dashboardWorkspaceSchema = z.object({
  name: z.string().min(1),
});

export const dashboardViewerSchema = z.object({
  userId: z.string().min(1),
  fullName: z.string().min(1),
  email: z.string().email(),
  role: roleSchema,
});

export const voiceThroughputPointSchema = z.object({
  date: z.string().min(1),
  calls: z.number().int().nonnegative(),
  answered: z.number().int().nonnegative(),
  completed: z.number().int().nonnegative(),
});

export const liveCampaignCardSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  status: campaignStatusSchema,
  summary: z.string().min(1),
  answerRate: z.number().min(0).max(100),
  completionRate: z.number().min(0).max(100),
  confirmationRate: z.number().min(0).max(100),
});

export const complianceAlertSchema = z.object({
  title: z.string().min(1),
  detail: z.string().min(1),
  severity: z.enum(["warning", "risk", "info"]),
});

export const transferQueueSummarySchema = z.object({
  queue: z.string().min(1),
  waiting: z.number().int().nonnegative(),
  sla: z.string().min(1),
});

export const auditEventSchema = z.object({
  id: z.string().min(1),
  actor: z.string().min(1),
  action: z.string().min(1),
  entity: z.string().min(1),
  time: z.string().min(1),
});

export const dispositionBreakdownItemSchema = z.object({
  name: z.string().min(1),
  value: z.number().min(0).max(100),
  fill: z.string().min(1),
});

export const recentAttemptSchema = z.object({
  id: z.string().min(1),
  contactName: z.string().min(1),
  phone: z.string().min(10),
  campaignName: z.string().min(1),
  provider: z.string().min(1),
  status: callStatusSchema,
  durationSeconds: z.number().int().nonnegative(),
});

export const dashboardSnapshotSchema = z.object({
  workspace: dashboardWorkspaceSchema,
  viewer: dashboardViewerSchema,
  overview: dashboardOverviewSchema,
  voiceThroughput: z.array(voiceThroughputPointSchema).min(1),
  liveCampaigns: z.array(liveCampaignCardSchema),
  complianceAlerts: z.array(complianceAlertSchema),
  transferQueues: z.array(transferQueueSummarySchema),
  auditEvents: z.array(auditEventSchema),
  dispositionBreakdown: z.array(dispositionBreakdownItemSchema),
  recentAttempts: z.array(recentAttemptSchema),
});

export const journeySchema = z.object({
  id: z.string().min(1),
  campaignId: z.string().min(1),
  campaignName: z.string().min(1),
  sequence: z.array(z.string().min(1)).min(1),
  status: journeyStatusSchema,
  totalContacts: z.number().int().nonnegative(),
  processed: z.number().int().nonnegative(),
  successRate: z.number().min(0).max(100),
  retryWindowHours: z.number().int().nonnegative(),
  concurrencyLimit: z.number().int().positive(),
  pacingPerMinute: z.number().int().positive(),
  nextCheckpoint: z.string().min(1),
});

export const fieldDropoffSchema = z.object({
  field: z.string().min(1),
  captured: z.number().min(0).max(100),
  dropped: z.number().min(0).max(100),
});

export const providerPerformanceSchema = z.object({
  date: z.string().min(1),
  plivo: z.number().min(0).max(100),
  exotel: z.number().min(0).max(100).optional(),
});

export const reportsSnapshotSchema = z.object({
  overview: dashboardOverviewSchema,
  dailyVolume: z.array(voiceThroughputPointSchema).min(1),
  fieldDropoff: z.array(fieldDropoffSchema).min(1),
  providerPerformance: z.array(providerPerformanceSchema).min(1),
  dispositionBreakdown: z.array(dispositionBreakdownItemSchema).min(1),
});

export const workspaceSettingsSchema = z.object({
  workspaceName: z.string().min(1).max(120),
  defaultLanguage: supportedLanguageSchema,
  callingWindowStart: timeValueSchema,
  callingWindowEnd: timeValueSchema,
  dndChecksEnabled: z.boolean(),
  quietHoursAutoPause: z.boolean(),
  restrictFullTranscripts: z.boolean(),
});

export const teamMemberSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  email: z.string().email(),
  role: roleSchema,
});

export const inviteTeamMemberRequestSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email(),
  role: roleSchema,
});

export const updateTeamMemberRoleRequestSchema = z.object({
  role: roleSchema,
});

export const notificationPreferenceSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  detail: z.string().min(1),
  enabled: z.boolean(),
});

export const notificationPreferenceUpdateSchema = notificationPreferenceSchema.pick({
  key: true,
  enabled: true,
});

export const updateNotificationPreferencesRequestSchema = z.object({
  preferences: z.array(notificationPreferenceUpdateSchema).min(1),
});

export const webhookConfigSchema = z.object({
  url: z.string().url(),
  events: z.array(z.string().min(1)).min(1),
});

export const workspaceInventorySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  plan: z.string().min(1),
  members: z.number().int().nonnegative(),
  campaigns: z.number().int().nonnegative(),
});

export const securityControlSchema = z.object({
  title: z.string().min(1),
  body: z.string().min(1),
  badge: z.string().min(1),
});

export const apiAccessConfigSchema = z.object({
  maskedKey: z.string().min(1),
  webhook: webhookConfigSchema,
});

export const apiKeySummarySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  maskedKey: z.string().min(1),
  createdAt: z.string(),
  lastUsedAt: z.string().optional(),
});

export const createApiKeyRequestSchema = z.object({
  name: z.string().min(1).max(120),
});

export const createdApiKeySchema = apiKeySummarySchema.extend({
  rawKey: z.string().min(1),
});

export const settingsSnapshotSchema = z.object({
  workspaceSettings: workspaceSettingsSchema,
  workspaces: z.array(workspaceInventorySchema),
  teamMembers: z.array(teamMemberSchema),
  securityControls: z.array(securityControlSchema),
  notificationPreferences: z.array(notificationPreferenceSchema),
  apiAccess: apiAccessConfigSchema,
  apiKeys: z.array(apiKeySummarySchema),
});

export const apiListMetaSchema = z.object({
  total: z.number().int().nonnegative(),
});

export const apiErrorBodySchema = z.object({
  error: z.object({
    code: z.string().min(1),
    message: z.string().min(1),
  }),
});

export function createApiEnvelopeSchema<TSchema extends z.ZodTypeAny>(dataSchema: TSchema) {
  return z.object({
    data: dataSchema,
    meta: apiListMetaSchema.optional(),
  });
}

export type CampaignField = z.infer<typeof campaignFieldSchema>;
export type CampaignJourneyRule = z.infer<typeof campaignJourneyRuleSchema>;
export type CampaignSetup = z.infer<typeof campaignSetupSchema>;
export type CreateCampaignRequest = z.infer<typeof createCampaignRequestSchema>;
export type UpdateCampaignRequest = z.infer<typeof updateCampaignRequestSchema>;
export type CampaignSummary = z.infer<typeof campaignSchema>;
export type Campaign = z.infer<typeof campaignDetailSchema>;
export type Contact = z.infer<typeof contactSchema>;
export type CreateContactRequest = z.infer<typeof createContactRequestSchema>;
export type UpdateContactRequest = z.infer<typeof updateContactRequestSchema>;
export type ContactImportRequest = z.infer<typeof contactImportRequestSchema>;
export type ContactImportSummary = z.infer<typeof contactImportSummarySchema>;
export type CallRecord = z.infer<typeof callRecordSchema>;
export type TranscriptTurn = z.infer<typeof transcriptTurnSchema>;
export type CollectedField = z.infer<typeof collectedFieldSchema>;
export type DashboardSnapshot = z.infer<typeof dashboardSnapshotSchema>;
export type DashboardWorkspace = z.infer<typeof dashboardWorkspaceSchema>;
export type DashboardViewer = z.infer<typeof dashboardViewerSchema>;
export type Journey = z.infer<typeof journeySchema>;
export type ReportsSnapshot = z.infer<typeof reportsSnapshotSchema>;
export type SettingsSnapshot = z.infer<typeof settingsSnapshotSchema>;
export type WorkspaceSettings = z.infer<typeof workspaceSettingsSchema>;
export type InviteTeamMemberRequest = z.infer<typeof inviteTeamMemberRequestSchema>;
export type NotificationPreference = z.infer<typeof notificationPreferenceSchema>;
export type NotificationPreferenceUpdate = z.infer<typeof notificationPreferenceUpdateSchema>;
export type WebhookConfig = z.infer<typeof webhookConfigSchema>;
export type ApiKeySummary = z.infer<typeof apiKeySummarySchema>;
export type CreateApiKeyRequest = z.infer<typeof createApiKeyRequestSchema>;
export type CreatedApiKey = z.infer<typeof createdApiKeySchema>;
export type CampaignStatus = z.infer<typeof campaignStatusSchema>;
export type ContactStatus = z.infer<typeof contactStatusSchema>;
export type CallStatus = z.infer<typeof callStatusSchema>;
export type FieldType = z.infer<typeof fieldTypeSchema>;
export type Role = z.infer<typeof roleSchema>;
