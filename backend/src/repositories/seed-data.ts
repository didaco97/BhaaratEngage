import {
  callRecordSchema,
  transcriptTurnSchema,
  type CallRecord,
  type TranscriptTurn,
} from "../modules/call-records/call-record.schemas.js";
import {
  campaignDetailSchema,
  campaignSummarySchema,
  type CampaignDetail,
  type CampaignJourneyRule,
  type CampaignSetup,
  type CampaignSummary,
} from "../modules/campaigns/campaign.schemas.js";
import { contactSchema, type Contact } from "../modules/contacts/contact.schemas.js";
import {
  auditEventSchema,
  complianceAlertSchema,
  dashboardOverviewSchema,
  dispositionBreakdownItemSchema,
  transferQueueSummarySchema,
  voiceThroughputPointSchema,
  type AuditEvent,
  type ComplianceAlert,
  type DashboardOverview,
  type DispositionBreakdownItem,
  type TransferQueueSummary,
  type VoiceThroughputPoint,
} from "../modules/dashboard/dashboard.schemas.js";
import { journeyMonitorSchema, type JourneyMonitor } from "../modules/journeys/journey.schemas.js";
import {
  fieldDropoffSchema,
  providerPerformanceSchema,
  type FieldDropoff,
  type ProviderPerformance,
} from "../modules/reports/report.schemas.js";
import {
  apiAccessConfigSchema,
  apiKeySummarySchema,
  notificationPreferenceSchema,
  securityControlSchema,
  teamMemberSchema,
  workspaceInventorySchema,
  workspaceSettingsSchema,
  type ApiAccessConfig,
  type ApiKeySummary,
  type NotificationPreference,
  type SecurityControl,
  type TeamMember,
  type WorkspaceInventory,
  type WorkspaceSettings,
} from "../modules/settings/settings.schemas.js";
import type { VoiceSessionCollectedField } from "./backend-repositories.js";

export interface SeedState {
  campaigns: CampaignDetail[];
  contacts: Contact[];
  callRecords: CallRecord[];
  callRecordIdByProviderCallId: Record<string, string>;
  recordingUrlsByCallId: Record<string, string>;
  journeyCheckpointAtByCampaignId: Record<string, string | null>;
  transcriptsByCallId: Record<
    string,
    {
      raw: TranscriptTurn[];
      redacted: TranscriptTurn[];
    }
  >;
  collectedDataByCallId: Record<string, VoiceSessionCollectedField[]>;
  journeys: JourneyMonitor[];
  dashboardOverview: DashboardOverview;
  voiceThroughput: VoiceThroughputPoint[];
  complianceAlerts: ComplianceAlert[];
  transferQueues: TransferQueueSummary[];
  auditEvents: AuditEvent[];
  dispositionBreakdown: DispositionBreakdownItem[];
  fieldDropoff: FieldDropoff[];
  providerPerformance: ProviderPerformance[];
  workspaceSettings: WorkspaceSettings;
  workspaces: WorkspaceInventory[];
  teamMembers: TeamMember[];
  notificationPreferences: NotificationPreference[];
  securityControls: SecurityControl[];
  apiAccess: ApiAccessConfig;
  apiKeys: ApiKeySummary[];
}

const seededCampaignConfigById: Record<
  string,
  {
    readonly introScript: string;
    readonly journey: CampaignJourneyRule;
  }
> = {
  "camp-001": {
    introScript: "Namaste. This is HDFC Bank calling to refresh your KYC details for continued account servicing.",
    journey: {
      unansweredAction: "sms",
      partialAction: "whatsapp",
      retryWindowHours: 4,
      maxRetries: 3,
      concurrencyLimit: 50,
      pacingPerMinute: 20,
      csvSource: "March KYC upload",
    },
  },
  "camp-002": {
    introScript: "Vanakkam. This is Star Health calling regarding your upcoming policy renewal.",
    journey: {
      unansweredAction: "none",
      partialAction: "whatsapp",
      retryWindowHours: 6,
      maxRetries: 2,
      concurrencyLimit: 28,
      pacingPerMinute: 14,
      csvSource: "Renewal batch 02",
    },
  },
  "camp-003": {
    introScript: "Hello, this is Bajaj Finserv calling to confirm a few details for your eligibility review.",
    journey: {
      unansweredAction: "sms",
      partialAction: "whatsapp",
      retryWindowHours: 8,
      maxRetries: 3,
      concurrencyLimit: 32,
      pacingPerMinute: 12,
      csvSource: "Lead nurture sync",
    },
  },
  "camp-004": {
    introScript: "Hello, this is Apollo Clinics calling with an appointment reminder and confirmation check.",
    journey: {
      unansweredAction: "sms",
      partialAction: "none",
      retryWindowHours: 2,
      maxRetries: 1,
      concurrencyLimit: 24,
      pacingPerMinute: 16,
      csvSource: "Appointment schedule import",
    },
  },
  "camp-005": {
    introScript: "Namaste. This is HDFC Bank calling to confirm your credit card activation readiness.",
    journey: {
      unansweredAction: "sms",
      partialAction: "retry",
      retryWindowHours: 4,
      maxRetries: 3,
      concurrencyLimit: 18,
      pacingPerMinute: 10,
      csvSource: "April activation upload",
    },
  },
};

