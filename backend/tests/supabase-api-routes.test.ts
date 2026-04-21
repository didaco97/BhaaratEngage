import { randomUUID } from "node:crypto";

import request from "supertest";
import { describe, expect, it } from "vitest";

import type { CreateCampaignRequest } from "../src/modules/campaigns/campaign.schemas.js";
import type { SupabaseRouteTestContext } from "./supabase-test-harness.js";
import { canRunSupabaseIntegrationTests, withSupabaseRouteTestContext } from "./supabase-test-harness.js";

const describeSupabase = canRunSupabaseIntegrationTests ? describe : describe.skip;

function buildPhoneNumber() {
  const digits = randomUUID().replace(/\D/gu, "");
  return `9${digits.slice(0, 11).padEnd(11, "0")}`;
}

function withAuth(context: SupabaseRouteTestContext, req: request.Test) {
  return req.set("Authorization", context.authorizationHeader);
}

function buildCampaignPayload(name: string): CreateCampaignRequest {
  return {
    setup: {
      campaignName: name,
      vertical: "banking",
      language: "hindi",
      callerIdentity: "Bhaarat Engage",
      introScript: "Namaste, this is Bhaarat Engage calling to verify your details.",
      purposeStatement: "We need to confirm your intent and route you to the right queue if needed.",
      callingWindowStart: "09:00",
      callingWindowEnd: "20:00",
      transferEnabled: true,
      transferQueue: "Verification desk",
    },
    fields: [
      {
        field_key: "intent_status",
        label: "Intent status",
        prompt: "Are you available to continue with verification now?",
        type: "boolean",
        required: true,
        sensitive: false,
        verification_label: "Intent status",
        retry_limit: 2,
        validation_rule: "Yes or no",
      },
    ],
    journey: {
      unansweredAction: "sms",
      partialAction: "retry",
      retryWindowHours: 4,
      maxRetries: 2,
      concurrencyLimit: 10,
      pacingPerMinute: 6,
      csvSource: "Supabase integration upload",
    },
  };
}

async function seedCompletedCall(
  context: SupabaseRouteTestContext,
  options: {
    readonly campaignId: string;
    readonly contactId: string;
  },
) {
  const providerCallId = `plivo-${randomUUID()}`;
  const startedAt = new Date().toISOString();

  return await context.runAsPrincipal(async () => {
    const session = await context.repositories.voice.ensureCallSession({
      campaignId: options.campaignId,
      contactId: options.contactId,
      providerCallId,
      provider: "plivo",
      startedAt,
      transcriptMode: "restricted",
    });

    await context.repositories.voice.appendTranscriptTurn({
      providerCallId,
      speaker: "Bot",
      textRaw: "Are you available to continue with verification now?",
      textRedacted: "Are you available to continue with verification now?",
    });
    await context.repositories.voice.appendTranscriptTurn({
      providerCallId,
      speaker: "User",
      textRaw: "Yes, I can continue.",
      textRedacted: "Yes, I can continue.",
    });
    await context.repositories.voice.upsertCollectedField({
      providerCallId,
      fieldKey: "intent_status",
      label: "Intent status",
      rawValue: "yes",
      maskedValue: "yes",
      sensitive: false,
      confidenceScore: 0.98,
      confirmed: true,
    });

    const callRecord = await context.repositories.voice.updateCallStatus({
      providerCallId,
      status: "completed",
      disposition: "confirmed",
      durationSeconds: 42,
      answeredAt: startedAt,
      endedAt: startedAt,
      confirmed: true,
      fieldsCollected: 1,
      fieldsTotal: session.fieldsTotal,
      transcriptMode: "restricted",
    });

    if (!callRecord) {
      throw new Error("Expected the Supabase voice repository to persist a completed call record.");
    }

    return callRecord;
  });
}

