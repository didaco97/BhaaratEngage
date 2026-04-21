import { describe, expect, it, vi } from "vitest";

import type { CampaignDetail } from "../src/modules/campaigns/campaign.schemas.js";
import { createCampaignScheduler } from "../workers/scheduler/campaign-scheduler.js";
import { buildSchedulerWindowPlan } from "../workers/scheduler/scheduler-candidates.js";

function createQueuePublisherStub() {
  return {
    queueName: "queue",
    publish: vi.fn(async (request) => ({
      id: "job-001",
      ...request,
    })),
  };
}

function createCampaign(status: CampaignDetail["status"]): CampaignDetail {
  return {
    id: "campaign-detail-001",
    name: "Scheduler campaign",
    status,
    language: "english",
    vertical: "banking",
    template: "collections",
    workspace: "Workspace",
    callerIdentity: "Bhaarat Engage",
    summary: "Collect dues",
    contactCount: 12,
    completionRate: 0,
    answerRate: 0,
    confirmationRate: 0,
    createdAt: "2026-04-08T00:00:00.000Z",
    quietHours: "09:00 to 18:00 IST",
    transferQueue: "Priority Desk",
    sensitiveFieldCount: 1,
    sequence: ["Voice first"],
    fields: [
      {
        field_key: "consent",
        label: "Consent",
        prompt: "Do you consent?",
        type: "boolean",
        required: true,
        sensitive: false,
        verification_label: "Consent",
        retry_limit: 2,
        validation_rule: "Yes or no",
      },
    ],
    setup: {
      campaignName: "Scheduler campaign",
      vertical: "banking",
      language: "english",
      callerIdentity: "Bhaarat Engage",
      introScript: "Hello from Bhaarat Engage.",
      purposeStatement: "Collect dues.",
      callingWindowStart: "09:00",
      callingWindowEnd: "18:00",
      transferEnabled: true,
      transferQueue: "Priority Desk",
    },
    journey: {
      unansweredAction: "sms",
      partialAction: "retry",
      retryWindowHours: 4,
      maxRetries: 2,
      concurrencyLimit: 5,
      pacingPerMinute: 5,
      csvSource: "seed.csv",
    },
  };
}

describe("campaign scheduler", () => {
  it("auto-pauses active campaigns outside the calling window before queueing work", async () => {
    const dialerQueue = createQueuePublisherStub();
    const journeyQueue = createQueuePublisherStub();
    const scheduler = createCampaignScheduler({
      dialerQueue,
      journeyQueue,
      campaignService: {
        autoPauseForQuietHours: vi.fn(async () => ({
          ...createCampaign("paused"),
          id: "campaign-outside-window-001",
        })),
        autoResumeFromQuietHours: vi.fn(async () => null),
      },
    });
    const plan = buildSchedulerWindowPlan({
      organizationId: "org-001",
      quietHoursAutoPause: true,
      now: new Date("2026-04-09T15:00:00.000Z"),
      campaigns: [
        {
          id: "campaign-outside-window-001",
          name: "Outside window campaign",
          status: "active",
          contactCount: 12,
          callingWindowStart: "09:00",
          callingWindowEnd: "18:00",
          pauseMode: null,
        },
      ],
    });

    const result = await scheduler.runTick({
      triggeredAt: "2026-04-09T15:00:00.000Z",
      dialerCampaigns: plan.dialerCampaigns,
      journeyActions: [],
      campaignTransitions: plan.campaignTransitions,
    });

    expect(result).toEqual({
      dispatchedDialerJobs: 0,
      dispatchedJourneyJobs: 0,
      autoPausedCampaigns: 1,
      autoResumedCampaigns: 0,
    });
    expect(dialerQueue.publish).not.toHaveBeenCalled();
  });

  it("auto-resumes quiet-hours-paused campaigns and enqueues dialer work in the same tick", async () => {
    const dialerQueue = createQueuePublisherStub();
    const journeyQueue = createQueuePublisherStub();
    const autoResumeFromQuietHours = vi.fn(async () => ({
      ...createCampaign("active"),
      id: "campaign-auto-paused-001",
    }));
    const scheduler = createCampaignScheduler({
      dialerQueue,
      journeyQueue,
      campaignService: {
        autoPauseForQuietHours: vi.fn(async () => null),
        autoResumeFromQuietHours,
      },
    });
    const plan = buildSchedulerWindowPlan({
      organizationId: "org-001",
      quietHoursAutoPause: true,
      now: new Date("2026-04-09T04:30:00.000Z"),
      campaigns: [
        {
          id: "campaign-auto-paused-001",
          name: "Auto paused campaign",
          status: "paused",
          contactCount: 12,
          callingWindowStart: "09:00",
          callingWindowEnd: "18:00",
          pauseMode: "quiet_hours",
        },
      ],
    });

    const result = await scheduler.runTick({
      triggeredAt: "2026-04-09T04:30:00.000Z",
      dialerCampaigns: plan.dialerCampaigns,
      journeyActions: [],
      campaignTransitions: plan.campaignTransitions,
    });

    expect(autoResumeFromQuietHours).toHaveBeenCalledWith("campaign-auto-paused-001");
    expect(dialerQueue.publish).toHaveBeenCalledWith({
      name: "dialer-queue",
      payload: {
        organizationId: "org-001",
        campaignId: "campaign-auto-paused-001",
        requestedAt: "2026-04-09T04:30:00.000Z",
        triggeredBy: "scheduler",
        cursor: undefined,
        maxContacts: 12,
        traceId: undefined,
      },
      dedupeKey: "org-001:campaign-auto-paused-001:2026-04-09T04:30:00.000Z",
    });
    expect(result).toEqual({
      dispatchedDialerJobs: 1,
      dispatchedJourneyJobs: 0,
      autoPausedCampaigns: 0,
      autoResumedCampaigns: 1,
    });
  });

  it("does not enqueue dialer work if an auto-resume transition no longer applies", async () => {
    const dialerQueue = createQueuePublisherStub();
    const journeyQueue = createQueuePublisherStub();
    const scheduler = createCampaignScheduler({
      dialerQueue,
      journeyQueue,
      campaignService: {
        autoPauseForQuietHours: vi.fn(async () => null),
        autoResumeFromQuietHours: vi.fn(async () => null),
      },
    });
    const plan = buildSchedulerWindowPlan({
      organizationId: "org-001",
      quietHoursAutoPause: true,
      now: new Date("2026-04-09T04:30:00.000Z"),
      campaigns: [
        {
          id: "campaign-auto-paused-001",
          name: "Auto paused campaign",
          status: "paused",
          contactCount: 12,
          callingWindowStart: "09:00",
          callingWindowEnd: "18:00",
          pauseMode: "quiet_hours",
        },
      ],
    });

    const result = await scheduler.runTick({
      triggeredAt: "2026-04-09T04:30:00.000Z",
      dialerCampaigns: plan.dialerCampaigns,
      journeyActions: [],
      campaignTransitions: plan.campaignTransitions,
    });

    expect(dialerQueue.publish).not.toHaveBeenCalled();
    expect(result.dispatchedDialerJobs).toBe(0);
    expect(result.autoResumedCampaigns).toBe(0);
  });
});