function parseQuietHours(value: string) {
  const matched = value.match(/(?<start>\d{2}:\d{2})\s+to\s+(?<end>\d{2}:\d{2})/u);

  return {
    start: matched?.groups?.start ?? "09:00",
    end: matched?.groups?.end ?? "21:00",
  };
}

function buildSeedCampaignSetup(campaign: CampaignSummary, introScript: string): CampaignSetup {
  const quietHours = parseQuietHours(campaign.quietHours);
  const transferEnabled = campaign.transferQueue !== "No transfer queue";

  return {
    campaignName: campaign.name,
    vertical: campaign.vertical,
    language: campaign.language,
    callerIdentity: campaign.callerIdentity,
    introScript,
    purposeStatement: campaign.summary,
    callingWindowStart: quietHours.start,
    callingWindowEnd: quietHours.end,
    transferEnabled,
    transferQueue: transferEnabled ? campaign.transferQueue : "",
  };
}

function buildSeedCollectedField(input: {
  fieldKey: string;
  label: string;
  rawValue: string;
  maskedValue?: string;
  confidenceScore: number;
  confirmed: boolean;
  sensitive: boolean;
}): VoiceSessionCollectedField {
  return {
    fieldKey: input.fieldKey,
    label: input.label,
    rawValue: input.rawValue,
    maskedValue: input.maskedValue ?? input.rawValue,
    confidenceScore: input.confidenceScore,
    confirmed: input.confirmed,
    sensitive: input.sensitive,
  };
}

function buildSeedTranscriptArtifact(input: {
  raw: TranscriptTurn[];
  redacted?: TranscriptTurn[];
}) {
  return {
    raw: transcriptTurnSchema.array().parse(input.raw),
    redacted: transcriptTurnSchema.array().parse(input.redacted ?? input.raw),
  };
}

