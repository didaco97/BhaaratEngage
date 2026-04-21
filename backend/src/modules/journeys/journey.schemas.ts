import { z } from "zod";

import { journeyStatusSchema } from "../../domain/enums.js";

export const journeyMonitorSchema = z.object({
  id: z.string().uuid().or(z.string().min(1)),
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

export type JourneyMonitor = z.infer<typeof journeyMonitorSchema>;