describeSupabase("Supabase-backed API routes", () => {
  it("round-trips core campaign, contact, dashboard, call-record, report, and settings routes against Supabase", async () => {
    await withSupabaseRouteTestContext("core-routes", async (context) => {
      const settingsResponse = await withAuth(context, request(context.app).get("/api/settings"));
      expect(settingsResponse.status).toBe(200);
      expect(settingsResponse.body.data.workspaceSettings.workspaceName).toContain("Supabase Integration");

      const workspaceResponse = await withAuth(context, request(context.app).patch("/api/settings/workspace")).send({
        workspaceName: "Supabase Integration Workspace",
        defaultLanguage: "english",
        callingWindowStart: "08:30",
        callingWindowEnd: "19:30",
        dndChecksEnabled: true,
        quietHoursAutoPause: true,
        restrictFullTranscripts: true,
      });
      expect(workspaceResponse.status).toBe(200);
      expect(workspaceResponse.body.data.workspaceSettings.workspaceName).toBe("Supabase Integration Workspace");

      const createCampaignResponse = await withAuth(context, request(context.app).post("/api/campaigns")).send(
        buildCampaignPayload("supabase-core-campaign"),
      );
      expect(createCampaignResponse.status).toBe(201);
      const campaignId = createCampaignResponse.body.data.id as string;

      const createContactResponse = await withAuth(context, request(context.app).post("/api/contacts")).send({
        name: "Asha Verma",
        phone: buildPhoneNumber(),
        email: "asha.verma@example.invalid",
        language: "hindi",
        consent: true,
        source: "Supabase integration source",
      });
      expect(createContactResponse.status).toBe(201);
      const contactId = createContactResponse.body.data.id as string;

      const assignContactResponse = await withAuth(context, request(context.app).post(`/api/campaigns/${campaignId}/contacts`)).send({
        contactIds: [contactId],
      });
      expect(assignContactResponse.status).toBe(200);
      expect(assignContactResponse.body.data).toHaveLength(1);

      const launchResponse = await withAuth(context, request(context.app).post(`/api/campaigns/${campaignId}/launch`));
      expect(launchResponse.status).toBe(200);
      expect(launchResponse.body.data.status).toBe("active");

      const seededCallRecord = await seedCompletedCall(context, { campaignId, contactId });

      const dashboardResponse = await withAuth(context, request(context.app).get("/api/dashboard"));
      expect(dashboardResponse.status).toBe(200);
      expect(dashboardResponse.body.data.workspace.name).toBe("Supabase Integration Workspace");
      expect(dashboardResponse.body.data.overview.totalCampaigns).toBeGreaterThanOrEqual(1);

      const campaignsResponse = await withAuth(context, request(context.app).get("/api/campaigns").query({ status: "active" }));
      expect(campaignsResponse.status).toBe(200);
      expect(campaignsResponse.body.data.some((campaign: { id: string }) => campaign.id === campaignId)).toBe(true);

      const campaignDetailResponse = await withAuth(context, request(context.app).get(`/api/campaigns/${campaignId}`));
      expect(campaignDetailResponse.status).toBe(200);
      expect(campaignDetailResponse.body.data.setup.transferQueue).toBe("Verification desk");

      const journeyResponse = await withAuth(context, request(context.app).get("/api/journeys"));
      expect(journeyResponse.status).toBe(200);
      expect(journeyResponse.body.data.some((journey: { campaignId: string }) => journey.campaignId === campaignId)).toBe(true);

      const callRecordsResponse = await withAuth(context, request(context.app).get("/api/call-records"));
      expect(callRecordsResponse.status).toBe(200);
      expect(callRecordsResponse.body.data.some((record: { id: string }) => record.id === seededCallRecord.id)).toBe(true);

      const transcriptResponse = await withAuth(context, request(context.app).get(`/api/call-records/${seededCallRecord.id}/transcript`));
      expect(transcriptResponse.status).toBe(200);
      expect(transcriptResponse.body.data).toHaveLength(2);

      const collectedDataResponse = await withAuth(context, request(context.app).get(`/api/call-records/${seededCallRecord.id}/data`));
      expect(collectedDataResponse.status).toBe(200);
      expect(collectedDataResponse.body.data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            fieldKey: "intent_status",
            value: "yes",
            confirmed: true,
          }),
        ]),
      );

      const reportsResponse = await withAuth(context, request(context.app).get("/api/reports"));
      expect(reportsResponse.status).toBe(200);
      expect(reportsResponse.body.data.dailyVolume.length).toBeGreaterThan(0);
      expect(reportsResponse.body.data.providerPerformance.length).toBeGreaterThan(0);

      const searchResponse = await withAuth(context, request(context.app).get("/api/search/global").query({ q: "Asha" }));
      expect(searchResponse.status).toBe(200);
      expect(searchResponse.body.data.contacts.some((contact: { id: string }) => contact.id === contactId)).toBe(true);

      const contactsExportResponse = await withAuth(context, request(context.app).get("/api/contacts/export.csv"));
      expect(contactsExportResponse.status).toBe(200);
      expect(contactsExportResponse.text).toContain("id,name,phone");
      expect(contactsExportResponse.text).toContain("Asha Verma");

      const reportsExportResponse = await withAuth(context, request(context.app).get("/api/reports/export.csv"));
      expect(reportsExportResponse.status).toBe(200);
      expect(reportsExportResponse.text).toContain("section,item,metric,value");
    });
  });

  it("keeps contact import and assignment flows working against Supabase-backed repositories", async () => {
    await withSupabaseRouteTestContext("import-export", async (context) => {
      const importResponse = await withAuth(context, request(context.app).post("/api/contacts/import")).send({
        filename: "supabase-import.csv",
        source: "Supabase import",
        defaultLanguage: "marathi",
        defaultConsent: true,
        csvText: ["name,phone,email", `Meera Joshi,${buildPhoneNumber()},meera.joshi@example.invalid`].join("\n"),
      });

      expect(importResponse.status).toBe(201);
      expect(importResponse.body.data.imported).toBe(1);

      const contactsResponse = await withAuth(context, request(context.app).get("/api/contacts").query({ search: "Meera" }));
      expect(contactsResponse.status).toBe(200);
      expect(contactsResponse.body.meta.total).toBe(1);

      const campaignResponse = await withAuth(context, request(context.app).post("/api/campaigns")).send(
        buildCampaignPayload("supabase-import-campaign"),
      );
      expect(campaignResponse.status).toBe(201);

      const campaignId = campaignResponse.body.data.id as string;
      const contactId = contactsResponse.body.data[0].id as string;
      const assignResponse = await withAuth(context, request(context.app).post(`/api/campaigns/${campaignId}/contacts`)).send({
        contactIds: [contactId],
      });

      expect(assignResponse.status).toBe(200);

      const campaignContactsResponse = await withAuth(context, request(context.app).get(`/api/campaigns/${campaignId}/contacts`));
      expect(campaignContactsResponse.status).toBe(200);
      expect(campaignContactsResponse.body.data).toHaveLength(1);
      expect(campaignContactsResponse.body.data[0].name).toBe("Meera Joshi");
    });
  });

  it("enforces tenant isolation and role checks in the Supabase-backed app", async () => {
    await withSupabaseRouteTestContext(
      "viewer-role",
      async (viewerContext) => {
        const forbiddenResponse = await withAuth(viewerContext, request(viewerContext.app).post("/api/campaigns")).send(
          buildCampaignPayload("viewer-should-fail"),
        );

        expect(forbiddenResponse.status).toBe(403);
      },
      { role: "viewer" },
    );

    await withSupabaseRouteTestContext("tenant-a", async (contextA) => {
      const createCampaignResponse = await withAuth(contextA, request(contextA.app).post("/api/campaigns")).send(
        buildCampaignPayload("tenant-a-campaign"),
      );
      expect(createCampaignResponse.status).toBe(201);
      const campaignId = createCampaignResponse.body.data.id as string;

      await withSupabaseRouteTestContext("tenant-b", async (contextB) => {
        const notFoundResponse = await withAuth(contextB, request(contextB.app).get(`/api/campaigns/${campaignId}`));
        expect(notFoundResponse.status).toBe(404);
      });
    });
  });

  it("returns backend-aligned validation errors for invalid transfer payloads against Supabase-backed repositories", async () => {
    await withSupabaseRouteTestContext("validation", async (context) => {
      const response = await withAuth(context, request(context.app).post("/api/campaigns")).send({
        ...buildCampaignPayload("invalid-transfer"),
        setup: {
          ...buildCampaignPayload("invalid-transfer").setup,
          transferQueue: "   ",
        },
      });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("validation_error");
      expect(response.body.error.issues.fieldErrors.setup).toEqual(
        expect.arrayContaining(["Transfer queue is required when transfer is enabled."]),
      );
    });
  });
});
