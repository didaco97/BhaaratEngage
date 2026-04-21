export const queryKeys = {
  dashboard: ["dashboard"] as const,
  campaigns: (filters?: { readonly search?: string; readonly status?: string }) =>
    ["campaigns", filters?.search ?? "", filters?.status ?? "all"] as const,
  campaign: (id: string) => ["campaign", id] as const,
  contacts: (filters?: { readonly search?: string; readonly status?: string }) =>
    ["contacts", filters?.search ?? "", filters?.status ?? "all"] as const,
  journeys: ["journeys"] as const,
  callRecords: (filters?: { readonly search?: string; readonly status?: string; readonly campaignId?: string }) =>
    ["call-records", filters?.search ?? "", filters?.status ?? "all", filters?.campaignId ?? "all"] as const,
  callTranscript: (id: string) => ["call-transcript", id] as const,
  reports: ["reports"] as const,
  settings: ["settings"] as const,
  apiKeys: ["api-keys"] as const,
};
