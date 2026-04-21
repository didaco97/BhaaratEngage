import { AppError } from "../../lib/http-errors.js";
import type { AuditService } from "../audit/audit.service.js";
import { getRequestOrganizationId } from "../auth/request-auth-context.js";
import type { SettingsRepository } from "../../repositories/backend-repositories.js";
import type {
  CreateApiKeyRequest,
  InviteTeamMemberRequest,
  NotificationPreferenceUpdate,
  WebhookConfig,
  WorkspaceSettings,
} from "./settings.schemas.js";

export class SettingsService {
  public constructor(
    private readonly repository: SettingsRepository,
    private readonly auditService?: AuditService,
  ) {}

  private normalizeEmail(email: string) {
    return email.trim().toLowerCase();
  }

  private async getExistingTeamMember(userId: string) {
    const snapshot = await this.repository.getSnapshot();
    const teamMember = snapshot.teamMembers.find((member) => member.id === userId);

    if (!teamMember) {
      throw new AppError(404, "team_member_not_found", `Team member ${userId} was not found.`);
    }

    return {
      snapshot,
      teamMember,
    };
  }

  public getSnapshot() {
    return this.repository.getSnapshot();
  }

  public updateWorkspaceSettings(input: WorkspaceSettings) {
    return this.repository.updateWorkspaceSettings(input);
  }

  public updateNotificationPreferences(input: NotificationPreferenceUpdate[]) {
    return this.repository.updateNotificationPreferences(input);
  }

  public async updateWebhookConfig(input: WebhookConfig) {
    const snapshot = await this.repository.updateWebhookConfig(input);
    await this.auditService?.recordIfPossible({
      action: "Updated outbound webhook",
      entityType: "outbound_webhook",
      entityId: "workspace-webhook",
      metadata: {
        displayName: input.url,
        events: input.events,
      },
    });
    return snapshot;
  }

  public async inviteTeamMember(input: InviteTeamMemberRequest) {
    const normalizedInput = {
      ...input,
      email: this.normalizeEmail(input.email),
    };
    const currentOrganizationId = getRequestOrganizationId();

    if (currentOrganizationId) {
      const existingMatches = await this.repository.findTeamMembersByEmail(normalizedInput.email);

      if (existingMatches.some((member) => member.organizationId === currentOrganizationId)) {
        throw new AppError(409, "team_member_exists", `A team member with email ${input.email} already exists.`);
      }

      if (existingMatches.length > 0) {
        throw new AppError(
          409,
          "team_member_other_workspace",
          `The email ${input.email} is already assigned to another workspace.`,
        );
      }
    }

    return this.repository.inviteTeamMember(normalizedInput);
  }

  public async updateTeamMemberRole(userId: string, role: InviteTeamMemberRequest["role"]) {
    const { snapshot, teamMember } = await this.getExistingTeamMember(userId);
    const workspaceAdminCount = snapshot.teamMembers.filter((member) => member.role === "workspace_admin").length;

    if (teamMember.role === "workspace_admin" && role !== "workspace_admin" && workspaceAdminCount === 1) {
      throw new AppError(409, "last_workspace_admin", "At least one workspace admin must remain assigned.");
    }

    return this.repository.updateTeamMemberRole(userId, role);
  }

  public async removeTeamMember(userId: string) {
    const { snapshot, teamMember } = await this.getExistingTeamMember(userId);
    const workspaceAdminCount = snapshot.teamMembers.filter((member) => member.role === "workspace_admin").length;

    if (teamMember.role === "workspace_admin" && workspaceAdminCount === 1) {
      throw new AppError(409, "last_workspace_admin", "At least one workspace admin must remain assigned.");
    }

    return this.repository.removeTeamMember(userId);
  }

  public listApiKeys() {
    return this.repository.listApiKeys();
  }

  public async createApiKey(input: CreateApiKeyRequest) {
    const createdApiKey = await this.repository.createApiKey(input);
    await this.auditService?.recordIfPossible({
      action: "Created API key",
      entityType: "api_key",
      entityId: createdApiKey.id,
      metadata: {
        displayName: createdApiKey.name,
        maskedKey: createdApiKey.maskedKey,
      },
    });
    return createdApiKey;
  }

  public async deleteApiKey(id: string) {
    const existingApiKeys = await this.repository.listApiKeys();
    const apiKey = existingApiKeys.find((entry) => entry.id === id);

    await this.repository.deleteApiKey(id);
    await this.auditService?.recordIfPossible({
      action: "Deleted API key",
      entityType: "api_key",
      entityId: id,
      metadata: apiKey
        ? {
            displayName: apiKey.name,
            maskedKey: apiKey.maskedKey,
          }
        : undefined,
    });
  }
}
