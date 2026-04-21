import { describe, expect, it } from "vitest";

import type { CampaignSummary } from "../src/modules/campaigns/campaign.schemas.js";
import type { SchedulerCampaign } from "../src/repositories/backend-repositories.js";
import { buildSchedulerWindowPlan, mapSchedulerDialerCandidates } from "../workers/scheduler/scheduler-candidates.js";

const activeCampaign: CampaignSummary = {
  id: "campaign-active-001",
  name: "Active KYC Campaign",
  status: "active",
  language: "hindi",
  vertical: "insurance",
  template: "Renewal Assist",
  workspace: "Bhaarat Engage",
  callerIdentity: "Bhaarat Engage",
  summary: "Collect renewal details",
  contactCount: 14,
  completionRate: 0,
  answerRate: 0,
  confirmationRate: 0,
  createdAt: "2026-04-09T10:00:00.000Z",
  quietHours: "09:00 to 21:00 IST",
  transferQueue: "No transfer queue",
  sensitiveFieldCount: 1,
  sequence: ["Voice first"],
  fields: [],
};

const pausedCampaign: CampaignSummary = {
  ...activeCampaign,
  id: "campaign-paused-001",
  status: "paused",
};

const activeSchedulerCampaign: SchedulerCampaign = {
  id: "campaign-active-window-001",
  name: "Active window campaign",
  status: "active",
  contactCount: 12,
  callingWindowStart: "09:00",
  callingWindowEnd: "18:00",
  pauseMode: null,
};

describe("scheduler dialer candidates", () => {
  it("maps only active campaigns that still have contacts to process", () => {
    const candidates = mapSchedulerDialerCandidates({
      organizationId: "org-001",
      campaigns: [
        activeCampaign,
        pausedCampaign,
        {
          ...activeCampaign,
          id: "campaign-empty-001",
          contactCount: 0,
        },
      ],
    });

    expect(candidates).toEqual([
      {
        organizationId: "org-001",
        campaignId: "campaign-active-001",
        maxContacts: 14,
      },
    ]);
  });

  it("plans quiet-hours auto-pauses for active campaigns outside the calling window", () => {
    const plan = buildSchedulerWindowPlan({
      organizationId: "org-001",
      quietHoursAutoPause: true,
      now: new Date("2026-04-09T15:00:00.000Z"),
      campaigns: [
        {
          ...activeSchedulerCampaign,
          id: "campaign-outside-window-001",
        },
      ],
    });

    expect(plan.dialerCampaigns).toEqual([]);
    expect(plan.campaignTransitions).toEqual([
      {
        organizationId: "org-001",
        campaignId: "campaign-outside-window-001",
        campaignName: "Active window campaign",
        action: "auto_pause",
        callingWindowStart: "09:00",
        callingWindowEnd: "18:00",
      },
    ]);
  });

  it("resumes only quiet-hours-paused campaigns when the calling window opens", () => {
    const plan = buildSchedulerWindowPlan({
      organizationId: "org-001",
      quietHoursAutoPause: true,
      now: new Date("2026-04-09T04:30:00.000Z"),
      campaigns: [
        {
          ...activeSchedulerCampaign,
          id: "campaign-auto-paused-001",
          status: "paused",
          pauseMode: "quiet_hours",
        },
        {
          ...activeSchedulerCampaign,
          id: "campaign-manual-paused-001",
          status: "paused",
          pauseMode: "manual",
        },
      ],
    });

    expect(plan.campaignTransitions).toEqual([
      {
        organizationId: "org-001",
        campaignId: "campaign-auto-paused-001",
        campaignName: "Active window campaign",
        action: "auto_resume",
        callingWindowStart: "09:00",
        callingWindowEnd: "18:00",
      },
    ]);
    expect(plan.dialerCampaigns).toEqual([
      {
        organizationId: "org-001",
        campaignId: "campaign-auto-paused-001",
        maxContacts: 12,
      },
    ]);
  });
});
