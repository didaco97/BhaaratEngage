import { describe, expect, it, vi } from "vitest";

import { AppError } from "../src/lib/http-errors.js";
import { AuditService } from "../src/modules/audit/audit.service.js";
import { runWithRequestPrincipal } from "../src/modules/auth/request-auth-context.js";
import type { RequestPrincipal } from "../src/modules/auth/auth.types.js";
import { SettingsService } from "../src/modules/settings/settings.service.js";
import type { CreatedApiKey, SettingsSnapshot } from "../src/modules/settings/settings.schemas.js";
import type { SettingsRepository } from "../src/repositories/backend-repositories.js";

const principal: RequestPrincipal = {
  userId: "user-001",
  organizationId: "org-001",
  role: "workspace_admin",
  email: "owner@example.com",
  fullName: "Workspace Admin",
  authMode: "disabled",
};

const emptySnapshot: SettingsSnapshot = {
  workspaceSettings: {
    workspaceName: "Workspace",
    defaultLanguage: "english",
    callingWindowStart: "09:00",
    callingWindowEnd: "18:00",
    dndChecksEnabled: true,
    quietHoursAutoPause: true,
    restrictFullTranscripts: true,
  },
  workspaces: [],
  teamMembers: [],
  securityControls: [],
  notificationPreferences: [],
  apiAccess: {
    maskedKey: "not-configured",
    webhook: {
      url: "https://example.invalid/not-configured",
      events: ["integration.pending"],
    },
  },
  apiKeys: [],
};

function createRepositoryStub(overrides: Partial<SettingsRepository> = {}): SettingsRepository {
  return {
    getSnapshot: async () => emptySnapshot,
    findTeamMembersByEmail: async () => [],
    updateWorkspaceSettings: async () => emptySnapshot,
    updateNotificationPreferences: async () => emptySnapshot,
    updateWebhookConfig: async () => emptySnapshot,
    inviteTeamMember: async () => emptySnapshot,
    updateTeamMemberRole: async () => emptySnapshot,
    removeTeamMember: async () => emptySnapshot,
    listApiKeys: async () => [],
    createApiKey: async () => {
      throw new Error("not implemented");
    },
    deleteApiKey: async () => undefined,
    ...overrides,
  };
}

function createAuditServiceStub() {
  const record = vi.fn(async () => undefined);
  const service = new AuditService({ record });

  return {
    service,
    recordIfPossible: vi.spyOn(service, "recordIfPossible"),
  };
}

