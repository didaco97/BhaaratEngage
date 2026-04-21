import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createApp } from "../src/app.js";

describe("api routes", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("returns a dashboard snapshot aligned with the current frontend surfaces", async () => {
    const response = await request(createApp()).get("/api/dashboard");

    expect(response.status).toBe(200);
    expect(response.body.data.workspace.name).toBe("HDFC Collections");
    expect(response.body.data.viewer.role).toBe("workspace_admin");
    expect(response.body.data.overview.totalCampaigns).toBe(5);
    expect(response.body.data.liveCampaigns).toHaveLength(2);
    expect(response.body.data.complianceAlerts.length).toBeGreaterThan(0);
    expect(response.body.data.transferQueues.length).toBeGreaterThan(0);
    expect(response.body.data.transferQueues[0]).toEqual(
      expect.objectContaining({
        queue: expect.any(String),
        waiting: expect.any(Number),
        sla: expect.stringMatching(/\dm \d{2}s/u),
      }),
    );
    expect(response.body.data.recentAttempts[0].id).toBe("call-006");
  });

  it("filters campaigns by status", async () => {
    const response = await request(createApp()).get("/api/campaigns").query({ status: "active" });

    expect(response.status).toBe(200);
    expect(response.body.meta.total).toBe(2);
    expect(response.body.data.every((campaign: { status: string }) => campaign.status === "active")).toBe(true);
    expect(response.body.data.every((campaign: { setup?: unknown; journey?: unknown }) => !("setup" in campaign) && !("journey" in campaign))).toBe(true);
  });

  it("creates, launches, pauses, resumes, duplicates, and deletes a campaign", async () => {
    const app = createApp();

    const createResponse = await request(app).post("/api/campaigns").send({
      setup: {
        campaignName: "loan-eligibility-survey",
        vertical: "lending",
        language: "hindi",
        callerIdentity: "Bhaarat Lending",
        introScript: "Hello, this is Bhaarat Lending calling.",
        purposeStatement: "We need to collect a few eligibility details.",
        callingWindowStart: "09:00",
        callingWindowEnd: "20:00",
        transferEnabled: true,
        transferQueue: "Loan advisors",
      },
      fields: [
        {
          field_key: "employment_type",
          label: "Employment type",
          prompt: "What is your employment type?",
          type: "text",
          required: true,
          sensitive: false,
          verification_label: "Employment type",
          retry_limit: 2,
          validation_rule: "Free text",
        },
      ],
      journey: {
        unansweredAction: "sms",
        partialAction: "retry",
        retryWindowHours: 4,
        maxRetries: 3,
        concurrencyLimit: 15,
        pacingPerMinute: 10,
        csvSource: "April lending upload",
      },
    });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.data.status).toBe("draft");
    expect(createResponse.body.data.sequence).toContain("SMS if unanswered");

    const createdId = createResponse.body.data.id as string;

    const launchResponse = await request(app).post(`/api/campaigns/${createdId}/launch`);
    expect(launchResponse.status).toBe(200);
    expect(launchResponse.body.data.status).toBe("active");

    const pauseResponse = await request(app).post(`/api/campaigns/${createdId}/pause`);
    expect(pauseResponse.status).toBe(200);
    expect(pauseResponse.body.data.status).toBe("paused");

    const resumeResponse = await request(app).post(`/api/campaigns/${createdId}/resume`);
    expect(resumeResponse.status).toBe(200);
    expect(resumeResponse.body.data.status).toBe("active");

    const duplicateResponse = await request(app).post(`/api/campaigns/${createdId}/duplicate`);
    expect(duplicateResponse.status).toBe(201);
    expect(duplicateResponse.body.data.status).toBe("draft");
    expect(duplicateResponse.body.data.name).toMatch(/copy/i);

    const deleteResponse = await request(app).delete(`/api/campaigns/${createdId}`);
    expect(deleteResponse.status).toBe(204);

    const fetchDeletedResponse = await request(app).get(`/api/campaigns/${createdId}`);
    expect(fetchDeletedResponse.status).toBe(404);
  });

  it("rejects campaign create and update payloads that enable transfer without a queue", async () => {
    const app = createApp();

    const createResponse = await request(app).post("/api/campaigns").send({
      setup: {
        campaignName: "invalid-transfer-campaign",
        vertical: "banking",
        language: "hindi",
        callerIdentity: "Bhaarat Engage",
        introScript: "Hello, this is Bhaarat Engage calling.",
        purposeStatement: "We need to confirm one detail.",
        callingWindowStart: "09:00",
        callingWindowEnd: "18:00",
        transferEnabled: true,
        transferQueue: "   ",
      },
      fields: [
        {
          field_key: "full_name",
          label: "Full name",
          prompt: "Please confirm your full name.",
          type: "text",
          required: true,
          sensitive: false,
          verification_label: "Full name",
          retry_limit: 2,
          validation_rule: "",
        },
      ],
      journey: {
        unansweredAction: "sms",
        partialAction: "retry",
        retryWindowHours: 4,
        maxRetries: 3,
        concurrencyLimit: 10,
        pacingPerMinute: 5,
        csvSource: "validation-test.csv",
      },
    });

    expect(createResponse.status).toBe(400);
    expect(createResponse.body.error.code).toBe("validation_error");
    expect(createResponse.body.error.issues.fieldErrors.setup).toContain("Transfer queue is required when transfer is enabled.");

    const updateResponse = await request(app).put("/api/campaigns/camp-001").send({
      setup: {
        campaignName: "KYC Verification Drive - Mumbai",
        vertical: "banking",
        language: "hindi",
        callerIdentity: "HDFC Bank",
        introScript: "Namaste. This is HDFC Bank calling regarding your KYC verification.",
        purposeStatement: "Voice-first KYC journey collecting identity details with masked exports and human transfer backup.",
        callingWindowStart: "09:00",
        callingWindowEnd: "21:00",
        transferEnabled: true,
        transferQueue: "",
      },
      fields: [
        {
          field_key: "full_name",
          label: "Full name",
          prompt: "May I have your full name as per your PAN card?",
          type: "text",
          required: true,
          sensitive: false,
          verification_label: "Full name",
          retry_limit: 3,
          validation_rule: "Minimum 2 spoken tokens",
        },
      ],
      journey: {
        unansweredAction: "sms",
        partialAction: "whatsapp",
        retryWindowHours: 4,
        maxRetries: 3,
        concurrencyLimit: 50,
        pacingPerMinute: 20,
        csvSource: "March KYC upload",
      },
    });

    expect(updateResponse.status).toBe(400);
    expect(updateResponse.body.error.code).toBe("validation_error");
    expect(updateResponse.body.error.issues.fieldErrors.setup).toContain("Transfer queue is required when transfer is enabled.");
  });

  it("updates an existing campaign and preserves its detail contract", async () => {
    const app = createApp();

    const updateResponse = await request(app).put("/api/campaigns/camp-003").send({
      setup: {
        campaignName: "Loan Eligibility Refresh - Delhi NCR",
        vertical: "lending",
        language: "english",
        callerIdentity: "Bajaj Finserv Priority",
        introScript: "Hello, this is Bajaj Finserv calling to refresh your eligibility profile.",
        purposeStatement: "We need to verify updated eligibility details before the next outreach cycle.",
        callingWindowStart: "10:00",
        callingWindowEnd: "19:30",
        transferEnabled: false,
        transferQueue: "",
      },
      fields: [
        {
          field_key: "employment_type",
          label: "Employment type",
          prompt: "Please confirm whether you are salaried or self employed.",
          type: "select",
          required: true,
          sensitive: false,
          verification_label: "Employment type",
          retry_limit: 2,
          validation_rule: "Salaried or self employed",
        },
        {
          field_key: "monthly_income",
          label: "Monthly income band",
          prompt: "Which income band best matches your monthly earnings?",
          type: "number",
          required: true,
          sensitive: true,
          verification_label: "Income band",
          retry_limit: 3,
          validation_rule: "Positive whole number",
        },
      ],
      journey: {
        unansweredAction: "retry",
        partialAction: "sms",
        retryWindowHours: 8,
        maxRetries: 4,
        concurrencyLimit: 35,
        pacingPerMinute: 12,
        csvSource: "April requalification upload",
      },
    });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.data.name).toBe("Loan Eligibility Refresh - Delhi NCR");
    expect(updateResponse.body.data.language).toBe("english");
    expect(updateResponse.body.data.transferQueue).toBe("No transfer queue");
    expect(updateResponse.body.data.sequence).toEqual(["Voice first", "Retry voice if unanswered", "SMS if partial"]);
    expect(updateResponse.body.data.setup.campaignName).toBe("Loan Eligibility Refresh - Delhi NCR");
    expect(updateResponse.body.data.setup.introScript).toContain("Bajaj Finserv");
    expect(updateResponse.body.data.journey.maxRetries).toBe(4);

    const detailResponse = await request(app).get("/api/campaigns/camp-003");
    expect(detailResponse.status).toBe(200);
    expect(detailResponse.body.data.name).toBe("Loan Eligibility Refresh - Delhi NCR");
    expect(detailResponse.body.data.fields[1].label).toBe("Monthly income band");
    expect(detailResponse.body.data.setup.callingWindowStart).toBe("10:00");
    expect(detailResponse.body.data.setup.transferEnabled).toBe(false);
    expect(detailResponse.body.data.setup.transferQueue).toBe("");
    expect(detailResponse.body.data.journey.partialAction).toBe("sms");
    expect(detailResponse.body.data.journey.csvSource).toBe("April requalification upload");
  });

  it("blocks invalid campaign transitions", async () => {
    const response = await request(createApp()).post("/api/campaigns/camp-003/resume");

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe("active");

    const invalidPauseResponse = await request(createApp()).post("/api/campaigns/camp-004/pause");

    expect(invalidPauseResponse.status).toBe(409);
    expect(invalidPauseResponse.body.error.code).toBe("campaign_not_active");
  });

  it("filters contacts and creates a new contact", async () => {
    const app = createApp();

    const filteredResponse = await request(app).get("/api/contacts").query({ status: "dnd" });
    expect(filteredResponse.status).toBe(200);
    expect(filteredResponse.body.meta.total).toBe(1);
    expect(filteredResponse.body.data[0].status).toBe("dnd");

    const createResponse = await request(app).post("/api/contacts").send({
      name: "Meera Singh",
      phone: "+919701112223",
      email: "meera@example.com",
      language: "english",
      consent: true,
      source: "Manual entry",
      workspace: "HDFC Collections",
    });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.data.status).toBe("eligible");
  });

  it("updates contacts, marks them do-not-call, deletes them, and imports csv batches", async () => {
    const app = createApp();

    const updateResponse = await request(app).put("/api/contacts/contact-002").send({
      name: "Lakshmi Narayanan",
      phone: "9876500011",
      email: "lakshmi.n@example.com",
      language: "tamil",
      consent: true,
      source: "Renewal desk cleanup",
    });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.data.name).toBe("Lakshmi Narayanan");
    expect(updateResponse.body.data.phone).toBe("+919876500011");
    expect(updateResponse.body.data.source).toBe("Renewal desk cleanup");

    const doNotCallResponse = await request(app).post("/api/contacts/contact-002/do-not-call");

    expect(doNotCallResponse.status).toBe(200);
    expect(doNotCallResponse.body.data.status).toBe("dnd");

    const importResponse = await request(app).post("/api/contacts/import").send({
      filename: "april-upload.csv",
      source: "April portfolio upload",
      defaultLanguage: "english",
      defaultConsent: true,
      csvText: [
        "name,phone,email,language,consent",
        "Meera Singh,9701112223,meera@example.com,english,true",
        "Rajesh Duplicate,+919876543210,duplicate@example.com,hindi,true",
        "Missing Phone,,missing@example.com,english,true",
        "Karthik Rao,+91 9988776655,,kannada,yes",
      ].join("\n"),
    });

    expect(importResponse.status).toBe(201);
    expect(importResponse.body.data.imported).toBe(2);
    expect(importResponse.body.data.duplicates).toBe(1);
    expect(importResponse.body.data.invalid).toBe(1);
    expect(importResponse.body.data.skipped).toBe(2);

    const postImportListResponse = await request(app).get("/api/contacts").query({ search: "Meera" });
    expect(postImportListResponse.status).toBe(200);
    expect(postImportListResponse.body.meta.total).toBe(1);
    expect(postImportListResponse.body.data[0].phone).toBe("+919701112223");

    const deleteResponse = await request(app).delete("/api/contacts/contact-003");
    expect(deleteResponse.status).toBe(204);

    const deletedContactSearch = await request(app).get("/api/contacts").query({ search: "Arun Patel" });
    expect(deletedContactSearch.status).toBe(200);
    expect(deletedContactSearch.body.meta.total).toBe(0);
  });

  it("keeps campaign and journey contact totals in sync when an assigned contact is deleted", async () => {
    const app = createApp();

    const initialCampaignResponse = await request(app).get("/api/campaigns/camp-001");
    expect(initialCampaignResponse.status).toBe(200);

    const initialJourneyResponse = await request(app).get("/api/journeys/jrn-001");
    expect(initialJourneyResponse.status).toBe(200);

    const campaignContactsResponse = await request(app).get("/api/campaigns/camp-001/contacts");
    expect(campaignContactsResponse.status).toBe(200);
    expect(campaignContactsResponse.body.meta.total).toBeGreaterThan(0);

    const contactId = campaignContactsResponse.body.data[0].id as string;

    const deleteResponse = await request(app).delete(`/api/contacts/${contactId}`);
    expect(deleteResponse.status).toBe(204);

    const updatedCampaignResponse = await request(app).get("/api/campaigns/camp-001");
    expect(updatedCampaignResponse.status).toBe(200);
    expect(updatedCampaignResponse.body.data.contactCount).toBe(initialCampaignResponse.body.data.contactCount - 1);

    const updatedJourneyResponse = await request(app).get("/api/journeys/jrn-001");
    expect(updatedJourneyResponse.status).toBe(200);
    expect(updatedJourneyResponse.body.data.totalContacts).toBe(initialJourneyResponse.body.data.totalContacts - 1);

    const updatedCampaignContactsResponse = await request(app).get("/api/campaigns/camp-001/contacts");
    expect(updatedCampaignContactsResponse.status).toBe(200);
    expect(updatedCampaignContactsResponse.body.meta.total).toBe(campaignContactsResponse.body.meta.total - 1);
  });

  it("exports contacts as csv using the active filters", async () => {
    const response = await request(createApp()).get("/api/contacts/export.csv").query({ status: "eligible" });

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("text/csv");
    expect(response.headers["content-disposition"]).toContain("contacts-export.csv");
    expect(response.text).toContain("id,name,phone,email,language,status,consent,workspace,source,campaign_id,last_contacted_at");
    expect(response.text).toContain("Rajesh Kumar");
    expect(response.text).not.toContain("Mohammed Farooq");
  });

  it("rejects duplicate contact phone numbers to match the database uniqueness rule", async () => {
    const response = await request(createApp()).post("/api/contacts").send({
      name: "Rajesh Duplicate",
      phone: "+919876543210",
      language: "hindi",
      consent: true,
      source: "Manual entry",
      workspace: "HDFC Collections",
    });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("contact_phone_exists");
  });

  it("lists, assigns, and removes campaign contacts while keeping primary contact assignments in sync", async () => {
    const app = createApp();

    const initialListResponse = await request(app).get("/api/campaigns/camp-001/contacts");
    expect(initialListResponse.status).toBe(200);
    expect(initialListResponse.body.meta.total).toBe(2);

    const assignResponse = await request(app).post("/api/campaigns/camp-001/contacts").send({
      contactIds: ["contact-006", "contact-002"],
    });

    expect(assignResponse.status).toBe(200);
    expect(assignResponse.body.meta.total).toBe(3);
    expect(assignResponse.body.data.some((contact: { id: string; campaignId?: string }) => contact.id === "contact-006")).toBe(true);
    expect(assignResponse.body.data.every((contact: { campaignId?: string }) => contact.campaignId === "camp-001")).toBe(true);

    const previousCampaignContactsResponse = await request(app).get("/api/campaigns/camp-003/contacts");
    expect(previousCampaignContactsResponse.status).toBe(200);
    expect(previousCampaignContactsResponse.body.meta.total).toBe(0);

    const movedContactResponse = await request(app).get("/api/contacts").query({ search: "Sneha" });
    expect(movedContactResponse.status).toBe(200);
    expect(movedContactResponse.body.data[0].campaignId).toBe("camp-001");

    const removeResponse = await request(app).delete("/api/campaigns/camp-001/contacts/contact-006");
    expect(removeResponse.status).toBe(204);

    const unassignedContactResponse = await request(app).get("/api/contacts").query({ search: "Sneha" });
    expect(unassignedContactResponse.status).toBe(200);
    expect(unassignedContactResponse.body.data[0].campaignId).toBeUndefined();
  });

  it("rejects assigning contacts that are not currently eligible", async () => {
    const response = await request(createApp()).post("/api/campaigns/camp-001/contacts").send({
      contactIds: ["contact-005"],
    });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("contact_not_assignable");
  });

  it("lists call records and exposes transcript plus collected field data", async () => {
    const app = createApp();

    const listResponse = await request(app).get("/api/call-records").query({ status: "completed" });
    expect(listResponse.status).toBe(200);
    expect(listResponse.body.meta.total).toBe(4);
    expect(listResponse.body.data.some((record: { id: string }) => record.id === "call-001")).toBe(true);

    const campaignScopedResponse = await request(app).get("/api/call-records").query({ campaignId: "camp-002" });
    expect(campaignScopedResponse.status).toBe(200);
    expect(campaignScopedResponse.body.meta.total).toBe(2);
    expect(campaignScopedResponse.body.data.every((record: { campaignId: string }) => record.campaignId === "camp-002")).toBe(true);

    const transcriptResponse = await request(app).get("/api/call-records/call-001/transcript");
    expect(transcriptResponse.status).toBe(200);
    expect(transcriptResponse.body.data).toHaveLength(7);

    const dataResponse = await request(app).get("/api/call-records/call-001/data");
    expect(dataResponse.status).toBe(200);
    expect(dataResponse.body.data[1].masked).toBe(true);
  });

  it("proxies call recordings through the api", async () => {
    const fetchMock = vi.fn(async () => new Response("mock-recording", { status: 200, headers: { "content-type": "audio/mpeg" } }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await request(createApp()).get("/api/call-records/call-001/recording");

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("audio/mpeg");
    expect(response.headers["cache-control"]).toBe("private, no-store");
    expect(fetchMock).toHaveBeenCalledWith("https://recordings.example.test/call-001.mp3", { redirect: "follow" });
  });

  it("returns 404 when a call recording is unavailable", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await request(createApp()).get("/api/call-records/call-006/recording");

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("recording_not_found");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("exports call records as csv using the active filters", async () => {
    const response = await request(createApp()).get("/api/call-records/export.csv").query({ status: "failed" });

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("text/csv");
    expect(response.headers["content-disposition"]).toContain("call-records-export.csv");
    expect(response.text).toContain(
      "id,campaign_id,campaign_name,contact_name,phone,provider,status,disposition,confirmed,duration_seconds,started_at,language,fields_collected,fields_total,transcript_mode,error_code",
    );
    expect(response.text).toContain("Deepa Nair");
    expect(response.text).not.toContain("Rajesh Kumar");
  });

  it("exposes journeys, reports, and settings read models for the remaining frontend pages", async () => {
    const app = createApp();

    const journeysResponse = await request(app).get("/api/journeys");
    expect(journeysResponse.status).toBe(200);
    expect(journeysResponse.body.meta.total).toBe(4);
    expect(journeysResponse.body.data[0].campaignId).toBe("camp-001");

    const journeyDetailResponse = await request(app).get("/api/journeys/jrn-001");
    expect(journeyDetailResponse.status).toBe(200);
    expect(journeyDetailResponse.body.data.campaignId).toBe("camp-001");
    expect(journeyDetailResponse.body.data.status).toBe("active");

    const reportsResponse = await request(app).get("/api/reports");
    expect(reportsResponse.status).toBe(200);
    expect(reportsResponse.body.data.dailyVolume).toHaveLength(10);
    expect(reportsResponse.body.data.providerPerformance[0].exotel).toBeDefined();

    const settingsResponse = await request(app).get("/api/settings");
    expect(settingsResponse.status).toBe(200);
    expect(settingsResponse.body.data.notificationPreferences).toHaveLength(5);
    expect(settingsResponse.body.data.apiKeys).toHaveLength(1);
    expect(settingsResponse.body.data.teamMembers.map((member: { role: string }) => member.role)).toEqual(
      expect.arrayContaining(["workspace_admin", "campaign_manager"]),
    );
  });

  it("exports the report snapshot as csv", async () => {
    const response = await request(createApp()).get("/api/reports/export.csv");

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("text/csv");
    expect(response.headers["content-disposition"]).toContain("reports-export.csv");
    expect(response.text).toContain("section,item,metric,value");
    expect(response.text).toContain("overview,answer_rate,value,79.7");
    expect(response.text).toContain("daily_volume,Mar 31,calls,1680");
  });

  it("updates workspace defaults, notification preferences, and webhook settings", async () => {
    const app = createApp();

    const workspaceResponse = await request(app).patch("/api/settings/workspace").send({
      workspaceName: "Collections Control Room",
      defaultLanguage: "english",
      callingWindowStart: "08:30",
      callingWindowEnd: "20:30",
      dndChecksEnabled: true,
      quietHoursAutoPause: false,
      restrictFullTranscripts: false,
    });

    expect(workspaceResponse.status).toBe(200);
    expect(workspaceResponse.body.data.workspaceSettings.workspaceName).toBe("Collections Control Room");
    expect(workspaceResponse.body.data.workspaceSettings.quietHoursAutoPause).toBe(false);

    const notificationsResponse = await request(app).patch("/api/settings/notifications").send({
      preferences: [
        { key: "campaign_launched", enabled: false },
        { key: "provider_failure", enabled: true },
      ],
    });

    expect(notificationsResponse.status).toBe(200);
    expect(
      notificationsResponse.body.data.notificationPreferences.find((item: { key: string }) => item.key === "campaign_launched")
        ?.enabled,
    ).toBe(false);

    const webhookResponse = await request(app).patch("/api/settings/webhook").send({
      url: "https://client.example.com/webhooks/updated",
      events: ["call.completed", "campaign.completed"],
    });

    expect(webhookResponse.status).toBe(200);
    expect(webhookResponse.body.data.apiAccess.webhook.url).toBe("https://client.example.com/webhooks/updated");
    expect(webhookResponse.body.data.apiAccess.webhook.events).toEqual(["call.completed", "campaign.completed"]);
  });

  it("manages team members and API keys from the settings surface", async () => {
    const app = createApp();

    const inviteResponse = await request(app).post("/api/settings/team/invite").send({
      name: "Aparna Rao",
      email: "aparna@example.com",
      role: "reviewer",
    });

    expect(inviteResponse.status).toBe(201);
    expect(inviteResponse.body.data.teamMembers.some((member: { email: string }) => member.email === "aparna@example.com")).toBe(true);

    const invitedMember = inviteResponse.body.data.teamMembers.find(
      (member: { email: string }) => member.email === "aparna@example.com",
    ) as { id: string; role: string };

    const updateRoleResponse = await request(app).put(`/api/settings/team/${invitedMember.id}/role`).send({
      role: "operator",
    });

    expect(updateRoleResponse.status).toBe(200);
    expect(
      updateRoleResponse.body.data.teamMembers.find((member: { id: string }) => member.id === invitedMember.id)?.role,
    ).toBe("operator");

    const blockLastAdminResponse = await request(app).put("/api/settings/team/user-001/role").send({
      role: "viewer",
    });

    expect(blockLastAdminResponse.status).toBe(409);
    expect(blockLastAdminResponse.body.error.code).toBe("last_workspace_admin");

    const deleteLastAdminResponse = await request(app).delete("/api/settings/team/user-001");
    expect(deleteLastAdminResponse.status).toBe(409);
    expect(deleteLastAdminResponse.body.error.code).toBe("last_workspace_admin");

    const listApiKeysResponse = await request(app).get("/api/settings/api-keys");
    expect(listApiKeysResponse.status).toBe(200);
    expect(listApiKeysResponse.body.meta.total).toBe(1);

    const createApiKeyResponse = await request(app).post("/api/settings/api-keys").send({
      name: "Partner webhook",
    });

    expect(createApiKeyResponse.status).toBe(201);
    expect(createApiKeyResponse.body.data.name).toBe("Partner webhook");
    expect(createApiKeyResponse.body.data.rawKey).toMatch(/^bv_live_/);

    const createdApiKeyId = createApiKeyResponse.body.data.id as string;
    const deleteApiKeyResponse = await request(app).delete(`/api/settings/api-keys/${createdApiKeyId}`);
    expect(deleteApiKeyResponse.status).toBe(204);

    const removeMemberResponse = await request(app).delete(`/api/settings/team/${invitedMember.id}`);
    expect(removeMemberResponse.status).toBe(200);
    expect(
      removeMemberResponse.body.data.teamMembers.some((member: { id: string }) => member.id === invitedMember.id),
    ).toBe(false);
  });

  it("returns combined global search results", async () => {
    const response = await request(createApp()).get("/api/search/global").query({ q: "rajesh" });

    expect(response.status).toBe(200);
    expect(response.body.data.contacts).toHaveLength(1);
    expect(response.body.data.callRecords).toHaveLength(1);
  });

  it("cascades campaign deletion across seeded call records and transcript artifacts", async () => {
    const app = createApp();

    const deleteResponse = await request(app).delete("/api/campaigns/camp-001");
    expect(deleteResponse.status).toBe(204);

    const callRecordsResponse = await request(app).get("/api/call-records").query({ search: "Rajesh" });
    expect(callRecordsResponse.status).toBe(200);
    expect(callRecordsResponse.body.meta.total).toBe(0);

    const contactsResponse = await request(app).get("/api/contacts").query({ search: "Rajesh" });
    expect(contactsResponse.status).toBe(200);
    expect(contactsResponse.body.meta.total).toBe(1);
    expect(contactsResponse.body.data[0].campaignId).toBeUndefined();

    const transcriptResponse = await request(app).get("/api/call-records/call-001/transcript");
    expect(transcriptResponse.status).toBe(404);

    const journeysResponse = await request(app).get("/api/journeys");
    expect(journeysResponse.body.data.some((journey: { campaignId: string }) => journey.campaignId === "camp-001")).toBe(false);
  });
});
