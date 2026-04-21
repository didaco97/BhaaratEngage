import { z } from "zod";

import {
  dashboardOverviewSchema,
  dispositionBreakdownItemSchema,
  voiceThroughputPointSchema,
} from "../dashboard/dashboard.schemas.js";

export const dailyVolumePointSchema = z.object({
  date: z.string().min(1),
  calls: z.number().int().nonnegative(),
  answered: z.number().int().nonnegative(),
  completed: z.number().int().nonnegative(),
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

export type DailyVolumePoint = z.infer<typeof dailyVolumePointSchema>;
export type FieldDropoff = z.infer<typeof fieldDropoffSchema>;
export type ProviderPerformance = z.infer<typeof providerPerformanceSchema>;
export type ReportsSnapshot = z.infer<typeof reportsSnapshotSchema>;
