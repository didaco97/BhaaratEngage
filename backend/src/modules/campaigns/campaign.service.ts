import { AppError } from "../../lib/http-errors.js";
import type { AuditService } from "../audit/audit.service.js";
import type { CampaignRepository, CampaignListFilters, ContactRepository, ContactListFilters } from "../../repositories/backend-repositories.js";
import type { CreateCampaignRequest, UpdateCampaignRequest } from "./campaign.schemas.js";

export class CampaignService {
  public constructor(
    private readonly repository: CampaignRepository,
    private readonly contactsRepository: ContactRepository,
    private readonly auditService?: AuditService,
  ) {}

  private async expectExistingMutation(id: string, operation: () => Promise<Awaited<ReturnType<CampaignRepository["getById"]>>>) {
    const result = await operation();

    if (!result) {
      throw new AppError(404, "campaign_not_found", `Campaign ${id} was not found.`);
    }

    return result;
  }

  public list(filters: CampaignListFilters) {
    return this.repository.list(filters);
  }

  public async getById(id: string) {
    const campaign = await this.repository.getById(id);

    if (!campaign) {
      throw new AppError(404, "campaign_not_found", `Campaign ${id} was not found.`);
    }

    return campaign;
  }

  public create(input: CreateCampaignRequest) {
    return this.repository.create(input);
  }

  public async listContacts(id: string, filters: ContactListFilters) {
    await this.getById(id);
    return this.repository.listContacts(id, filters);
  }

  private async ensureAssignableContacts(contactIds: string[]) {
    const contacts = await Promise.all(contactIds.map(async (contactId) => this.contactsRepository.getById(contactId)));
    const missingContactIds = contactIds.filter((contactId, index) => !contacts[index]);

    if (missingContactIds.length > 0) {
      throw new AppError(404, "contact_not_found", "One or more contacts were not found.", {
        contactIds: missingContactIds,
      });
    }

    const nonEligibleContacts = contacts.reduce<NonNullable<(typeof contacts)[number]>[]>((result, contact) => {
      if (contact && contact.status !== "eligible") {
        result.push(contact);
      }

      return result;
    }, []);

    if (nonEligibleContacts.length > 0) {
      throw new AppError(409, "contact_not_assignable", "Only eligible contacts can be assigned to a campaign.", {
        contactIds: nonEligibleContacts.map((contact) => contact.id),
      });
    }
  }

  public async assignContacts(id: string, contactIds: string[]) {
    const campaign = await this.getById(id);

    if (campaign.status === "completed") {
      throw new AppError(409, "campaign_completed", "Completed campaigns cannot be changed.");
    }

    const normalizedContactIds = [...new Set(contactIds.map((contactId) => contactId.trim()).filter(Boolean))];

    if (normalizedContactIds.length === 0) {
      throw new AppError(400, "contact_ids_required", "At least one contact id is required.");
    }

    await this.ensureAssignableContacts(normalizedContactIds);
    return this.repository.assignContacts(id, normalizedContactIds);
  }

  public async removeContact(id: string, contactId: string) {
    const campaign = await this.getById(id);

    if (campaign.status === "completed") {
      throw new AppError(409, "campaign_completed", "Completed campaigns cannot be changed.");
    }

    const contact = await this.contactsRepository.getById(contactId);

    if (!contact) {
      throw new AppError(404, "contact_not_found", `Contact ${contactId} was not found.`);
    }

    const removed = await this.repository.removeContact(id, contactId);

    if (!removed) {
      throw new AppError(404, "campaign_contact_not_found", `Contact ${contactId} is not assigned to campaign ${id}.`);
    }
  }

  public async update(id: string, input: UpdateCampaignRequest) {
    const campaign = await this.getById(id);

    if (campaign.status === "completed") {
      throw new AppError(409, "campaign_completed", "Completed campaigns cannot be edited.");
    }

    return this.expectExistingMutation(id, () => this.repository.update(id, input));
  }