export function createSeedState(): SeedState {
  const campaignSummaries = campaignSummarySchema.array().parse([
    {
      id: "camp-001",
      name: "KYC Verification Drive - Mumbai",
      status: "active",
      language: "hindi",
      vertical: "banking",
      template: "KYC refresh",
      workspace: "HDFC Collections",
      callerIdentity: "HDFC Bank",
      summary: "Voice-first KYC journey collecting identity details with masked exports and human transfer backup.",
      contactCount: 15420,
      completionRate: 67.3,
      answerRate: 82.1,
      confirmationRate: 75.9,
      createdAt: "2026-03-15T00:00:00.000Z",
      launchedAt: "2026-03-18T00:00:00.000Z",
      quietHours: "09:00 to 21:00 IST",
      transferQueue: "Mumbai review desk",
      sensitiveFieldCount: 2,
      sequence: ["Voice first", "SMS if unanswered", "WhatsApp if partial"],
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
        {
          field_key: "pan_number",
          label: "PAN number",
          prompt: "Could you please share your PAN number?",
          type: "text",
          required: true,
          sensitive: true,
          verification_label: "PAN ending",
          retry_limit: 3,
          validation_rule: "PAN format AAAA9999A",
        },
        {
          field_key: "dob",
          label: "Date of birth",
          prompt: "What is your date of birth?",
          type: "date",
          required: true,
          sensitive: true,
          verification_label: "Date of birth",
          retry_limit: 2,
          validation_rule: "Valid DD/MM/YYYY",
        },
        {
          field_key: "address",
          label: "Current address",
          prompt: "Can you confirm your current residential address?",
          type: "text",
          required: true,
          sensitive: false,
          verification_label: "Address",
          retry_limit: 2,
          validation_rule: "Free text",
        },
      ],
    },
    {
      id: "camp-002",
      name: "Insurance Renewal - Tamil Nadu",
      status: "active",
      language: "tamil",
      vertical: "insurance",
      template: "Policy renewal",
      workspace: "Star Health Insurance",
      callerIdentity: "Star Health",
      summary: "Renewal campaign using voice with WhatsApp reminder when the recipient leaves the flow mid-way.",
      contactCount: 8930,
      completionRate: 54.8,
      answerRate: 76.5,
      confirmationRate: 62.2,
      createdAt: "2026-03-20T00:00:00.000Z",
      launchedAt: "2026-03-22T00:00:00.000Z",
      quietHours: "10:00 to 20:30 IST",
      transferQueue: "Renewal specialists",
      sensitiveFieldCount: 0,
      sequence: ["Voice first", "WhatsApp reminder if partial"],
      fields: [
        {
          field_key: "policy_number",
          label: "Policy number",
          prompt: "Please share your policy number.",
          type: "text",
          required: true,
          sensitive: false,
          verification_label: "Policy number",
          retry_limit: 3,
          validation_rule: "Alpha numeric",
        },
        {
          field_key: "renewal_confirm",
          label: "Renewal confirmation",
          prompt: "Would you like to renew your policy?",
          type: "boolean",
          required: true,
          sensitive: false,
          verification_label: "Renewal decision",
          retry_limit: 2,
          validation_rule: "Yes or no",
        },
      ],
    },
    {
      id: "camp-003",
      name: "Loan Eligibility Survey - Delhi NCR",
      status: "paused",
      language: "hindi",
      vertical: "lending",
      template: "Lead qualification",
      workspace: "Bajaj Finserv",
      callerIdentity: "Bajaj Finserv",
      summary: "Qualification survey paused after provider instability triggered the internal review workflow.",
      contactCount: 22100,
      completionRate: 31.2,
      answerRate: 68.9,
      confirmationRate: 40.4,
      createdAt: "2026-03-10T00:00:00.000Z",
      launchedAt: "2026-03-12T00:00:00.000Z",
      quietHours: "09:30 to 20:00 IST",
      transferQueue: "Loan advisors",
      sensitiveFieldCount: 1,
      sequence: ["Voice first", "SMS reminder", "WhatsApp summary"],
      fields: [
        {
          field_key: "employment_type",
          label: "Employment type",
          prompt: "Could you tell me whether you are salaried or self employed?",
          type: "select",
          required: true,
          sensitive: false,
          verification_label: "Employment type",
          retry_limit: 2,
          validation_rule: "",
        },
        {
          field_key: "monthly_income",
          label: "Monthly income",
          prompt: "What is your approximate monthly income?",
          type: "number",
          required: true,
          sensitive: true,
          verification_label: "Income band",
          retry_limit: 2,
          validation_rule: "Positive whole number",
        },
      ],
    },
    {
      id: "camp-004",
      name: "Healthcare Appointment Reminders",
      status: "completed",
      language: "english",
      vertical: "healthcare",
      template: "Appointment reminder",
      workspace: "Apollo Clinics",
      callerIdentity: "Apollo Clinics",
      summary: "Appointment reminder journey with strong completion and low opt-out across voice and SMS.",
      contactCount: 5600,
      completionRate: 89.4,
      answerRate: 91.2,
      confirmationRate: 88.1,
      createdAt: "2026-02-28T00:00:00.000Z",
      launchedAt: "2026-03-01T00:00:00.000Z",
      quietHours: "08:00 to 19:30 IST",
      transferQueue: "Scheduling desk",
      sensitiveFieldCount: 0,
      sequence: ["Voice first", "SMS confirmation"],
      fields: [
        {
          field_key: "appointment_slot",
          label: "Appointment slot",
          prompt: "Can you confirm your appointment slot?",
          type: "text",
          required: true,
          sensitive: false,
          verification_label: "Appointment slot",
          retry_limit: 2,
          validation_rule: "",
        },
      ],
    },
    {
      id: "camp-005",
      name: "Credit Card Activation - Karnataka",
      status: "draft",
      language: "kannada",
      vertical: "banking",
      template: "Card activation",
      workspace: "HDFC Collections",
      callerIdentity: "HDFC Bank",
      summary: "Draft activation flow waiting for compliance review before CSV upload and launch approval.",
      contactCount: 0,
      completionRate: 0,
      answerRate: 0,
      confirmationRate: 0,
      createdAt: "2026-04-01T00:00:00.000Z",
      quietHours: "09:00 to 21:00 IST",
      transferQueue: "Card support",
      sensitiveFieldCount: 1,
      sequence: ["Voice first", "SMS reminder if unanswered"],
      fields: [
        {
          field_key: "last_four_digits",
          label: "Card last four digits",
          prompt: "Please confirm the last four digits of your card.",
          type: "number",
          required: true,
          sensitive: true,
          verification_label: "Card ending",
          retry_limit: 3,
          validation_rule: "",
        },
      ],
    },
  ]);

  const campaigns = campaignDetailSchema.array().parse(
    campaignSummaries.map((campaign) => {
      const config = seededCampaignConfigById[campaign.id];

      if (!config) {
        throw new Error(`Missing seeded campaign config for ${campaign.id}.`);
      }

      return {
        ...campaign,
        setup: buildSeedCampaignSetup(campaign, config.introScript),
        journey: config.journey,
      };
    }),
  );

  const contacts = contactSchema.array().parse([
    {
      id: "contact-001",
      name: "Rajesh Kumar",
      phone: "+919876543210",
      email: "rajesh@demo.in",
      language: "hindi",
      status: "eligible",
      consent: true,
      campaignId: "camp-001",
      workspace: "HDFC Collections",
      source: "March KYC upload",
      lastContactedAt: "2026-04-02T10:30:00.000Z",
    },
    {
      id: "contact-002",
      name: "Priya Sharma",
      phone: "+918765432109",
      language: "hindi",
      status: "eligible",
      consent: true,
      campaignId: "camp-001",
      workspace: "HDFC Collections",
      source: "March KYC upload",
      lastContactedAt: "2026-04-01T00:00:00.000Z",
    },
    {
      id: "contact-003",
      name: "Arun Patel",
      phone: "+917654321098",
      email: "arun.p@demo.in",
      language: "gujarati",
      status: "opted_out",
      consent: false,
      workspace: "Bajaj Finserv",
      source: "Lead nurture sync",
    },
    {
      id: "contact-004",
      name: "Lakshmi Iyer",
      phone: "+916543210987",
      language: "tamil",
      status: "eligible",
      consent: true,
      campaignId: "camp-002",
      workspace: "Star Health Insurance",
      source: "Renewal batch 02",
    },
    {
      id: "contact-005",
      name: "Mohammed Farooq",
      phone: "+915432109876",
      email: "farooq@demo.in",
      language: "urdu",
      status: "dnd",
      consent: false,
      workspace: "HDFC Collections",
      source: "Central suppression file",
    },
    {
      id: "contact-006",
      name: "Sneha Reddy",
      phone: "+914321098765",
      language: "telugu",
      status: "eligible",
      consent: true,
      campaignId: "camp-003",
      workspace: "Bajaj Finserv",
      source: "Loan intent form",
    },
    {
      id: "contact-007",
      name: "Vikram Singh",
      phone: "+913210987654",
      language: "hindi",
      status: "suppressed",
      consent: true,
      workspace: "HDFC Collections",
      source: "Suppression rule 04",
    },
    {
      id: "contact-008",
      name: "Ananya Das",
      phone: "+912109876543",
      email: "ananya@demo.in",
      language: "bengali",
      status: "eligible",
      consent: true,
      campaignId: "camp-004",
      workspace: "Apollo Clinics",
      source: "Appointment export",
    },
  ]);

  const callRecords = callRecordSchema.array().parse([
    {
      id: "call-001",
      campaignId: "camp-001",
      campaignName: "KYC Verification Drive - Mumbai",
      contactName: "Rajesh Kumar",
      phone: "+919876543210",
      provider: "exotel",
      status: "completed",
      disposition: "data_collected",
      confirmed: true,
      duration: 245,
      startedAt: "2026-04-02T10:30:00.000Z",
      language: "hindi",
      fieldsCollected: 4,
      fieldsTotal: 4,
      transcriptMode: "redacted",
    },
    {
      id: "call-002",
      campaignId: "camp-001",
      campaignName: "KYC Verification Drive - Mumbai",
      contactName: "Priya Sharma",
      phone: "+918765432109",
      provider: "exotel",
      status: "completed",
      disposition: "data_collected",
      confirmed: true,
      duration: 198,
      startedAt: "2026-04-02T10:35:00.000Z",
      language: "hindi",
      fieldsCollected: 4,
      fieldsTotal: 4,
      transcriptMode: "redacted",
    },
    {
      id: "call-003",
      campaignId: "camp-001",
      campaignName: "KYC Verification Drive - Mumbai",
      contactName: "Amit Verma",
      phone: "+919988776655",
      provider: "exotel",
      status: "no_answer",
      disposition: "no_answer",
      confirmed: false,
      duration: 0,
      startedAt: "2026-04-02T10:40:00.000Z",
      language: "hindi",
      fieldsCollected: 0,
      fieldsTotal: 4,
      transcriptMode: "none",
    },
    {
      id: "call-004",
      campaignId: "camp-002",
      campaignName: "Insurance Renewal - Tamil Nadu",
      contactName: "Lakshmi Iyer",
      phone: "+916543210987",
      provider: "exotel",
      status: "completed",
      disposition: "data_collected",
      confirmed: true,
      duration: 156,
      startedAt: "2026-04-02T11:00:00.000Z",
      language: "tamil",
      fieldsCollected: 2,
      fieldsTotal: 2,
      transcriptMode: "redacted",
    },
    {
      id: "call-005",
      campaignId: "camp-002",
      campaignName: "Insurance Renewal - Tamil Nadu",
      contactName: "Suresh M",
      phone: "+918877665544",
      provider: "exotel",
      status: "transferred",
      disposition: "human_transfer",
      confirmed: false,
      duration: 320,
      startedAt: "2026-04-02T11:05:00.000Z",
      language: "tamil",
      fieldsCollected: 1,
      fieldsTotal: 2,
      transcriptMode: "restricted",
    },
    {
      id: "call-006",
      campaignId: "camp-001",
      campaignName: "KYC Verification Drive - Mumbai",
      contactName: "Deepa Nair",
      phone: "+917766554433",
      provider: "plivo",
      status: "failed",
      disposition: "network_error",
      confirmed: false,
      duration: 12,
      startedAt: "2026-04-02T11:15:00.000Z",
      language: "hindi",
      fieldsCollected: 0,
      fieldsTotal: 4,
      transcriptMode: "none",
      errorCode: "PROVIDER_TIMEOUT",
    },
    {
      id: "call-007",
      campaignId: "camp-003",
      campaignName: "Loan Eligibility Survey - Delhi NCR",
      contactName: "Sneha Reddy",
      phone: "+914321098765",
      provider: "exotel",
      status: "completed",
      disposition: "partial_collection",
      confirmed: false,
      duration: 180,
      startedAt: "2026-04-01T14:20:00.000Z",
      language: "telugu",
      fieldsCollected: 2,
      fieldsTotal: 5,
      transcriptMode: "restricted",
    },
    {
      id: "call-008",
      campaignId: "camp-004",
      campaignName: "Healthcare Appointment Reminders",
      contactName: "Ananya Das",
      phone: "+912109876543",
      provider: "exotel",
      status: "busy",
      disposition: "busy",
      confirmed: false,
      duration: 0,
      startedAt: "2026-04-01T09:00:00.000Z",
      language: "bengali",
      fieldsCollected: 0,
      fieldsTotal: 1,
      transcriptMode: "none",
    },
  ]);

  const recordingUrlsByCallId: Record<string, string> = {
    "call-001": "https://recordings.example.test/call-001.mp3",
    "call-004": "https://recordings.example.test/call-004.mp3",
    "call-005": "https://recordings.example.test/call-005.mp3",
    "call-007": "https://recordings.example.test/call-007.mp3",
  };

  const transcriptsByCallId: SeedState["transcriptsByCallId"] = {
    "call-001": buildSeedTranscriptArtifact({
      raw: [
        { speaker: "Bot", text: "Namaste. This is HDFC Bank calling regarding your KYC verification." },
        { speaker: "User", text: "Yes, please continue." },
        { speaker: "Bot", text: "May I have your full name as per your PAN card?" },
        { speaker: "User", text: "Rajesh Kumar." },
        { speaker: "Bot", text: "Thank you. Please share your PAN number." },
        { speaker: "User", text: "ABCDE1234F." },
        { speaker: "Bot", text: "I will now confirm the captured details with the PAN masked for your privacy." },
      ],
      redacted: [
        { speaker: "Bot", text: "Namaste. This is HDFC Bank calling regarding your KYC verification." },
        { speaker: "User", text: "Yes, please continue." },
        { speaker: "Bot", text: "May I have your full name as per your PAN card?" },
        { speaker: "User", text: "Rajesh Kumar." },
        { speaker: "Bot", text: "Thank you. Please share your PAN number." },
        { speaker: "User", text: "******234F." },
        { speaker: "Bot", text: "I will now confirm the captured details with the PAN masked for your privacy." },
      ],
    }),
    "call-004": buildSeedTranscriptArtifact({
      raw: [
        { speaker: "Bot", text: "Vanakkam. This is Star Health regarding your renewal." },
        { speaker: "User", text: "Yes, please share the details." },
        { speaker: "Bot", text: "Please confirm your policy number." },
        { speaker: "User", text: "TN-44192." },
      ],
    }),
    "call-005": buildSeedTranscriptArtifact({
      raw: [
        { speaker: "Bot", text: "Vanakkam Priya, this is Star Health regarding your renewal." },
        { speaker: "User", text: "Can I speak with an agent?" },
        { speaker: "System", text: "Transferred to renewal specialists." },
      ],
    }),
    "call-007": buildSeedTranscriptArtifact({
      raw: [
        { speaker: "Bot", text: "Namaste, this is Bajaj Finserv calling to check your eligibility details." },
        { speaker: "User", text: "I can share some of them now." },
        { speaker: "Bot", text: "Thank you, we will send a follow-up summary for the remaining questions." },
      ],
    }),
  };

  const collectedDataByCallId: Record<string, VoiceSessionCollectedField[]> = {
    "call-001": [
      buildSeedCollectedField({
        fieldKey: "full_name",
        label: "Full name",
        rawValue: "Rajesh Kumar",
        confidenceScore: 0.99,
        confirmed: true,
        sensitive: false,
      }),
      buildSeedCollectedField({
        fieldKey: "pan_number",
        label: "PAN number",
        rawValue: "ABCDE1234F",
        maskedValue: "******234F",
        confidenceScore: 0.97,
        confirmed: true,
        sensitive: true,
      }),
      buildSeedCollectedField({
        fieldKey: "dob",
        label: "Date of birth",
        rawValue: "01/01/1990",
        maskedValue: "**/**/1990",
        confidenceScore: 0.94,
        confirmed: true,
        sensitive: true,
      }),
      buildSeedCollectedField({
        fieldKey: "address",
        label: "Current address",
        rawValue: "Andheri East, Mumbai",
        confidenceScore: 0.91,
        confirmed: true,
        sensitive: false,
      }),
    ],
    "call-004": [
      buildSeedCollectedField({
        fieldKey: "policy_number",
        label: "Policy number",
        rawValue: "TN-44192",
        confidenceScore: 0.96,
        confirmed: true,
        sensitive: false,
      }),
      buildSeedCollectedField({
        fieldKey: "renewal_confirm",
        label: "Renewal confirmation",
        rawValue: "Yes",
        confidenceScore: 0.93,
        confirmed: true,
        sensitive: false,
      }),
    ],
    "call-005": [
      buildSeedCollectedField({
        fieldKey: "policy_number",
        label: "Policy number",
        rawValue: "TN-44192",
        confidenceScore: 0.82,
        confirmed: false,
        sensitive: false,
      }),
    ],
    "call-007": [
      buildSeedCollectedField({
        fieldKey: "employment_type",
        label: "Employment type",
        rawValue: "Salaried",
        confidenceScore: 0.88,
        confirmed: true,
        sensitive: false,
      }),
      buildSeedCollectedField({
        fieldKey: "monthly_income",
        label: "Monthly income",
        rawValue: "65000",
        maskedValue: "******",
        confidenceScore: 0.74,
        confirmed: false,
        sensitive: true,
      }),
    ],
  };

  const journeys = journeyMonitorSchema.array().parse([
    {
      id: "jrn-001",
      campaignId: "camp-001",
      campaignName: "KYC Verification Drive - Mumbai",
      sequence: ["Voice first", "SMS if unanswered", "WhatsApp if partial"],
      status: "active",
      totalContacts: 15420,
      processed: 10382,
      successRate: 67.3,
      retryWindowHours: 4,
      concurrencyLimit: 50,
      pacingPerMinute: 20,
      nextCheckpoint: "Tonight 20:15 IST",
    },
    {
      id: "jrn-002",
      campaignId: "camp-002",
      campaignName: "Insurance Renewal - Tamil Nadu",
      sequence: ["Voice first", "WhatsApp reminder"],
      status: "active",
      totalContacts: 8930,
      processed: 4891,
      successRate: 54.8,
      retryWindowHours: 6,
      concurrencyLimit: 38,
      pacingPerMinute: 16,
      nextCheckpoint: "Tomorrow 10:00 IST",
    },
    {
      id: "jrn-003",
      campaignId: "camp-003",
      campaignName: "Loan Eligibility Survey - Delhi NCR",
      sequence: ["Voice first", "SMS reminder", "WhatsApp summary"],
      status: "paused",
      totalContacts: 22100,
      processed: 6893,
      successRate: 31.2,
      retryWindowHours: 8,
      concurrencyLimit: 32,
      pacingPerMinute: 12,
      nextCheckpoint: "Pending provider review",
    },
    {
      id: "jrn-004",
      campaignId: "camp-004",
      campaignName: "Healthcare Appointment Reminders",
      sequence: ["Voice first", "SMS confirmation"],
      status: "completed",
      totalContacts: 5600,
      processed: 5600,
      successRate: 89.4,
      retryWindowHours: 2,
      concurrencyLimit: 24,
      pacingPerMinute: 18,
      nextCheckpoint: "Completed",
    },
  ]);

  const dashboardOverview = dashboardOverviewSchema.parse({
    totalCalls: 38420,
    activeCampaigns: 2,
    totalCampaigns: 5,
    totalContacts: 52050,
    avgHandlingTime: 185,
    avgAnswerRate: 79.7,
    avgCompletionRate: 60.7,
    avgConfirmationRate: 72.3,
    optOutRate: 3.2,
    transferRate: 5.8,
    auditEventsToday: 48,
    maskedExportsToday: 12,
  });

  const voiceThroughput = voiceThroughputPointSchema.array().parse([
    { date: "Mar 28", calls: 1200, answered: 980, completed: 720 },
    { date: "Mar 29", calls: 1450, answered: 1180, completed: 890 },
    { date: "Mar 30", calls: 1100, answered: 890, completed: 650 },
    { date: "Mar 31", calls: 1680, answered: 1390, completed: 1050 },
    { date: "Apr 01", calls: 1520, answered: 1240, completed: 920 },
    { date: "Apr 02", calls: 1750, answered: 1450, completed: 1100 },
    { date: "Apr 03", calls: 1890, answered: 1560, completed: 1200 },
    { date: "Apr 04", calls: 1620, answered: 1320, completed: 980 },
    { date: "Apr 05", calls: 1940, answered: 1610, completed: 1280 },
    { date: "Apr 06", calls: 980, answered: 810, completed: 620 },
  ]);

  const complianceAlerts = complianceAlertSchema.array().parse([
    {
      title: "Quiet hours are approaching",
      detail: "KYC Verification Drive - Mumbai pauses automatically at 21:00 IST.",
      severity: "warning",
    },
    {
      title: "Provider fallback recommended",
      detail: "Loan Eligibility Survey logged 3 Plivo timeout errors in the last hour.",
      severity: "risk",
    },
    {
      title: "Masked export ready",
      detail: "Star Health renewal export completed with sensitive values hidden by default.",
      severity: "info",
    },
  ]);

  const transferQueues = transferQueueSummarySchema.array().parse([
    { queue: "Mumbai review desk", waiting: 4, sla: "2m 10s" },
    { queue: "Renewal specialists", waiting: 2, sla: "1m 35s" },
    { queue: "Loan advisors", waiting: 6, sla: "4m 05s" },
  ]);

  const auditEvents = auditEventSchema.array().parse([
    {
      id: "evt-001",
      actor: "Ankit Mehta",
      action: "Launched campaign",
      entity: "KYC Verification Drive - Mumbai",
      time: "10:08 IST",
    },
    {
      id: "evt-002",
      actor: "Priya Singh",
      action: "Downloaded masked export",
      entity: "Insurance Renewal - Tamil Nadu",
      time: "09:42 IST",
    },
    {
      id: "evt-003",
      actor: "Ravi Kumar",
      action: "Viewed restricted transcript",
      entity: "call-005",
      time: "09:15 IST",
    },
  ]);

  const dispositionBreakdown = dispositionBreakdownItemSchema.array().parse([
    { name: "Data collected", value: 58, fill: "hsl(var(--chart-1))" },
    { name: "No answer", value: 18, fill: "hsl(var(--chart-3))" },
    { name: "Partial", value: 12, fill: "hsl(var(--chart-2))" },
    { name: "Transferred", value: 6, fill: "hsl(var(--chart-4))" },
    { name: "Failed", value: 4, fill: "hsl(var(--chart-5))" },
    { name: "Opted out", value: 2, fill: "hsl(var(--muted-foreground))" },
  ]);

  const fieldDropoff = fieldDropoffSchema.array().parse([
    { field: "Full name", captured: 95, dropped: 5 },
    { field: "PAN number", captured: 82, dropped: 18 },
    { field: "Date of birth", captured: 78, dropped: 22 },
    { field: "Address", captured: 67, dropped: 33 },
  ]);

  const providerPerformance = providerPerformanceSchema.array().parse([
    { date: "Mar 28", exotel: 98.2, plivo: 96.1 },
    { date: "Mar 29", exotel: 97.8, plivo: 95.5 },
    { date: "Mar 30", exotel: 99.1, plivo: 97.2 },
    { date: "Mar 31", exotel: 96.5, plivo: 94.8 },
    { date: "Apr 01", exotel: 98.8, plivo: 96.9 },
    { date: "Apr 02", exotel: 99.2, plivo: 97.5 },
    { date: "Apr 03", exotel: 97.9, plivo: 95.8 },
  ]);

  const workspaceSettings = workspaceSettingsSchema.parse({
    workspaceName: "HDFC Collections",
    defaultLanguage: "hindi",
    callingWindowStart: "09:00",
    callingWindowEnd: "21:00",
    dndChecksEnabled: true,
    quietHoursAutoPause: true,
    restrictFullTranscripts: true,
  });

  const workspaces = workspaceInventorySchema.array().parse([
    { id: "ws-001", name: "HDFC Collections", plan: "Enterprise", members: 24, campaigns: 8 },
    { id: "ws-002", name: "Star Health Insurance", plan: "Business", members: 12, campaigns: 5 },
    { id: "ws-003", name: "Bajaj Finserv", plan: "Enterprise", members: 31, campaigns: 15 },
  ]);

  const teamMembers = teamMemberSchema.array().parse([
    { id: "user-001", name: "Ankit Mehta", email: "ankit@hdfc.com", role: "workspace_admin" },
    { id: "user-002", name: "Priya Singh", email: "priya.s@hdfc.com", role: "campaign_manager" },
    { id: "user-003", name: "Ravi Kumar", email: "ravi.k@hdfc.com", role: "operator" },
    { id: "user-004", name: "Sunita Patel", email: "sunita@hdfc.com", role: "reviewer" },
    { id: "user-005", name: "Deepak Joshi", email: "deepak.j@hdfc.com", role: "viewer" },
  ]);

  const notificationPreferences = notificationPreferenceSchema.array().parse([
    {
      key: "campaign_launched",
      label: "Campaign launched",
      detail: "Notify the team when a campaign starts processing contacts.",
      enabled: true,
    },
    {
      key: "campaign_completed",
      label: "Campaign completed",
      detail: "Notify when all contacts have been processed and exports are ready.",
      enabled: true,
    },
    {
      key: "high_opt_out_rate",
      label: "High opt-out rate",
      detail: "Alert the workspace when opt-out exceeds the configured threshold.",
      enabled: true,
    },
    {
      key: "provider_failure",
      label: "Provider failure",
      detail: "Notify operations when a voice or messaging provider falls below target health.",
      enabled: true,
    },
    {
      key: "export_ready",
      label: "Export ready",
      detail: "Send a message when a masked CSV export is available for download.",
      enabled: true,
    },
  ]);

  const securityControls = securityControlSchema.array().parse([
    {
      title: "Sensitive field encryption",
      body: "AES-256 encryption at rest protects sensitive values before they are written to storage.",
      badge: "Enabled",
    },
    {
      title: "CSV export masking",
      body: "Sensitive fields remain masked by default across client and internal export flows.",
      badge: "Enabled",
    },
    {
      title: "Audit logging",
      body: "Launches, pauses, exports, and transcript access all remain reviewable.",
      badge: "Active",
    },
  ]);

  const apiAccess = apiAccessConfigSchema.parse({
    maskedKey: "bv_live_****************************k8m3",
    webhook: {
      url: "https://client.example.com/webhooks/bharatengage",
      events: ["call.completed", "call.failed", "campaign.completed", "export.ready"],
    },
  });

  const apiKeys = apiKeySummarySchema.array().parse([
    {
      id: "api-key-001",
      name: "Primary production key",
      maskedKey: "bv_live_****************************k8m3",
      createdAt: "2026-03-18T08:30:00.000Z",
      lastUsedAt: "2026-04-05T14:20:00.000Z",
    },
  ]);

  return {
    campaigns,
    contacts,
    callRecords,
    callRecordIdByProviderCallId: {},
    recordingUrlsByCallId,
    journeyCheckpointAtByCampaignId: {
      "camp-001": "2026-04-09T14:45:00.000Z",
      "camp-002": "2026-04-10T04:30:00.000Z",
    },
    transcriptsByCallId,
    collectedDataByCallId,
    journeys,
    dashboardOverview,
    voiceThroughput,
    complianceAlerts,
    transferQueues,
    auditEvents,
    dispositionBreakdown,
    fieldDropoff,
    providerPerformance,
    workspaceSettings,
    workspaces,
    teamMembers,
    notificationPreferences,
    securityControls,
    apiAccess,
    apiKeys,
  };
}
