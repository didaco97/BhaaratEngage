import { z } from "zod";

import { roleSchema, supportedLanguageSchema } from "../../domain/enums.js";

const timeValueSchema = z.string().regex(/^\d{2}:\d{2}$/u, "Expected time in HH:MM format.");

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
  id: z.string().uuid().or(z.string().min(1)),
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
  id: z.string().uuid().or(z.string().min(1)),
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
  id: z.string().uuid().or(z.string().min(1)),
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

export type WorkspaceSettings = z.infer<typeof workspaceSettingsSchema>;
export type TeamMember = z.infer<typeof teamMemberSchema>;
export type InviteTeamMemberRequest = z.infer<typeof inviteTeamMemberRequestSchema>;
export type NotificationPreference = z.infer<typeof notificationPreferenceSchema>;
export type NotificationPreferenceUpdate = z.infer<typeof notificationPreferenceUpdateSchema>;
export type WebhookConfig = z.infer<typeof webhookConfigSchema>;
export type WorkspaceInventory = z.infer<typeof workspaceInventorySchema>;
export type SecurityControl = z.infer<typeof securityControlSchema>;
export type ApiAccessConfig = z.infer<typeof apiAccessConfigSchema>;
export type ApiKeySummary = z.infer<typeof apiKeySummarySchema>;
export type CreateApiKeyRequest = z.infer<typeof createApiKeyRequestSchema>;
export type CreatedApiKey = z.infer<typeof createdApiKeySchema>;
export type SettingsSnapshot = z.infer<typeof settingsSnapshotSchema>;
