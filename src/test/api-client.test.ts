import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resetApiAccessTokenResolver, setApiAccessTokenResolver } from "@/lib/api-auth";
import { api } from "@/lib/api-client";
import type { CreateCampaignRequest, WorkspaceSettings } from "@/lib/api-contracts";
import { mockApiFetch } from "@/test/mock-api";

function buildCampaignPayload(overrides?: Partial<CreateCampaignRequest["setup"]>): CreateCampaignRequest {
  return {
    setup: {
      campaignName: "Collections Recovery - Pune",
      vertical: "banking",
      language: "marathi",
      callerIdentity: "Bharat Bank",
      introScript: "Namaskar, this is Bharat Bank calling regarding your account review.",
      purposeStatement: "We are calling to confirm repayment intent and route eligible accounts to the right queue.",
      callingWindowStart: "10:00",
      callingWindowEnd: "20:00",
      transferEnabled: true,
      transferQueue: "Pune recovery desk",
      ...overrides,
    },
    fields: [
      {
        field_key: "intent_status",
        label: "Repayment intent",
        prompt: "Will you be able to complete repayment this week?",
        type: "boolean",
        required: true,
        sensitive: false,
        verification_label: "Repayment intent",
        retry_limit: 2,
        validation_rule: "Yes or no",
      },
      {
        field_key: "promise_date",
        label: "Promise date",
        prompt: "Please share the expected repayment date.",
        type: "date",
        required: true,
        sensitive: false,
        verification_label: "Promise date",
        retry_limit: 2,
        validation_rule: "Valid future date",
      },
    ],
    journey: {
      unansweredAction: "sms",
      partialAction: "retry",
      retryWindowHours: 6,
      maxRetries: 3,
      concurrencyLimit: 40,
      pacingPerMinute: 18,
      csvSource: "April recovery upload",
    },
  };
}

