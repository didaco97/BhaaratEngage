import { z } from "zod";

import {
  apiErrorBodySchema,
  callRecordSchema,
  campaignDetailSchema,
  campaignSchema,
  contactSchema,
  contactImportRequestSchema,
  contactImportSummarySchema,
  createApiEnvelopeSchema,
  createCampaignRequestSchema,
  dashboardSnapshotSchema,
  journeySchema,
  reportsSnapshotSchema,
  settingsSnapshotSchema,
  transcriptTurnSchema,
  apiKeySummarySchema,
  createApiKeyRequestSchema,
  createdApiKeySchema,
  inviteTeamMemberRequestSchema,
  collectedFieldSchema,
  updateCampaignRequestSchema,
  updateContactRequestSchema,
  webhookConfigSchema,
  workspaceSettingsSchema,
  updateNotificationPreferencesRequestSchema,
  type CallStatus,
  type CampaignStatus,
  type ContactImportRequest,
  type ContactStatus,
  type CreateApiKeyRequest,
  type CreateCampaignRequest,
  type InviteTeamMemberRequest,
  type NotificationPreferenceUpdate,
  type UpdateCampaignRequest,
  type UpdateContactRequest,
  type WebhookConfig,
  type WorkspaceSettings,
} from "@/lib/api-contracts";
import { resolveApiAccessToken } from "@/lib/api-auth";

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");

function buildUrl(pathname: string, query?: Record<string, string | undefined>) {
  const url = new URL(`${apiBaseUrl}${pathname}`, window.location.origin);

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value) {
        url.searchParams.set(key, value);
      }
    }
  }

  return url.toString();
}

function extractFilename(contentDisposition: string | null, fallbackFilename: string) {
  if (!contentDisposition) {
    return fallbackFilename;
  }

  const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/iu);

  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1]);
  }

  const quotedMatch = contentDisposition.match(/filename="([^"]+)"/iu);

  if (quotedMatch?.[1]) {
    return quotedMatch[1];
  }

  const plainMatch = contentDisposition.match(/filename=([^;]+)/iu);
  return plainMatch?.[1]?.trim() ?? fallbackFilename;
}

export class ApiError extends Error {
  public readonly status: number;
  public readonly code?: string;