describe("settings service", () => {
  it("rejects invites when the email already belongs to the current workspace", async () => {
    const repository = createRepositoryStub({
      findTeamMembersByEmail: async () => [{ id: "user-123", organizationId: "org-001" }],
      inviteTeamMember: vi.fn(async () => emptySnapshot),
    });
    const service = new SettingsService(repository);

    const result = runWithRequestPrincipal(principal, async () =>
      service.inviteTeamMember({
        name: "Aparna Rao",
        email: "aparna@example.com",
        role: "reviewer",
      }),
    );

    await expect(result).rejects.toMatchObject({
      code: "team_member_exists",
      statusCode: 409,
    } satisfies Partial<AppError>);
    expect(repository.inviteTeamMember).not.toHaveBeenCalled();
  });

  it("rejects invites when the email already belongs to another workspace", async () => {
    const repository = createRepositoryStub({
      findTeamMembersByEmail: async () => [{ id: "user-456", organizationId: "org-999" }],
      inviteTeamMember: vi.fn(async () => emptySnapshot),
    });
    const service = new SettingsService(repository);

    const result = runWithRequestPrincipal(principal, async () =>
      service.inviteTeamMember({
        name: "Aparna Rao",
        email: "aparna@example.com",
        role: "reviewer",
      }),
    );

    await expect(result).rejects.toMatchObject({
      code: "team_member_other_workspace",
      statusCode: 409,
    } satisfies Partial<AppError>);
    expect(repository.inviteTeamMember).not.toHaveBeenCalled();
  });

  it("normalizes email casing before delegating a valid invite", async () => {
    const inviteTeamMember = vi.fn(async () => emptySnapshot);
    const repository = createRepositoryStub({
      findTeamMembersByEmail: async (email) => {
        expect(email).toBe("aparna@example.com");
        return [];
      },
      inviteTeamMember,
    });
    const service = new SettingsService(repository);

    await runWithRequestPrincipal(principal, async () =>
      service.inviteTeamMember({
        name: "Aparna Rao",
        email: "  Aparna@Example.com ",
        role: "reviewer",
      }),
    );

    expect(inviteTeamMember).toHaveBeenCalledWith({
      name: "Aparna Rao",
      email: "aparna@example.com",
      role: "reviewer",
    });
  });

  it("records an audit event when updating the outbound webhook configuration", async () => {
    const auditService = createAuditServiceStub();
    const updateWebhookConfig = vi.fn(async () => emptySnapshot);
    const service = new SettingsService(
      createRepositoryStub({
        updateWebhookConfig,
      }),
      auditService.service,
    );

    await service.updateWebhookConfig({
      url: "https://client.example.com/hooks/voice",
      events: ["call.completed", "campaign.completed"],
    });

    expect(updateWebhookConfig).toHaveBeenCalledWith({
      url: "https://client.example.com/hooks/voice",
      events: ["call.completed", "campaign.completed"],
    });
    expect(auditService.recordIfPossible).toHaveBeenCalledWith({
      action: "Updated outbound webhook",
      entityType: "outbound_webhook",
      entityId: "workspace-webhook",
      metadata: {
        displayName: "https://client.example.com/hooks/voice",
        events: ["call.completed", "campaign.completed"],
      },
    });
  });

  it("records an audit event when creating an API key", async () => {
    const auditService = createAuditServiceStub();
    const createdApiKey: CreatedApiKey = {
      id: "api-key-001",
      name: "Partner webhook",
      maskedKey: "bv_live_abcd...wxyz",
      rawKey: "bv_live_abcd1234wxyz5678",
      createdAt: "2026-04-09T00:00:00.000Z",
    };
    const createApiKey = vi.fn(async () => createdApiKey);
    const service = new SettingsService(
      createRepositoryStub({
        createApiKey,
      }),
      auditService.service,
    );

    const result = await service.createApiKey({
      name: "Partner webhook",
    });

    expect(result).toEqual(createdApiKey);
    expect(createApiKey).toHaveBeenCalledWith({
      name: "Partner webhook",
    });
    expect(auditService.recordIfPossible).toHaveBeenCalledWith({
      action: "Created API key",
      entityType: "api_key",
      entityId: createdApiKey.id,
      metadata: {
        displayName: createdApiKey.name,
        maskedKey: createdApiKey.maskedKey,
      },
    });
  });

  it("records an audit event when deleting an API key", async () => {
    const auditService = createAuditServiceStub();
    const listApiKeys = vi.fn(async () => [
      {
        id: "api-key-001",
        name: "Partner webhook",
        maskedKey: "bv_live_abcd...wxyz",
        createdAt: "2026-04-09T00:00:00.000Z",
      },
    ]);
    const deleteApiKey = vi.fn(async () => undefined);
    const service = new SettingsService(
      createRepositoryStub({
        listApiKeys,
        deleteApiKey,
      }),
      auditService.service,
    );

    await service.deleteApiKey("api-key-001");

    expect(listApiKeys).toHaveBeenCalledTimes(1);
    expect(deleteApiKey).toHaveBeenCalledWith("api-key-001");
    expect(auditService.recordIfPossible).toHaveBeenCalledWith({
      action: "Deleted API key",
      entityType: "api_key",
      entityId: "api-key-001",
      metadata: {
        displayName: "Partner webhook",
        maskedKey: "bv_live_abcd...wxyz",
      },
    });
  });
});