describe("api client integration", () => {
  beforeEach(() => {
    resetApiAccessTokenResolver();
  });

  afterEach(() => {
    resetApiAccessTokenResolver();
  });

  it("supports the new campaign edit and journey detail flows through the mocked backend", async () => {
    const createdCampaign = await api.createCampaign(buildCampaignPayload());
    expect(createdCampaign.status).toBe("draft");
    expect(createdCampaign.sequence).toEqual(["Voice first", "SMS if unanswered", "Retry voice if partial"]);
    expect(createdCampaign.setup.introScript).toContain("Bharat Bank");
    expect(createdCampaign.journey.csvSource).toBe("April recovery upload");

    const updatedCampaign = await api.updateCampaign(
      createdCampaign.id,
      buildCampaignPayload({
        campaignName: "Collections Recovery - Nashik",
        language: "hindi",
        transferQueue: "Nashik review desk",
      }),
    );

    expect(updatedCampaign.name).toBe("Collections Recovery - Nashik");
    expect(updatedCampaign.language).toBe("hindi");
    expect(updatedCampaign.transferQueue).toBe("Nashik review desk");
    expect(updatedCampaign.setup.campaignName).toBe("Collections Recovery - Nashik");
    expect(updatedCampaign.setup.transferQueue).toBe("Nashik review desk");
    expect(updatedCampaign.journey.retryWindowHours).toBe(6);
    expect(updatedCampaign.journey.partialAction).toBe("retry");

    const loadedCampaign = await api.getCampaign(createdCampaign.id);
    expect(loadedCampaign.setup.campaignName).toBe("Collections Recovery - Nashik");
    expect(loadedCampaign.setup.introScript).toContain("Bharat Bank");
    expect(loadedCampaign.journey.csvSource).toBe("April recovery upload");
    expect(loadedCampaign.fields[0]?.field_key).toBe("intent_status");

    const launchedCampaign = await api.launchCampaign(createdCampaign.id);
    expect(launchedCampaign.status).toBe("active");
    expect(launchedCampaign.launchedAt).toBeTruthy();
    expect(launchedCampaign.setup.campaignName).toBe("Collections Recovery - Nashik");

    const journeys = await api.listJourneys();
    const campaignJourney = journeys.find((journey) => journey.campaignId === createdCampaign.id);

    expect(campaignJourney).toBeDefined();

    if (!campaignJourney) {
      throw new Error("Expected a journey to be created when the campaign launched.");
    }

    const loadedJourney = await api.getJourney(campaignJourney.id);
    expect(loadedJourney.campaignName).toBe("Collections Recovery - Nashik");
    expect(loadedJourney.status).toBe("active");
    expect(loadedJourney.retryWindowHours).toBe(6);
  });

  it("rejects transfer-enabled campaigns without a queue before the request leaves the client", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockClear();

    await expect(api.createCampaign(buildCampaignPayload({ transferQueue: "   " }))).rejects.toThrowError(
      /Transfer queue is required when transfer is enabled\./u,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps the mocked campaign route aligned with backend transfer-queue validation", async () => {
    const response = await mockApiFetch("/api/campaigns", {
      method: "POST",
      body: JSON.stringify(buildCampaignPayload({ transferQueue: "   " })),
      headers: {
        "Content-Type": "application/json",
      },
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "validation_error",
        message: "The request payload did not match the expected schema.",
        issues: {
          fieldErrors: {
            setup: expect.arrayContaining(["Transfer queue is required when transfer is enabled."]),
          },
        },
      },
    });
  });

  it("keeps settings, team membership, and api keys aligned with the backend contract", async () => {
    const nextWorkspaceSettings: WorkspaceSettings = {
      workspaceName: "Bharat Operations",
      defaultLanguage: "english",
      callingWindowStart: "08:30",
      callingWindowEnd: "19:30",
      dndChecksEnabled: true,
      quietHoursAutoPause: false,
      restrictFullTranscripts: true,
    };

    const updatedSettings = await api.updateWorkspaceSettings(nextWorkspaceSettings);
    expect(updatedSettings.workspaceSettings.workspaceName).toBe("Bharat Operations");
    expect(updatedSettings.workspaces[0]?.name).toBe("Bharat Operations");

    const invitedSnapshot = await api.inviteTeamMember({
      name: "Rohan Sharma",
      email: "rohan@example.com",
      role: "operator",
    });
    const invitedMember = invitedSnapshot.teamMembers.find((member) => member.email === "rohan@example.com");

    expect(invitedMember).toBeDefined();

    if (!invitedMember) {
      throw new Error("Expected the invited team member to be present in the settings snapshot.");
    }

    const roleUpdatedSnapshot = await api.updateTeamMemberRole(invitedMember.id, "reviewer");
    expect(roleUpdatedSnapshot.teamMembers.find((member) => member.id === invitedMember.id)?.role).toBe("reviewer");

    const createdApiKey = await api.createApiKey({ name: "Regression suite key" });
    expect(createdApiKey.rawKey).toContain("bv_live_mock_");

    const apiKeysAfterCreate = await api.listApiKeys();
    expect(apiKeysAfterCreate.some((apiKey) => apiKey.id === createdApiKey.id)).toBe(true);

    await api.deleteApiKey(createdApiKey.id);

    const apiKeysAfterDelete = await api.listApiKeys();
    expect(apiKeysAfterDelete.some((apiKey) => apiKey.id === createdApiKey.id)).toBe(false);

    const removedSnapshot = await api.removeTeamMember(invitedMember.id);
    expect(removedSnapshot.teamMembers.some((member) => member.id === invitedMember.id)).toBe(false);
  });

  it("preserves the last workspace admin guard through the client layer", async () => {
    await expect(api.updateTeamMemberRole("user-001", "viewer")).rejects.toMatchObject({
      status: 409,
      code: "last_workspace_admin",
    });

    await expect(api.removeTeamMember("user-001")).rejects.toMatchObject({
      status: 409,
      code: "last_workspace_admin",
    });
  });

  it("forwards bearer auth headers and parses viewer-safe dashboard metadata", async () => {
    setApiAccessTokenResolver(async () => "session-token");
    const fetchMock = vi.mocked(fetch);

    fetchMock.mockImplementationOnce((input, init) => {
      const headers = new Headers(init?.headers);
      expect(headers.get("Authorization")).toBe("Bearer session-token");
      return mockApiFetch(input, init);
    });

    const dashboard = await api.getDashboardSnapshot();
    expect(dashboard.workspace.name).toBe("HDFC Collections");
    expect(dashboard.viewer.role).toBe("workspace_admin");
  });
});
