import { createCampaignRequestSchema, type CreateCampaignRequest } from "@/lib/api-contracts";

const campaignSummaries = [
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
    ],
  },
];

const contacts = [
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
    name: "Mohammed Farooq",
    phone: "+915432109876",
    language: "urdu",
    status: "dnd",
    consent: false,
    workspace: "HDFC Collections",
    source: "Central suppression file",
  },
];

const callRecords = [
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
    fieldsCollected: 2,
    fieldsTotal: 2,
    transcriptMode: "redacted",
  },
  {
    id: "call-002",
    campaignId: "camp-002",
    campaignName: "Insurance Renewal - Tamil Nadu",
    contactName: "Lakshmi Iyer",
    phone: "+916543210987",
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
    id: "call-003",
    campaignId: "camp-003",
    campaignName: "Loan Eligibility Survey - Delhi NCR",
    contactName: "Sneha Reddy",
    phone: "+914321098765",
    provider: "plivo",
    status: "failed",
    disposition: "network_error",
    confirmed: false,
    duration: 12,
    startedAt: "2026-04-02T11:15:00.000Z",
    language: "telugu",
    fieldsCollected: 0,
    fieldsTotal: 1,
    transcriptMode: "none",
    errorCode: "PROVIDER_TIMEOUT",
  },
];

const transcriptsByCallId: Record<string, { speaker: "Bot" | "User" | "System"; text: string }[]> = {
  "call-001": [
    { speaker: "Bot", text: "Namaste. This is HDFC Bank calling regarding your KYC verification." },
    { speaker: "User", text: "Yes, please continue." },
    { speaker: "Bot", text: "May I have your full name as per your PAN card?" },
  ],
  "call-002": [
    { speaker: "Bot", text: "Vanakkam, this is Star Health regarding your renewal." },
    { speaker: "User", text: "Can I speak with an agent?" },
    { speaker: "System", text: "Transferred to renewal specialists." },
  ],
};

const collectedDataByCallId: Record<
  string,
  { fieldKey: string; label: string; value: string; confidenceScore: number; confirmed: boolean; masked: boolean }[]
> = {
  "call-001": [
    { fieldKey: "full_name", label: "Full name", value: "Rajesh Kumar", confidenceScore: 0.99, confirmed: true, masked: false },
    { fieldKey: "pan_number", label: "PAN number", value: "******234F", confidenceScore: 0.97, confirmed: true, masked: true },
  ],
  "call-002": [
    { fieldKey: "policy_number", label: "Policy number", value: "TN-44192", confidenceScore: 0.82, confirmed: false, masked: false },
  ],
};

const dashboardSnapshot = {
  workspace: {
    name: "HDFC Collections",
  },
  viewer: {
    userId: "user-001",
    fullName: "Ankit Mehta",
    email: "ankit@hdfc.com",
    role: "workspace_admin",
  },
  overview: {
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
  },
  voiceThroughput: [
    { date: "Mar 31", calls: 1680, answered: 1390, completed: 1050 },
    { date: "Apr 01", calls: 1520, answered: 1240, completed: 920 },
    { date: "Apr 02", calls: 1750, answered: 1450, completed: 1100 },
  ],
  liveCampaigns: campaignSummaries.filter((campaign) => campaign.status === "active").map((campaign) => ({
    id: campaign.id,
    name: campaign.name,
    status: campaign.status,
    summary: campaign.summary,
    answerRate: campaign.answerRate,
    completionRate: campaign.completionRate,
    confirmationRate: campaign.confirmationRate,
  })),
  complianceAlerts: [
    {
      title: "Quiet hours are approaching",
      detail: "KYC Verification Drive - Mumbai pauses automatically at 21:00 IST.",
      severity: "warning",
    },
  ],
  transferQueues: [
    { queue: "Mumbai review desk", waiting: 4, sla: "2m 10s" },
    { queue: "Renewal specialists", waiting: 2, sla: "1m 35s" },
  ],
  auditEvents: [
    {
      id: "evt-001",
      actor: "Ankit Mehta",
      action: "Launched campaign",
      entity: "KYC Verification Drive - Mumbai",
      time: "10:08 IST",
    },
  ],
  dispositionBreakdown: [
    { name: "Data collected", value: 58, fill: "hsl(var(--chart-1))" },
    { name: "No answer", value: 18, fill: "hsl(var(--chart-3))" },
    { name: "Transferred", value: 6, fill: "hsl(var(--chart-4))" },
  ],
  recentAttempts: [
    {
      id: "call-001",
      contactName: "Rajesh Kumar",
      phone: "+919876543210",
      campaignName: "KYC Verification Drive - Mumbai",
      provider: "exotel",
      status: "completed",
      durationSeconds: 245,
    },
  ],
};

const journeys = [
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
];

const journeyConfigsByCampaignId = {
  "camp-001": {
    unansweredAction: "sms",
    partialAction: "whatsapp",
    retryWindowHours: 4,
    maxRetries: 3,
    concurrencyLimit: 50,
    pacingPerMinute: 20,
    csvSource: "March KYC upload",
  },
  "camp-002": {
    unansweredAction: "none",
    partialAction: "whatsapp",
    retryWindowHours: 6,
    maxRetries: 2,
    concurrencyLimit: 28,
    pacingPerMinute: 14,
    csvSource: "Renewal batch 02",
  },
  "camp-003": {
    unansweredAction: "sms",
    partialAction: "whatsapp",
    retryWindowHours: 8,
    maxRetries: 3,
    concurrencyLimit: 32,
    pacingPerMinute: 12,
    csvSource: "Lead nurture sync",
  },
};