  public async launch(id: string) {
    const campaign = await this.getById(id);

    if (campaign.status === "active") {
      throw new AppError(409, "campaign_already_active", "Campaign is already active.");
    }

    if (campaign.status === "completed") {
      throw new AppError(409, "campaign_completed", "Completed campaigns cannot be relaunched.");
    }

    const launchedCampaign = await this.expectExistingMutation(id, () =>
      this.repository.setStatus({
        id,
        status: "active",
        launchedAt: new Date().toISOString(),
        pauseMode: null,
        expectedCurrentStatus: campaign.status,
      }),
    );
    await this.auditService?.recordIfPossible({
      action: "Launched campaign",
      entityType: "campaign",
      entityId: launchedCampaign.id,
      metadata: {
        displayName: launchedCampaign.name,
      },
    });
    return launchedCampaign;
  }

  public async pause(id: string) {
    const campaign = await this.getById(id);

    if (campaign.status !== "active") {
      throw new AppError(409, "campaign_not_active", "Only active campaigns can be paused.");
    }

    const pausedCampaign = await this.expectExistingMutation(id, () =>
      this.repository.setStatus({
        id,
        status: "paused",
        pauseMode: "manual",
        expectedCurrentStatus: "active",
      }),
    );
    await this.auditService?.recordIfPossible({
      action: "Paused campaign",
      entityType: "campaign",
      entityId: pausedCampaign.id,
      metadata: {
        displayName: pausedCampaign.name,
      },
    });
    return pausedCampaign;
  }

  public async resume(id: string) {
    const campaign = await this.getById(id);

    if (campaign.status !== "paused") {
      throw new AppError(409, "campaign_not_paused", "Only paused campaigns can be resumed.");
    }

    const resumedCampaign = await this.expectExistingMutation(id, () =>
      this.repository.setStatus({
        id,
        status: "active",
        launchedAt: new Date().toISOString(),
        pauseMode: null,
        expectedCurrentStatus: "paused",
      }),
    );
    await this.auditService?.recordIfPossible({
      action: "Resumed campaign",
      entityType: "campaign",
      entityId: resumedCampaign.id,
      metadata: {
        displayName: resumedCampaign.name,
      },
    });
    return resumedCampaign;
  }

  public async autoPauseForQuietHours(id: string) {
    const pausedCampaign = await this.repository.setStatus({
      id,
      status: "paused",
      pauseMode: "quiet_hours",
      expectedCurrentStatus: "active",
    });

    if (!pausedCampaign) {
      return null;
    }

    await this.auditService?.recordIfPossible({
      action: "Auto-paused campaign",
      entityType: "campaign",
      entityId: pausedCampaign.id,
      metadata: {
        displayName: pausedCampaign.name,
        pauseMode: "quiet_hours",
      },
    });

    return pausedCampaign;
  }

  public async autoResumeFromQuietHours(id: string) {
    const resumedCampaign = await this.repository.setStatus({
      id,
      status: "active",
      pauseMode: null,
      expectedCurrentStatus: "paused",
      expectedCurrentPauseMode: "quiet_hours",
    });

    if (!resumedCampaign) {
      return null;
    }

    await this.auditService?.recordIfPossible({
      action: "Auto-resumed campaign",
      entityType: "campaign",
      entityId: resumedCampaign.id,
      metadata: {
        displayName: resumedCampaign.name,
        pauseMode: "quiet_hours",
      },
    });

    return resumedCampaign;
  }

  public async duplicate(id: string) {
    await this.getById(id);
    const duplicatedCampaign = await this.repository.duplicate(id);

    if (!duplicatedCampaign) {
      throw new AppError(404, "campaign_not_found", `Campaign ${id} was not found.`);
    }

    return duplicatedCampaign;
  }

  public async remove(id: string) {
    await this.getById(id);
    await this.repository.remove(id);
  }
}
