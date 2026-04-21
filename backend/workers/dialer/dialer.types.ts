import type { CampaignContactDispatchState } from "../../src/repositories/backend-repositories.js";

export interface DialerDispatchJobData {
  readonly organizationId: string;
  readonly campaignId: string;
  readonly requestedAt: string;
  readonly triggeredBy: "scheduler" | "manual" | "retry";
  readonly cursor?: string;
  readonly maxContacts?: number;
  readonly traceId?: string;
}

export interface DialerCapacitySnapshot {
  readonly activeCalls: number;
  readonly concurrencyLimit: number;
  readonly pacingPerMinute: number;
}

export interface DialerWorkerResult {
  readonly outcome: "scheduled_contacts" | "idle";
  readonly reservedContacts: number;
  readonly dispatchedContacts?: number;
  readonly eligibleContacts?: number;
  readonly skippedContacts?: number;
  readonly nextCursor?: string;
  readonly notes: readonly string[];
}

export interface DialerEligibilityResult {
  readonly eligible: boolean;
  readonly reason?:
    | "dispatch_in_progress"
    | "dispatch_state"
    | "contact_status"
    | "contact_consent"
    | "retry_window"
    | "outside_calling_window";
}

export interface DialerPolicyContactInput {
  readonly dispatchStatus: CampaignContactDispatchState;
  readonly contactStatus: string;
  readonly consent: boolean;
  readonly lastContactedAt?: string;
}
