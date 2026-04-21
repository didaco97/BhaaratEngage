export type JourneyAction = "sms" | "whatsapp" | "retry" | "none";
export type JourneyOutcome = "unanswered" | "partial";

export interface JourneyDispatchJobData {
  readonly organizationId: string;
  readonly campaignId: string;
  readonly contactId: string;
  readonly requestedAt: string;
  readonly action: JourneyAction;
  readonly outcome: JourneyOutcome;
  readonly callRecordId?: string;
  readonly retryWindowHours?: number;
  readonly traceId?: string;
}

export interface JourneyWorkerResult {
  readonly outcome: "queued_followup" | "scheduled_retry" | "skipped";
  readonly nextAttemptAt?: string;
  readonly notes: readonly string[];
}