const campaignIntroScriptsById: Record<string, string> = {
  "camp-001": "Namaste. This is HDFC Bank calling to refresh your KYC details for continued account servicing.",
  "camp-002": "Vanakkam. This is Star Health calling regarding your upcoming policy renewal.",
  "camp-003": "Hello, this is Bajaj Finserv calling to confirm a few details for your eligibility review.",
};

function parseQuietHours(value: string) {
  const match = value.match(/(?<start>\d{2}:\d{2})\s+to\s+(?<end>\d{2}:\d{2})/u);

  return {
    start: match?.groups?.start ?? "09:00",
    end: match?.groups?.end ?? "21:00",
  };
}

const campaigns = campaignSummaries.map((campaign) => {
  const quietHours = parseQuietHours(campaign.quietHours);
  const transferEnabled = campaign.transferQueue !== "No transfer queue";

  return {
    ...campaign,
    setup: {
      campaignName: campaign.name,
      vertical: campaign.vertical,
      language: campaign.language,
      callerIdentity: campaign.callerIdentity,
      introScript: campaignIntroScriptsById[campaign.id] ?? `Hello, this is ${campaign.callerIdentity} calling about your active workflow.`,
      purposeStatement: campaign.summary,
      callingWindowStart: quietHours.start,
      callingWindowEnd: quietHours.end,
      transferEnabled,
      transferQueue: transferEnabled ? campaign.transferQueue : "",
    },
    journey: structuredClone(
      journeyConfigsByCampaignId[campaign.id as keyof typeof journeyConfigsByCampaignId] ?? {
        unansweredAction: "none",
        partialAction: "none",
        retryWindowHours: 0,
        maxRetries: 0,
        concurrencyLimit: 1,
        pacingPerMinute: 1,
        csvSource: "Manual upload",
      },
    ),
  };
});

const reportsSnapshot = {
  overview: dashboardSnapshot.overview,
  dailyVolume: dashboardSnapshot.voiceThroughput,
  fieldDropoff: [
    { field: "Full name", captured: 95, dropped: 5 },
    { field: "PAN number", captured: 82, dropped: 18 },
  ],
  providerPerformance: [
    { date: "Mar 31", exotel: 96.5, plivo: 94.8 },
    { date: "Apr 01", exotel: 98.8, plivo: 96.9 },
  ],
  dispositionBreakdown: dashboardSnapshot.dispositionBreakdown,
};

const settingsSnapshot = {
  workspaceSettings: {
    workspaceName: "HDFC Collections",
    defaultLanguage: "hindi",
    callingWindowStart: "09:00",
    callingWindowEnd: "21:00",
    dndChecksEnabled: true,
    quietHoursAutoPause: true,
    restrictFullTranscripts: true,
  },
  workspaces: [
    { id: "ws-001", name: "HDFC Collections", plan: "Enterprise", members: 24, campaigns: 8 },
    { id: "ws-002", name: "Star Health Insurance", plan: "Business", members: 12, campaigns: 5 },
  ],
  teamMembers: [
    { id: "user-001", name: "Ankit Mehta", email: "ankit@hdfc.com", role: "workspace_admin" },
    { id: "user-002", name: "Priya Singh", email: "priya.s@hdfc.com", role: "campaign_manager" },
  ],
  securityControls: [
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
  ],
  notificationPreferences: [
    {
      key: "campaign_launched",
      label: "Campaign launched",
      detail: "Notify the team when a campaign starts processing contacts.",
      enabled: true,
    },
    {
      key: "provider_failure",
      label: "Provider failure",
      detail: "Notify operations when a voice or messaging provider falls below target health.",
      enabled: true,
    },
  ],
  apiAccess: {
    maskedKey: "bv_live_****************************k8m3",
    webhook: {
      url: "https://client.example.com/webhooks/bharatengage",
      events: ["call.completed", "call.failed", "campaign.completed", "export.ready"],
    },
  },
  apiKeys: [
    {
      id: "api-key-001",
      name: "Primary production key",
      maskedKey: "bv_live_****************************k8m3",
      createdAt: "2026-03-18T08:30:00.000Z",
      lastUsedAt: "2026-04-05T14:20:00.000Z",
    },
  ],
};

let mockCampaigns = structuredClone(campaigns);
let mockContacts = structuredClone(contacts);
let mockCallRecords = structuredClone(callRecords);
let mockTranscriptsByCallId = structuredClone(transcriptsByCallId);
let mockCollectedDataByCallId = structuredClone(collectedDataByCallId);
let mockJourneys = structuredClone(journeys);
let mockJourneyConfigsByCampaignId = structuredClone(journeyConfigsByCampaignId);
let mockReportsSnapshot = structuredClone(reportsSnapshot);
let mockSettingsSnapshot = structuredClone(settingsSnapshot);
let mockDashboardSnapshot = structuredClone(dashboardSnapshot);

function syncMockDerivedState() {
  mockDashboardSnapshot.workspace.name = mockSettingsSnapshot.workspaceSettings.workspaceName;
  mockDashboardSnapshot.overview.totalContacts = mockContacts.length;
  mockDashboardSnapshot.overview.totalCampaigns = mockCampaigns.length;
  mockDashboardSnapshot.overview.activeCampaigns = mockCampaigns.filter((campaign) => campaign.status === "active").length;
  mockDashboardSnapshot.liveCampaigns = mockCampaigns
    .filter((campaign) => campaign.status === "active")
    .map((campaign) => ({
      id: campaign.id,
      name: campaign.name,
      status: campaign.status,
      summary: campaign.summary,
      answerRate: campaign.answerRate,
      completionRate: campaign.completionRate,
      confirmationRate: campaign.confirmationRate,
    }));

  if (mockSettingsSnapshot.workspaces[0]) {
    mockSettingsSnapshot.workspaces[0] = {
      ...mockSettingsSnapshot.workspaces[0],
      name: mockSettingsSnapshot.workspaceSettings.workspaceName,
      members: mockSettingsSnapshot.teamMembers.length,
      campaigns: mockCampaigns.length,
    };
  }
}