  public constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

type EnvelopeData<TSchema extends z.ZodTypeAny> = z.infer<TSchema> extends { data?: infer TData } ? TData : never;

async function createRequestHeaders(options?: { readonly hasJsonBody?: boolean }) {
  const headers = new Headers();

  if (options?.hasJsonBody) {
    headers.set("Content-Type", "application/json");
  }

  const accessToken = await resolveApiAccessToken();

  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  return headers;
}

async function requestData<TSchema extends z.ZodTypeAny, TBody = undefined>(options: {
  readonly pathname: string;
  readonly schema: TSchema;
  readonly method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  readonly query?: Record<string, string | undefined>;
  readonly body?: TBody;
}): Promise<EnvelopeData<TSchema>> {
  let serializedBody: string | undefined;

  if (typeof options.body !== "undefined") {
    serializedBody = JSON.stringify(options.body);
  }

  const response = await fetch(buildUrl(options.pathname, options.query), {
    method: options.method ?? "GET",
    headers: await createRequestHeaders({ hasJsonBody: typeof options.body !== "undefined" }),
    body: serializedBody,
  });

  if (!response.ok) {
    const parsedError = apiErrorBodySchema.safeParse(await response.json().catch(() => null));

    if (parsedError.success) {
      throw new ApiError(response.status, parsedError.data.error.message, parsedError.data.error.code);
    }

    throw new ApiError(response.status, `Request failed with status ${response.status}.`);
  }

  const json = await response.json();
  return (options.schema.parse(json) as { data: EnvelopeData<TSchema> }).data;
}

async function requestVoid(options: {
  readonly pathname: string;
  readonly method?: "DELETE";
}) {
  const response = await fetch(buildUrl(options.pathname), {
    method: options.method ?? "DELETE",
    headers: await createRequestHeaders(),
  });

  if (!response.ok) {
    const parsedError = apiErrorBodySchema.safeParse(await response.json().catch(() => null));

    if (parsedError.success) {
      throw new ApiError(response.status, parsedError.data.error.message, parsedError.data.error.code);
    }

    throw new ApiError(response.status, `Request failed with status ${response.status}.`);
  }
}

async function downloadFile(options: {
  readonly pathname: string;
  readonly query?: Record<string, string | undefined>;
  readonly fallbackFilename: string;
}) {
  const response = await fetch(buildUrl(options.pathname, options.query), {
    method: "GET",
    headers: await createRequestHeaders(),
  });

  if (!response.ok) {
    const parsedError = apiErrorBodySchema.safeParse(await response.json().catch(() => null));

    if (parsedError.success) {
      throw new ApiError(response.status, parsedError.data.error.message, parsedError.data.error.code);
    }

    throw new ApiError(response.status, `Request failed with status ${response.status}.`);
  }

  const blob = await response.blob();
  const objectUrl = window.URL.createObjectURL(blob);
  const downloadLink = document.createElement("a");
  const filename = extractFilename(response.headers.get("Content-Disposition"), options.fallbackFilename);

  downloadLink.href = objectUrl;
  downloadLink.download = filename;
  downloadLink.style.display = "none";

  document.body.append(downloadLink);
  downloadLink.click();
  downloadLink.remove();
  window.setTimeout(() => {
    window.URL.revokeObjectURL(objectUrl);
  }, 0);
}

const dashboardEnvelopeSchema = createApiEnvelopeSchema(dashboardSnapshotSchema);
const campaignEnvelopeSchema = createApiEnvelopeSchema(campaignDetailSchema);
const campaignListEnvelopeSchema = createApiEnvelopeSchema(z.array(campaignSchema));
const contactEnvelopeSchema = createApiEnvelopeSchema(contactSchema);
const contactListEnvelopeSchema = createApiEnvelopeSchema(z.array(contactSchema));
const contactImportEnvelopeSchema = createApiEnvelopeSchema(contactImportSummarySchema);
const journeyEnvelopeSchema = createApiEnvelopeSchema(journeySchema);
const journeyListEnvelopeSchema = createApiEnvelopeSchema(z.array(journeySchema));
const callRecordEnvelopeSchema = createApiEnvelopeSchema(callRecordSchema);
const callRecordListEnvelopeSchema = createApiEnvelopeSchema(z.array(callRecordSchema));
const transcriptEnvelopeSchema = createApiEnvelopeSchema(z.array(transcriptTurnSchema));
const collectedDataEnvelopeSchema = createApiEnvelopeSchema(z.array(collectedFieldSchema));
const reportsEnvelopeSchema = createApiEnvelopeSchema(reportsSnapshotSchema);
const settingsEnvelopeSchema = createApiEnvelopeSchema(settingsSnapshotSchema);
const apiKeyListEnvelopeSchema = createApiEnvelopeSchema(z.array(apiKeySummarySchema));
const createdApiKeyEnvelopeSchema = createApiEnvelopeSchema(createdApiKeySchema);

export const api = {
  getDashboardSnapshot() {
    return requestData({
      pathname: "/api/dashboard",
      schema: dashboardEnvelopeSchema,
    });
  },

  listCampaigns(filters?: { readonly search?: string; readonly status?: CampaignStatus | "all" }) {
    return requestData({
      pathname: "/api/campaigns",
      schema: campaignListEnvelopeSchema,
      query: {
        search: filters?.search,
        status: filters?.status,
      },
    });
  },

  getCampaign(id: string) {
    return requestData({
      pathname: `/api/campaigns/${id}`,
      schema: campaignEnvelopeSchema,
    });
  },

  async createCampaign(input: CreateCampaignRequest) {
    const payload = createCampaignRequestSchema.parse(input);

    return requestData({
      pathname: "/api/campaigns",
      method: "POST",
      body: payload,
      schema: campaignEnvelopeSchema,
    });
  },

  updateCampaign(id: string, input: UpdateCampaignRequest) {
    const payload = updateCampaignRequestSchema.parse(input);

    return requestData({
      pathname: `/api/campaigns/${id}`,
      method: "PUT",
      body: payload,
      schema: campaignEnvelopeSchema,
    });
  },

  launchCampaign(id: string) {
    return requestData({
      pathname: `/api/campaigns/${id}/launch`,
      method: "POST",
      schema: campaignEnvelopeSchema,
    });
  },

  pauseCampaign(id: string) {
    return requestData({
      pathname: `/api/campaigns/${id}/pause`,
      method: "POST",
      schema: campaignEnvelopeSchema,
    });
  },

  resumeCampaign(id: string) {
    return requestData({
      pathname: `/api/campaigns/${id}/resume`,
      method: "POST",
      schema: campaignEnvelopeSchema,
    });
  },

  listContacts(filters?: { readonly search?: string; readonly status?: ContactStatus | "all" }) {
    return requestData({
      pathname: "/api/contacts",
      schema: contactListEnvelopeSchema,
      query: {
        search: filters?.search,
        status: filters?.status,
      },
    });
  },

  updateContact(id: string, input: UpdateContactRequest) {
    const payload = updateContactRequestSchema.parse(input);

    return requestData({
      pathname: `/api/contacts/${id}`,
      method: "PUT",
      body: payload,
      schema: contactEnvelopeSchema,
    });
  },

  markContactDoNotCall(id: string) {
    return requestData({
      pathname: `/api/contacts/${id}/do-not-call`,
      method: "POST",
      schema: contactEnvelopeSchema,
    });
  },

  deleteContact(id: string) {
    return requestVoid({
      pathname: `/api/contacts/${id}`,
      method: "DELETE",
    });
  },

  importContacts(input: ContactImportRequest) {
    const payload = contactImportRequestSchema.parse(input);

    return requestData({
      pathname: "/api/contacts/import",
      method: "POST",
      body: payload,
      schema: contactImportEnvelopeSchema,
    });
  },

  exportContacts(filters?: { readonly search?: string; readonly status?: ContactStatus | "all" }) {
    return downloadFile({
      pathname: "/api/contacts/export.csv",
      query: {
        search: filters?.search,
        status: filters?.status,
      },
      fallbackFilename: "contacts-export.csv",
    });
  },

  listJourneys() {
    return requestData({
      pathname: "/api/journeys",
      schema: journeyListEnvelopeSchema,
    });
  },

  getJourney(id: string) {
    return requestData({
      pathname: `/api/journeys/${id}`,
      schema: journeyEnvelopeSchema,
    });
  },

  listCallRecords(filters?: {
    readonly search?: string;
    readonly status?: CallStatus | "all";
    readonly campaignId?: string;
  }) {
    return requestData({
      pathname: "/api/call-records",
      schema: callRecordListEnvelopeSchema,
      query: {
        search: filters?.search,
        status: filters?.status,
        campaignId: filters?.campaignId,
      },
    });
  },

  exportCallRecords(filters?: {
    readonly search?: string;
    readonly status?: CallStatus | "all";
    readonly campaignId?: string;
  }) {
    return downloadFile({
      pathname: "/api/call-records/export.csv",
      query: {
        search: filters?.search,
        status: filters?.status,
        campaignId: filters?.campaignId,
      },
      fallbackFilename: "call-records-export.csv",
    });
  },

  getCallRecord(id: string) {
    return requestData({
      pathname: `/api/call-records/${id}`,
      schema: callRecordEnvelopeSchema,
    });
  },

  getCallTranscript(id: string) {
    return requestData({
      pathname: `/api/call-records/${id}/transcript`,
      schema: transcriptEnvelopeSchema,
    });
  },

  getCallCollectedData(id: string) {
    return requestData({
      pathname: `/api/call-records/${id}/data`,
      schema: collectedDataEnvelopeSchema,
    });
  },

  getReportsSnapshot() {
    return requestData({
      pathname: "/api/reports",
      schema: reportsEnvelopeSchema,
    });
  },

  exportReports() {
    return downloadFile({
      pathname: "/api/reports/export.csv",
      fallbackFilename: "reports-export.csv",
    });
  },

  getSettingsSnapshot() {
    return requestData({
      pathname: "/api/settings",
      schema: settingsEnvelopeSchema,
    });
  },

  updateWorkspaceSettings(input: WorkspaceSettings) {
    const payload = workspaceSettingsSchema.parse(input);

    return requestData({
      pathname: "/api/settings/workspace",
      method: "PATCH",
      body: payload,
      schema: settingsEnvelopeSchema,
    });
  },

  updateNotificationPreferences(preferences: NotificationPreferenceUpdate[]) {
    const payload = updateNotificationPreferencesRequestSchema.parse({ preferences });

    return requestData({
      pathname: "/api/settings/notifications",
      method: "PATCH",
      body: payload,
      schema: settingsEnvelopeSchema,
    });
  },

  updateWebhookConfig(input: WebhookConfig) {
    const payload = webhookConfigSchema.parse(input);

    return requestData({
      pathname: "/api/settings/webhook",
      method: "PATCH",
      body: payload,
      schema: settingsEnvelopeSchema,
    });
  },

  inviteTeamMember(input: InviteTeamMemberRequest) {
    const payload = inviteTeamMemberRequestSchema.parse(input);

    return requestData({
      pathname: "/api/settings/team/invite",
      method: "POST",
      body: payload,
      schema: settingsEnvelopeSchema,
    });
  },

  updateTeamMemberRole(userId: string, role: InviteTeamMemberRequest["role"]) {
    return requestData({
      pathname: `/api/settings/team/${userId}/role`,
      method: "PUT",
      body: { role },
      schema: settingsEnvelopeSchema,
    });
  },

  removeTeamMember(userId: string) {
    return requestData({
      pathname: `/api/settings/team/${userId}`,
      method: "DELETE",
      schema: settingsEnvelopeSchema,
    });
  },

  listApiKeys() {
    return requestData({
      pathname: "/api/settings/api-keys",
      schema: apiKeyListEnvelopeSchema,
    });
  },

  createApiKey(input: CreateApiKeyRequest) {
    const payload = createApiKeyRequestSchema.parse(input);

    return requestData({
      pathname: "/api/settings/api-keys",
      method: "POST",
      body: payload,
      schema: createdApiKeyEnvelopeSchema,
    });
  },

  async deleteApiKey(id: string) {
    const response = await fetch(buildUrl(`/api/settings/api-keys/${id}`), {
      method: "DELETE",
      headers: await createRequestHeaders(),
    });

    if (!response.ok) {
      const parsedError = apiErrorBodySchema.safeParse(await response.json().catch(() => null));

      if (parsedError.success) {
        throw new ApiError(response.status, parsedError.data.error.message, parsedError.data.error.code);
      }

      throw new ApiError(response.status, `Request failed with status ${response.status}.`);
    }
  },
};
