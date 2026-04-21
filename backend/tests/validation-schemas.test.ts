import { describe, expect, it } from "vitest";

import { callRecordSchema } from "../src/modules/call-records/call-record.schemas.js";
import { createCampaignRequestSchema } from "../src/modules/campaigns/campaign.schemas.js";
import { contactImportRequestSchema } from "../src/modules/contacts/contact.schemas.js";
import { workspaceSettingsSchema } from "../src/modules/settings/settings.schemas.js";

describe("schema validation", () => {
  it("rejects campaigns that enable transfer without a queue name", () => {
    const result = createCampaignRequestSchema.safeParse({
      setup: {
        campaignName: "KYC Verification",
        vertical: "banking",
        language: "hindi",
        callerIdentity: "Bhaarat Engage",
        introScript: "Namaste, this is Bhaarat Engage.",
        purposeStatement: "We need to confirm one KYC detail.",
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
        csvSource: "kyc-upload.csv",
      },
    });

    expect(result.success).toBe(false);
    expect(result.error?.flatten().fieldErrors.setup).toEqual(["Transfer queue is required when transfer is enabled."]);
  });

  it("coerces journey tuning values from form-style strings", () => {
    const result = createCampaignRequestSchema.parse({
      setup: {
        campaignName: "KYC Verification",
        vertical: "banking",
        language: "hindi",
        callerIdentity: "Bhaarat Engage",
        introScript: "Namaste, this is Bhaarat Engage.",
        purposeStatement: "We need to confirm one KYC detail.",
        callingWindowStart: "09:00",
        callingWindowEnd: "18:00",
        transferEnabled: false,
        transferQueue: "",
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
        retryWindowHours: "4",
        maxRetries: "3",
        concurrencyLimit: "10",
        pacingPerMinute: "5",
        csvSource: "kyc-upload.csv",
      },
    });

    expect(result.journey.retryWindowHours).toBe(4);
    expect(result.journey.maxRetries).toBe(3);
    expect(result.journey.concurrencyLimit).toBe(10);
    expect(result.journey.pacingPerMinute).toBe(5);
  });

  it("defaults contact import consent to true when not provided", () => {
    const result = contactImportRequestSchema.parse({
      filename: "contacts.csv",
      csvText: "name,phone\nAsha,+919999999999",
    });

    expect(result.defaultConsent).toBe(true);
  });

  it("rejects invalid workspace calling-window formats", () => {
    const result = workspaceSettingsSchema.safeParse({
      workspaceName: "Operations",
      defaultLanguage: "english",
      callingWindowStart: "9:00",
      callingWindowEnd: "18:00",
      dndChecksEnabled: true,
      quietHoursAutoPause: true,
      restrictFullTranscripts: true,
    });

    expect(result.success).toBe(false);
    expect(result.error?.flatten().fieldErrors.callingWindowStart).toEqual(["Expected time in HH:MM format."]);
  });

  it("keeps call-record field totals strictly positive", () => {
    const result = callRecordSchema.safeParse({
      id: "call-001",
      campaignId: "camp-001",
      campaignName: "KYC Verification",
      contactName: "Asha Sharma",
      phone: "+919999999999",
      provider: "plivo",
      status: "completed",
      disposition: "data_collected",
      confirmed: true,
      duration: 32,
      startedAt: "2026-04-09T10:00:00.000Z",
      language: "hindi",
      fieldsCollected: 0,
      fieldsTotal: 0,
      transcriptMode: "redacted",
    });

    expect(result.success).toBe(false);
    expect(result.error?.flatten().fieldErrors.fieldsTotal).toBeTruthy();
  });
});