export function resetMockApiState() {
  mockCampaigns = structuredClone(campaigns);
  mockContacts = structuredClone(contacts);
  mockCallRecords = structuredClone(callRecords);
  mockTranscriptsByCallId = structuredClone(transcriptsByCallId);
  mockCollectedDataByCallId = structuredClone(collectedDataByCallId);
  mockJourneys = structuredClone(journeys);
  mockJourneyConfigsByCampaignId = structuredClone(journeyConfigsByCampaignId);
  mockReportsSnapshot = structuredClone(reportsSnapshot);
  mockSettingsSnapshot = structuredClone(settingsSnapshot);
  mockDashboardSnapshot = structuredClone(dashboardSnapshot);
  syncMockDerivedState();
}

resetMockApiState();

function normalizePhoneNumber(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }

  const withoutFormatting = trimmed.replace(/[\s()-]/g, "");

  if (withoutFormatting.startsWith("+")) {
    const digits = withoutFormatting.slice(1).replace(/\D/g, "");
    return digits ? `+${digits}` : "";
  }

  if (withoutFormatting.startsWith("00")) {
    const digits = withoutFormatting.slice(2).replace(/\D/g, "");
    return digits ? `+${digits}` : "";
  }

  const digits = withoutFormatting.replace(/\D/g, "");

  if (digits.length === 10) {
    return `+91${digits}`;
  }

  if (digits.length > 10) {
    return `+${digits}`;
  }

  return digits;
}

function createSequencePreview(input: {
  readonly unansweredAction: string;
  readonly partialAction: string;
}) {
  const sequence = ["Voice first"];

  if (input.unansweredAction === "sms") {
    sequence.push("SMS if unanswered");
  } else if (input.unansweredAction === "whatsapp") {
    sequence.push("WhatsApp if unanswered");
  } else if (input.unansweredAction === "retry") {
    sequence.push("Retry voice if unanswered");
  }

  if (input.partialAction === "sms") {
    sequence.push("SMS if partial");
  } else if (input.partialAction === "whatsapp") {
    sequence.push("WhatsApp if partial");
  } else if (input.partialAction === "retry") {
    sequence.push("Retry voice if partial");
  }

  return sequence;
}

function createMockCampaignId() {
  return `camp-${String(mockCampaigns.length + 1).padStart(3, "0")}-${Date.now()}`;
}

function createMockJourneyId() {
  return `jrn-${String(mockJourneys.length + 1).padStart(3, "0")}-${Date.now()}`;
}

function createMockUserId() {
  return `user-${String(mockSettingsSnapshot.teamMembers.length + 1).padStart(3, "0")}-${Date.now()}`;
}

function createMockApiKeyId() {
  return `api-key-${String(mockSettingsSnapshot.apiKeys.length + 1).padStart(3, "0")}-${Date.now()}`;
}

function maskMockApiKey(prefix: string) {
  return `${prefix}************************`;
}

function buildMockCampaignFromRequest(
  campaignId: string,
  body: CreateCampaignRequest,
  currentCampaign?: (typeof mockCampaigns)[number],
) {
  return {
    id: campaignId,
    name: body.setup.campaignName,
    status: currentCampaign?.status ?? "draft",
    language: body.setup.language,
    vertical: body.setup.vertical,
    template: `${body.setup.vertical} workflow`,
    workspace: mockSettingsSnapshot.workspaceSettings.workspaceName,
    callerIdentity: body.setup.callerIdentity,
    summary: body.setup.purposeStatement,
    contactCount: currentCampaign?.contactCount ?? 0,
    completionRate: currentCampaign?.completionRate ?? 0,
    answerRate: currentCampaign?.answerRate ?? 0,
    confirmationRate: currentCampaign?.confirmationRate ?? 0,
    createdAt: currentCampaign?.createdAt ?? new Date().toISOString(),
    launchedAt: currentCampaign?.launchedAt,
    quietHours: `${body.setup.callingWindowStart} to ${body.setup.callingWindowEnd} IST`,
    transferQueue: body.setup.transferEnabled ? body.setup.transferQueue : "No transfer queue",
    sensitiveFieldCount: body.fields.filter((field) => field.sensitive).length,
    sequence: createSequencePreview(body.journey),
    fields: structuredClone(body.fields),
    setup: structuredClone({
      ...body.setup,
      transferQueue: body.setup.transferEnabled ? body.setup.transferQueue : "",
    }),
    journey: structuredClone(body.journey),
  };
}

