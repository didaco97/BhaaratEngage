import { z } from "zod";

import { campaignStatusSchema, callStatusSchema, roleSchema } from "../../domain/enums.js";

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
  id: z.string().uuid().or(z.string().min(1)),
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

export type DashboardOverview = z.infer<typeof dashboardOverviewSchema>;
export type DashboardWorkspace = z.infer<typeof dashboardWorkspaceSchema>;
export type DashboardViewer = z.infer<typeof dashboardViewerSchema>;
export type VoiceThroughputPoint = z.infer<typeof voiceThroughputPointSchema>;
export type LiveCampaignCard = z.infer<typeof liveCampaignCardSchema>;
export type ComplianceAlert = z.infer<typeof complianceAlertSchema>;
export type TransferQueueSummary = z.infer<typeof transferQueueSummarySchema>;
export type AuditEvent = z.infer<typeof auditEventSchema>;
export type DispositionBreakdownItem = z.infer<typeof dispositionBreakdownItemSchema>;
export type RecentAttempt = z.infer<typeof recentAttemptSchema>;
export type DashboardSnapshot = z.infer<typeof dashboardSnapshotSchema>;
