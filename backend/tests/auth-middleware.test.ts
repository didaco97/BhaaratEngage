import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";
import type { RequestPrincipal } from "../src/modules/auth/auth.types.js";

const campaignManagerPrincipal: RequestPrincipal = {
  userId: "user-campaign-manager",
  organizationId: "org-001",
  role: "campaign_manager",
  email: "manager@example.com",
  fullName: "Campaign Manager",
  authMode: "supabase",
};

describe("api auth middleware", () => {
  it("rejects api requests without a bearer token when supabase auth mode is enabled", async () => {
    const response = await request(
      createApp({
        auth: {
          mode: "supabase",
          resolveSupabasePrincipal: async () => campaignManagerPrincipal,
        },
      }),
    ).get("/api/dashboard");

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("authorization_required");
  });

  it("rejects authenticated users whose role is too low for the target route", async () => {
    const response = await request(
      createApp({
        auth: {
          mode: "supabase",
          resolveSupabasePrincipal: async () => ({
            ...campaignManagerPrincipal,
            role: "reviewer",
          }),
        },
      }),
    )
      .post("/api/campaigns")
      .set("Authorization", "Bearer reviewer-token")
      .send({
        setup: {
          campaignName: "blocked-campaign",
          vertical: "banking",
          language: "english",
          callerIdentity: "Bhaarat Engage",
          introScript: "Hello from Bhaarat Engage.",
          purposeStatement: "This request should fail on role policy.",
          callingWindowStart: "09:00",
          callingWindowEnd: "18:00",
          transferEnabled: false,
          transferQueue: "",
        },
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
        journey: {
          unansweredAction: "sms",
          partialAction: "retry",
          retryWindowHours: 4,
          maxRetries: 2,
          concurrencyLimit: 10,
          pacingPerMinute: 5,
          csvSource: "Auth policy test",
        },
      });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("insufficient_role");
  });

  it("allows authenticated users with the required role to access protected routes", async () => {
    const response = await request(
      createApp({
        auth: {
          mode: "supabase",
          resolveSupabasePrincipal: async () => campaignManagerPrincipal,
        },
      }),
    )
      .post("/api/campaigns")
      .set("Authorization", "Bearer campaign-manager-token")
      .send({
        setup: {
          campaignName: "auth-allowed-campaign",
          vertical: "lending",
          language: "hindi",
          callerIdentity: "Bhaarat Engage",
          introScript: "Hello from the auth test campaign.",
          purposeStatement: "Verify that campaign managers can create campaigns.",
          callingWindowStart: "09:30",
          callingWindowEnd: "19:00",
          transferEnabled: true,
          transferQueue: "Verification desk",
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
          partialAction: "whatsapp",
          retryWindowHours: 6,
          maxRetries: 3,
          concurrencyLimit: 15,
          pacingPerMinute: 8,
          csvSource: "Authenticated create test",
        },
      });

    expect(response.status).toBe(201);
    expect(response.body.data.name).toBe("auth-allowed-campaign");
  });
});