function syncJourneyForCampaign(
  campaign: (typeof mockCampaigns)[number],
  journeyConfig: {
    readonly retryWindowHours: number;
    readonly concurrencyLimit: number;
    readonly pacingPerMinute: number;
  },
) {
  const journeyIndex = mockJourneys.findIndex((journey) => journey.campaignId === campaign.id);
  const nextCheckpoint =
    campaign.status === "active" ? "Tonight 20:15 IST" : campaign.status === "paused" ? "Paused" : "Not scheduled";
  const nextJourney = {
    id: mockJourneys[journeyIndex]?.id ?? createMockJourneyId(),
    campaignId: campaign.id,
    campaignName: campaign.name,
    sequence: structuredClone(campaign.sequence),
    status: campaign.status === "active" ? "active" : campaign.status === "paused" ? "paused" : "completed",
    totalContacts: campaign.contactCount,
    processed: mockJourneys[journeyIndex]?.processed ?? 0,
    successRate: campaign.completionRate,
    retryWindowHours: journeyConfig.retryWindowHours,
    concurrencyLimit: journeyConfig.concurrencyLimit,
    pacingPerMinute: journeyConfig.pacingPerMinute,
    nextCheckpoint,
  };

  if (journeyIndex === -1) {
    mockJourneys.unshift(nextJourney);
    return;
  }

  mockJourneys[journeyIndex] = nextJourney;
}

function countWorkspaceAdmins() {
  return mockSettingsSnapshot.teamMembers.filter((member) => member.role === "workspace_admin").length;
}

function getRequestMethod(input: string | URL | Request, init?: RequestInit) {
  if (input instanceof Request) {
    return input.method.toUpperCase();
  }

  return (init?.method ?? "GET").toUpperCase();
}

async function readRequestJsonBody<T>(input: string | URL | Request, init?: RequestInit): Promise<T | null> {
  if (input instanceof Request) {
    try {
      return (await input.clone().json()) as T;
    } catch {
      return null;
    }
  }

  if (typeof init?.body !== "string") {
    return null;
  }

  try {
    return JSON.parse(init.body) as T;
  } catch {
    return null;
  }
}

function createResponse(status: number, body: unknown, init?: { readonly headers?: Record<string, string> }) {
  const headers = new Headers(init?.headers);
  const serializedBody = typeof body === "string" ? body : JSON.stringify(body);

  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    headers,
    json: async () => {
      if (typeof body === "string") {
        throw new Error("Response body is not JSON.");
      }

      return body;
    },
    text: async () => serializedBody,
    blob: async () => new Blob([serializedBody], { type: headers.get("Content-Type") ?? "text/plain" }),
  } as Response);
}

function jsonResponse(status: number, body: unknown) {
  return createResponse(status, body, {
    headers: {
      "Content-Type": "application/json",
    },
  });
}

function createValidationErrorResponse(message: string, issues?: unknown) {
  return jsonResponse(400, {
    error: {
      code: "validation_error",
      message,
      ...(typeof issues === "undefined" ? {} : { issues }),
    },
  });
}

