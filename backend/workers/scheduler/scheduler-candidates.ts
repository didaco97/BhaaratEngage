import { AppError } from "../../src/lib/http-errors.js";
import type { SettingsSnapshot } from "../../src/modules/settings/settings.schemas.js";
import type { BackendRepositories, SchedulerCampaign } from "../../src/repositories/backend-repositories.js";
import { isWithinDialerCallingWindow } from "../dialer/dialer-helpers.js";
import type { SchedulerDialerCandidate } from "./campaign-scheduler.js";

export interface SchedulerCampaignWindowTransition {
  readonly organizationId: string;
  readonly campaignId: string;
  readonly campaignName: string;
  readonly action: "auto_pause" | "auto_resume";
  readonly callingWindowStart: string;
  readonly callingWindowEnd: string;
}

export interface SchedulerWindowPlan {
  readonly organizationId: string;
  readonly dialerCampaigns: readonly SchedulerDialerCandidate[];
  readonly campaignTransitions: readonly SchedulerCampaignWindowTransition[];
}

function resolveSchedulerWorkspaceId(settings: SettingsSnapshot) {
  const workspace =
    settings.workspaces.find((entry) => entry.name === settings.workspaceSettings.workspaceName) ?? settings.workspaces[0];

  if (!workspace) {
    throw new AppError(503, "worker_workspace_missing", "A workspace must exist before campaign jobs can be scheduled.");
  }

  return workspace.id;
}

export function mapSchedulerDialerCandidates<TCampaign extends Pick<SchedulerCampaign, "id" | "status" | "contactCount">>(input: {
  readonly organizationId: string;
  readonly campaigns: readonly TCampaign[];
}): SchedulerDialerCandidate[] {
  return input.campaigns
    .filter((campaign) => campaign.status === "active" && campaign.contactCount > 0)
    .map((campaign) => ({
      organizationId: input.organizationId,
      campaignId: campaign.id,
      maxContacts: campaign.contactCount,
    }));
}

export function buildSchedulerWindowPlan(input: {
  readonly organizationId: string;
  readonly campaigns: readonly SchedulerCampaign[];
  readonly quietHoursAutoPause: boolean;
  readonly now: Date;
}): SchedulerWindowPlan {
  const campaignTransitions: SchedulerCampaignWindowTransition[] = [];
  const dialerEligibleCampaigns: SchedulerCampaign[] = [];

  for (const campaign of input.campaigns) {
    const withinCallingWindow = isWithinDialerCallingWindow(
      input.now,
      campaign.callingWindowStart,
      campaign.callingWindowEnd,
    );

    if (campaign.status === "active") {
      if (!withinCallingWindow) {
        if (input.quietHoursAutoPause) {
          campaignTransitions.push({
            organizationId: input.organizationId,
            campaignId: campaign.id,
            campaignName: campaign.name,
            action: "auto_pause",
            callingWindowStart: campaign.callingWindowStart,
            callingWindowEnd: campaign.callingWindowEnd,
          });
        }

        continue;
      }

      dialerEligibleCampaigns.push(campaign);
      continue;
    }

    if (campaign.status === "paused" && campaign.pauseMode === "quiet_hours" && withinCallingWindow) {
      campaignTransitions.push({
        organizationId: input.organizationId,
        campaignId: campaign.id,
        campaignName: campaign.name,
        action: "auto_resume",
        callingWindowStart: campaign.callingWindowStart,
        callingWindowEnd: campaign.callingWindowEnd,
      });
      dialerEligibleCampaigns.push({
        ...campaign,
        status: "active",
      });
    }
  }

  return {
    organizationId: input.organizationId,
    dialerCampaigns: mapSchedulerDialerCandidates({
      organizationId: input.organizationId,
      campaigns: dialerEligibleCampaigns,
    }),
    campaignTransitions,
  };
}

export async function loadSchedulerWindowPlan(
  repositories: Pick<BackendRepositories, "campaigns" | "settings">,
  now = new Date(),
): Promise<SchedulerWindowPlan> {
  const [campaigns, settings] = await Promise.all([
    repositories.campaigns.listSchedulerCampaigns(),
    repositories.settings.getSnapshot(),
  ]);

  return buildSchedulerWindowPlan({
    organizationId: resolveSchedulerWorkspaceId(settings),
    campaigns,
    quietHoursAutoPause: settings.workspaceSettings.quietHoursAutoPause,
    now,
  });
}