function csvResponse(filename: string, body: string) {
  return createResponse(200, body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

function createListResponse<TItem>(items: TItem[]) {
  return {
    data: items,
    meta: {
      total: items.length,
    },
  };
}

function toCsv(headers: string[], rows: Array<Array<string | number | boolean | null | undefined>>) {
  const escape = (value: string | number | boolean | null | undefined) => {
    if (value === null || typeof value === "undefined") {
      return "";
    }

    const normalized = String(value).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    return /[",\n]/u.test(normalized) ? `"${normalized.replace(/"/g, "\"\"")}"` : normalized;
  };

  return [headers.map(escape).join(","), ...rows.map((row) => row.map(escape).join(","))].join("\r\n");
}

function filterCampaigns(url: URL) {
  const search = url.searchParams.get("search")?.trim().toLowerCase() ?? "";
  const status = url.searchParams.get("status");

  return mockCampaigns.filter((campaign) => {
    const matchesStatus = !status || status === "all" || campaign.status === status;
    const matchesSearch =
      !search ||
      campaign.name.toLowerCase().includes(search) ||
      campaign.vertical.toLowerCase().includes(search) ||
      campaign.template.toLowerCase().includes(search);

    return matchesStatus && matchesSearch;
  });
}

function toCampaignSummary(campaign: (typeof campaigns)[number]) {
  const { setup: _setup, journey: _journey, ...summary } = campaign;
  return summary;
}

function filterContacts(url: URL) {
  const search = url.searchParams.get("search")?.trim().toLowerCase() ?? "";
  const status = url.searchParams.get("status");

  return mockContacts.filter((contact) => {
    const matchesStatus = !status || status === "all" || contact.status === status;
    const matchesSearch =
      !search ||
      contact.name.toLowerCase().includes(search) ||
      contact.phone.includes(search) ||
      contact.workspace.toLowerCase().includes(search) ||
      contact.source.toLowerCase().includes(search);

    return matchesStatus && matchesSearch;
  });
}

function filterCallRecords(url: URL) {
  const search = url.searchParams.get("search")?.trim().toLowerCase() ?? "";
  const status = url.searchParams.get("status");
  const campaignId = url.searchParams.get("campaignId");

  return mockCallRecords.filter((record) => {
    const matchesStatus = !status || status === "all" || record.status === status;
    const matchesCampaign = !campaignId || record.campaignId === campaignId;
    const matchesSearch =
      !search ||
      record.contactName.toLowerCase().includes(search) ||
      record.phone.includes(search) ||
      record.campaignName.toLowerCase().includes(search) ||
      record.provider.toLowerCase().includes(search);

    return matchesStatus && matchesCampaign && matchesSearch;
  });
}

export async function mockApiFetch(input: string | URL | Request, init?: RequestInit) {
  const requestUrl = input instanceof Request ? input.url : input.toString();
  const url = new URL(requestUrl, "http://localhost");
  const pathname = url.pathname;
  const method = getRequestMethod(input, init);

  if (pathname === "/api/dashboard") {
    return jsonResponse(200, { data: mockDashboardSnapshot });
  }

  if (pathname === "/api/campaigns" && method === "GET") {
    return jsonResponse(200, createListResponse(filterCampaigns(url).map(toCampaignSummary)));
  }

  if (pathname === "/api/campaigns" && method === "POST") {
    const body = await readRequestJsonBody<CreateCampaignRequest>(input, init);

    if (!body) {
      return createValidationErrorResponse("Request body is required.");
    }

    const parsedBody = createCampaignRequestSchema.safeParse(body);

    if (!parsedBody.success) {
      return createValidationErrorResponse("The request payload did not match the expected schema.", parsedBody.error.flatten());
    }

    const campaignId = createMockCampaignId();
    const campaign = buildMockCampaignFromRequest(campaignId, parsedBody.data);

    mockCampaigns.unshift(campaign);
    mockJourneyConfigsByCampaignId[campaignId] = structuredClone(parsedBody.data.journey);
    syncMockDerivedState();

    return jsonResponse(201, { data: campaign });
  }

  const campaignActionMatch = pathname.match(/^\/api\/campaigns\/([^/]+)\/(launch|pause|resume)$/u);

  if (campaignActionMatch && method === "POST") {
    const [, campaignId, action] = campaignActionMatch;
    const campaignIndex = mockCampaigns.findIndex((entry) => entry.id === campaignId);

    if (campaignIndex === -1) {
      return jsonResponse(404, { error: { code: "campaign_not_found", message: "Campaign not found." } });
    }

    const currentCampaign = mockCampaigns[campaignIndex];

    if (!currentCampaign) {
      return jsonResponse(404, { error: { code: "campaign_not_found", message: "Campaign not found." } });
    }

    if (action === "launch" && currentCampaign.status === "active") {
      return jsonResponse(409, { error: { code: "campaign_already_active", message: "Campaign is already active." } });
    }

    if (action === "launch" && currentCampaign.status === "completed") {
      return jsonResponse(409, { error: { code: "campaign_completed", message: "Completed campaigns cannot be relaunched." } });
    }

    if (action === "pause" && currentCampaign.status !== "active") {
      return jsonResponse(409, { error: { code: "campaign_not_active", message: "Only active campaigns can be paused." } });
    }

    if (action === "resume" && currentCampaign.status !== "paused") {
      return jsonResponse(409, { error: { code: "campaign_not_paused", message: "Only paused campaigns can be resumed." } });
    }

    const nextStatus = action === "pause" ? "paused" : "active";
    const updatedCampaign = {
      ...currentCampaign,
      status: nextStatus,
      launchedAt: nextStatus === "active" ? new Date().toISOString() : currentCampaign.launchedAt,
    };

    mockCampaigns[campaignIndex] = updatedCampaign;

    const journeyConfig = mockJourneyConfigsByCampaignId[campaignId] ?? {
      retryWindowHours: 4,
      concurrencyLimit: 20,
      pacingPerMinute: 10,
    };

    syncJourneyForCampaign(updatedCampaign, journeyConfig);
    syncMockDerivedState();

    return jsonResponse(200, { data: updatedCampaign });
  }

  const campaignIdMatch = pathname.match(/^\/api\/campaigns\/([^/]+)$/u);

  if (campaignIdMatch && method === "GET") {
    const [, campaignId] = campaignIdMatch;
    const campaign = mockCampaigns.find((entry) => entry.id === campaignId);

    return campaign
      ? jsonResponse(200, { data: campaign })
      : jsonResponse(404, { error: { code: "campaign_not_found", message: "Campaign not found." } });
  }

  if (campaignIdMatch && method === "PUT") {
    const [, campaignId] = campaignIdMatch;
    const body = await readRequestJsonBody<CreateCampaignRequest>(input, init);
    const campaignIndex = mockCampaigns.findIndex((entry) => entry.id === campaignId);

    if (campaignIndex === -1) {
      return jsonResponse(404, { error: { code: "campaign_not_found", message: "Campaign not found." } });
    }

    if (!body) {
      return createValidationErrorResponse("Request body is required.");
    }

    const currentCampaign = mockCampaigns[campaignIndex];

    if (!currentCampaign) {
      return jsonResponse(404, { error: { code: "campaign_not_found", message: "Campaign not found." } });
    }

    if (currentCampaign.status === "completed") {
      return jsonResponse(409, { error: { code: "campaign_completed", message: "Completed campaigns cannot be edited." } });
    }

    const parsedBody = createCampaignRequestSchema.safeParse(body);

    if (!parsedBody.success) {
      return createValidationErrorResponse("The request payload did not match the expected schema.", parsedBody.error.flatten());
    }

    const updatedCampaign = buildMockCampaignFromRequest(campaignId, parsedBody.data, currentCampaign);
    mockCampaigns[campaignIndex] = updatedCampaign;
    mockJourneyConfigsByCampaignId[campaignId] = structuredClone(parsedBody.data.journey);
    mockCallRecords = mockCallRecords.map((record) =>
      record.campaignId === campaignId
        ? {
            ...record,
            campaignName: updatedCampaign.name,
            language: updatedCampaign.language,
          }
        : record,
    );

    if (updatedCampaign.status === "active" || updatedCampaign.status === "paused") {
      syncJourneyForCampaign(updatedCampaign, parsedBody.data.journey);
    }

    syncMockDerivedState();
    return jsonResponse(200, { data: updatedCampaign });
  }

  if (pathname === "/api/contacts" && method === "GET") {
    return jsonResponse(200, createListResponse(filterContacts(url)));
  }

  if (pathname === "/api/contacts/import" && method === "POST") {
    const body = await readRequestJsonBody<{
      readonly filename: string;
      readonly csvText: string;
      readonly source?: string;
      readonly defaultLanguage?: string;
      readonly defaultConsent?: boolean;
    }>(input, init);

    if (!body) {
      return jsonResponse(400, { error: { code: "validation_error", message: "Request body is required." } });
    }

    const [headerLine = "", ...rowLines] = body.csvText.split(/\r?\n/u).filter((line) => line.trim().length > 0);
    const headers = headerLine.split(",").map((header) => header.trim().toLowerCase());
    const nameIndex = headers.findIndex((header) => header === "name" || header === "full_name" || header === "contact_name");
    const phoneIndex = headers.findIndex(
      (header) => header === "phone" || header === "phone_number" || header === "mobile" || header === "mobile_number",
    );
    const emailIndex = headers.findIndex((header) => header === "email" || header === "email_address");
    const languageIndex = headers.findIndex((header) => header === "language" || header === "lang");
    const consentIndex = headers.findIndex((header) => header === "consent" || header === "has_consent" || header === "opt_in");
    const sourceIndex = headers.findIndex((header) => header === "source" || header === "campaign_source" || header === "upload_source");

    if (nameIndex === -1 || phoneIndex === -1) {
      return jsonResponse(400, {
        error: { code: "contact_import_missing_columns", message: "The CSV must include name and phone columns." },
      });
    }

    let imported = 0;
    let duplicates = 0;
    let invalid = 0;
    const seenPhones = new Set<string>();

    for (const rowLine of rowLines) {
      const cells = rowLine.split(",").map((cell) => cell.trim());
      const name = cells[nameIndex] ?? "";
      const normalizedPhone = normalizePhoneNumber(cells[phoneIndex] ?? "");

      if (!name || normalizedPhone.length < 10) {
        invalid += 1;
        continue;
      }

      if (seenPhones.has(normalizedPhone) || mockContacts.some((contact) => contact.phone === normalizedPhone)) {
        duplicates += 1;
        continue;
      }

      seenPhones.add(normalizedPhone);
      imported += 1;
      mockContacts.unshift({
        id: `contact-import-${mockContacts.length + imported}`,
        name,
        phone: normalizedPhone,
        email: cells[emailIndex] || undefined,
        language: cells[languageIndex] || body.defaultLanguage || "english",
        status: "eligible",
        consent:
          consentIndex >= 0
            ? ["true", "yes", "1", "y"].includes((cells[consentIndex] ?? "").toLowerCase())
            : body.defaultConsent ?? true,
        workspace: mockSettingsSnapshot.workspaceSettings.workspaceName,
        source: cells[sourceIndex] || body.source || body.filename,
      });
    }

    syncMockDerivedState();

    return jsonResponse(201, {
      data: {
        jobId: "mock-import-job",
        imported,
        skipped: duplicates + invalid,
        duplicates,
        invalid,
      },
    });
  }

  if (pathname.startsWith("/api/contacts/") && method === "PUT") {
    const contactId = pathname.replace("/api/contacts/", "");
    const body = await readRequestJsonBody<{
      readonly name: string;
      readonly phone: string;
      readonly email?: string;
      readonly language: string;
      readonly consent: boolean;
      readonly source: string;
    }>(input, init);
    const index = mockContacts.findIndex((contact) => contact.id === contactId);

    if (index === -1 || !body) {
      return jsonResponse(404, { error: { code: "contact_not_found", message: "Contact not found." } });
    }

    const normalizedPhone = normalizePhoneNumber(body.phone);
    const duplicate = mockContacts.find((contact) => contact.phone === normalizedPhone && contact.id !== contactId);

    if (duplicate) {
      return jsonResponse(409, { error: { code: "contact_phone_exists", message: "Phone already exists." } });
    }

    mockContacts[index] = {
      ...mockContacts[index],
      name: body.name,
      phone: normalizedPhone,
      email: body.email,
      language: body.language,
      consent: body.consent,
      source: body.source,
    } as (typeof mockContacts)[number];

    return jsonResponse(200, { data: mockContacts[index] });
  }

  if (pathname.endsWith("/do-not-call") && method === "POST") {
    const contactId = pathname.replace("/api/contacts/", "").replace("/do-not-call", "");
    const index = mockContacts.findIndex((contact) => contact.id === contactId);

    if (index === -1) {
      return jsonResponse(404, { error: { code: "contact_not_found", message: "Contact not found." } });
    }

    mockContacts[index] = {
      ...mockContacts[index],
      status: "dnd",
    };

    return jsonResponse(200, { data: mockContacts[index] });
  }

  if (pathname.startsWith("/api/contacts/") && method === "DELETE") {
    const contactId = pathname.replace("/api/contacts/", "");
    const nextContacts = mockContacts.filter((contact) => contact.id !== contactId);

    if (nextContacts.length === mockContacts.length) {
      return jsonResponse(404, { error: { code: "contact_not_found", message: "Contact not found." } });
    }

    mockContacts = nextContacts;
    syncMockDerivedState();
    return createResponse(204, "");
  }

  if (pathname === "/api/contacts/export.csv") {
    const filteredContacts = filterContacts(url);

    return csvResponse(
      "contacts-export.csv",
      toCsv(
        ["id", "name", "phone", "email", "language", "status", "consent", "workspace", "source", "campaign_id", "last_contacted_at"],
        filteredContacts.map((contact) => [
          contact.id,
          contact.name,
          contact.phone,
          contact.email,
          contact.language,
          contact.status,
          contact.consent,
          contact.workspace,
          contact.source,
          contact.campaignId,
          contact.lastContactedAt,
        ]),
      ),
    );
  }

  if (pathname === "/api/journeys") {
    return jsonResponse(200, createListResponse(mockJourneys));
  }

  const journeyIdMatch = pathname.match(/^\/api\/journeys\/([^/]+)$/u);

  if (journeyIdMatch) {
    const [, journeyId] = journeyIdMatch;
    const journey = mockJourneys.find((entry) => entry.id === journeyId);

    return journey
      ? jsonResponse(200, { data: journey })
      : jsonResponse(404, { error: { code: "journey_not_found", message: "Journey not found." } });
  }

  if (pathname === "/api/call-records") {
    return jsonResponse(200, createListResponse(filterCallRecords(url)));
  }

  if (pathname === "/api/call-records/export.csv") {
    const filteredCallRecords = filterCallRecords(url);

    return csvResponse(
      "call-records-export.csv",
      toCsv(
        [
          "id",
          "campaign_id",
          "campaign_name",
          "contact_name",
          "phone",
          "provider",
          "status",
          "disposition",
          "confirmed",
          "duration_seconds",
          "started_at",
          "language",
          "fields_collected",
          "fields_total",
          "transcript_mode",
          "error_code",
        ],
        filteredCallRecords.map((record) => [
          record.id,
          record.campaignId,
          record.campaignName,
          record.contactName,
          record.phone,
          record.provider,
          record.status,
          record.disposition,
          record.confirmed,
          record.duration,
          record.startedAt,
          record.language,
          record.fieldsCollected,
          record.fieldsTotal,
          record.transcriptMode,
          record.errorCode,
        ]),
      ),
    );
  }

  if (pathname.endsWith("/transcript")) {
    const callId = pathname.replace("/api/call-records/", "").replace("/transcript", "");
    const transcript = mockTranscriptsByCallId[callId];
    return transcript
      ? jsonResponse(200, { data: transcript })
      : jsonResponse(404, { error: { code: "transcript_not_found", message: "Transcript not found." } });
  }

  if (pathname.endsWith("/data")) {
    const callId = pathname.replace("/api/call-records/", "").replace("/data", "");
    const collectedData = mockCollectedDataByCallId[callId];
    return collectedData
      ? jsonResponse(200, { data: collectedData })
      : jsonResponse(404, { error: { code: "collected_data_not_found", message: "Collected data not found." } });
  }

  if (pathname === "/api/reports") {
    return jsonResponse(200, { data: mockReportsSnapshot });
  }

  if (pathname === "/api/reports/export.csv") {
    return csvResponse(
      "reports-export.csv",
      toCsv(
        ["section", "item", "metric", "value"],
        [
          ["overview", "answer_rate", "value", mockReportsSnapshot.overview.avgAnswerRate],
          ["overview", "completion_rate", "value", mockReportsSnapshot.overview.avgCompletionRate],
          ["overview", "confirmation_rate", "value", mockReportsSnapshot.overview.avgConfirmationRate],
          ...mockReportsSnapshot.dailyVolume.flatMap((point) => [
            ["daily_volume", point.date, "calls", point.calls],
            ["daily_volume", point.date, "answered", point.answered],
            ["daily_volume", point.date, "completed", point.completed],
          ]),
        ],
      ),
    );
  }

  if (pathname === "/api/settings") {
    return jsonResponse(200, { data: mockSettingsSnapshot });
  }

  if (pathname === "/api/settings/workspace" && method === "PATCH") {
    const body = await readRequestJsonBody<typeof mockSettingsSnapshot.workspaceSettings>(input, init);

    if (!body) {
      return jsonResponse(400, { error: { code: "validation_error", message: "Request body is required." } });
    }

    mockSettingsSnapshot.workspaceSettings = structuredClone(body);
    mockCampaigns = mockCampaigns.map((campaign) => ({
      ...campaign,
      workspace: body.workspaceName,
    }));
    mockContacts = mockContacts.map((contact) => ({
      ...contact,
      workspace: body.workspaceName,
    }));
    syncMockDerivedState();

    return jsonResponse(200, { data: mockSettingsSnapshot });
  }

  if (pathname === "/api/settings/notifications" && method === "PATCH") {
    const body = await readRequestJsonBody<{
      readonly preferences: Array<{ readonly key: string; readonly enabled: boolean }>;
    }>(input, init);

    if (!body) {
      return jsonResponse(400, { error: { code: "validation_error", message: "Request body is required." } });
    }

    for (const preference of body.preferences) {
      const index = mockSettingsSnapshot.notificationPreferences.findIndex((entry) => entry.key === preference.key);

      if (index === -1) {
        mockSettingsSnapshot.notificationPreferences.push({
          key: preference.key,
          label: preference.key,
          detail: "Workspace notification preference.",
          enabled: preference.enabled,
        });
        continue;
      }

      mockSettingsSnapshot.notificationPreferences[index] = {
        ...mockSettingsSnapshot.notificationPreferences[index],
        enabled: preference.enabled,
      };
    }

    return jsonResponse(200, { data: mockSettingsSnapshot });
  }

  if (pathname === "/api/settings/webhook" && method === "PATCH") {
    const body = await readRequestJsonBody<typeof mockSettingsSnapshot.apiAccess.webhook>(input, init);

    if (!body) {
      return jsonResponse(400, { error: { code: "validation_error", message: "Request body is required." } });
    }

    mockSettingsSnapshot.apiAccess = {
      ...mockSettingsSnapshot.apiAccess,
      webhook: structuredClone(body),
    };

    return jsonResponse(200, { data: mockSettingsSnapshot });
  }

  if (pathname === "/api/settings/team/invite" && method === "POST") {
    const body = await readRequestJsonBody<{
      readonly name: string;
      readonly email: string;
      readonly role: (typeof mockSettingsSnapshot.teamMembers)[number]["role"];
    }>(input, init);

    if (!body) {
      return jsonResponse(400, { error: { code: "validation_error", message: "Request body is required." } });
    }

    const normalizedEmail = body.email.trim().toLowerCase();

    if (mockSettingsSnapshot.teamMembers.some((member) => member.email.toLowerCase() === normalizedEmail)) {
      return jsonResponse(409, { error: { code: "team_member_exists", message: "Team member already exists." } });
    }

    mockSettingsSnapshot.teamMembers.push({
      id: createMockUserId(),
      name: body.name.trim(),
      email: normalizedEmail,
      role: body.role,
    });
    syncMockDerivedState();

    return jsonResponse(201, { data: mockSettingsSnapshot });
  }

  const teamRoleMatch = pathname.match(/^\/api\/settings\/team\/([^/]+)\/role$/u);

  if (teamRoleMatch && method === "PUT") {
    const [, userId] = teamRoleMatch;
    const body = await readRequestJsonBody<{
      readonly role: (typeof mockSettingsSnapshot.teamMembers)[number]["role"];
    }>(input, init);
    const memberIndex = mockSettingsSnapshot.teamMembers.findIndex((member) => member.id === userId);

    if (memberIndex === -1) {
      return jsonResponse(404, { error: { code: "team_member_not_found", message: "Team member not found." } });
    }

    if (!body) {
      return jsonResponse(400, { error: { code: "validation_error", message: "Request body is required." } });
    }

    const currentMember = mockSettingsSnapshot.teamMembers[memberIndex];

    if (currentMember?.role === "workspace_admin" && body.role !== "workspace_admin" && countWorkspaceAdmins() === 1) {
      return jsonResponse(409, { error: { code: "last_workspace_admin", message: "At least one workspace admin must remain assigned." } });
    }

    mockSettingsSnapshot.teamMembers[memberIndex] = {
      ...mockSettingsSnapshot.teamMembers[memberIndex],
      role: body.role,
    };

    return jsonResponse(200, { data: mockSettingsSnapshot });
  }

  const teamMemberMatch = pathname.match(/^\/api\/settings\/team\/([^/]+)$/u);

  if (teamMemberMatch && method === "DELETE") {
    const [, userId] = teamMemberMatch;
    const member = mockSettingsSnapshot.teamMembers.find((entry) => entry.id === userId);

    if (!member) {
      return jsonResponse(404, { error: { code: "team_member_not_found", message: "Team member not found." } });
    }

    if (member.role === "workspace_admin" && countWorkspaceAdmins() === 1) {
      return jsonResponse(409, { error: { code: "last_workspace_admin", message: "At least one workspace admin must remain assigned." } });
    }

    mockSettingsSnapshot.teamMembers = mockSettingsSnapshot.teamMembers.filter((entry) => entry.id !== userId);
    syncMockDerivedState();

    return jsonResponse(200, { data: mockSettingsSnapshot });
  }

  if (pathname === "/api/settings/api-keys" && method === "GET") {
    return jsonResponse(200, createListResponse(mockSettingsSnapshot.apiKeys));
  }

  if (pathname === "/api/settings/api-keys" && method === "POST") {
    const body = await readRequestJsonBody<{ readonly name: string }>(input, init);

    if (!body) {
      return jsonResponse(400, { error: { code: "validation_error", message: "Request body is required." } });
    }

    const rawKey = `bv_live_mock_${Date.now()}`;
    const maskedKey = maskMockApiKey(rawKey.slice(0, 12));
    const createdApiKey = {
      id: createMockApiKeyId(),
      name: body.name.trim(),
      maskedKey,
      createdAt: new Date().toISOString(),
      rawKey,
    };

    mockSettingsSnapshot.apiKeys.unshift({
      id: createdApiKey.id,
      name: createdApiKey.name,
      maskedKey: createdApiKey.maskedKey,
      createdAt: createdApiKey.createdAt,
    });
    mockSettingsSnapshot.apiAccess = {
      ...mockSettingsSnapshot.apiAccess,
      maskedKey,
    };

    return jsonResponse(201, { data: createdApiKey });
  }

  const apiKeyMatch = pathname.match(/^\/api\/settings\/api-keys\/([^/]+)$/u);

  if (apiKeyMatch && method === "DELETE") {
    const [, apiKeyId] = apiKeyMatch;
    const nextApiKeys = mockSettingsSnapshot.apiKeys.filter((entry) => entry.id !== apiKeyId);

    if (nextApiKeys.length === mockSettingsSnapshot.apiKeys.length) {
      return jsonResponse(404, { error: { code: "api_key_not_found", message: "API key not found." } });
    }

    mockSettingsSnapshot.apiKeys = nextApiKeys;
    mockSettingsSnapshot.apiAccess = {
      ...mockSettingsSnapshot.apiAccess,
      maskedKey: nextApiKeys[0]?.maskedKey ?? "Not configured",
    };

    return createResponse(204, "");
  }

  return jsonResponse(404, { error: { code: "not_found", message: `No mock response configured for ${pathname}.` } });
}
