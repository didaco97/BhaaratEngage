import type { IncomingHttpHeaders } from "node:http";

import { env } from "../../config/env.js";
import type { CallStatus, SupportedLanguage } from "../../domain/enums.js";
import { AppError } from "../../lib/http-errors.js";
import type { CampaignDetail } from "../campaigns/campaign.schemas.js";
import { createJourneyJobDispatcher, type JourneyJobDispatcher } from "../journeys/journey-job-dispatcher.js";
import type { JourneyOutcome } from "../journeys/journey-dispatch.types.js";
import type { BackendRepositories, VoiceCallSession } from "../../repositories/backend-repositories.js";
import { createAuditService, type AuditService } from "../audit/audit.service.js";
import { runWithRequestOrganizationId } from "../auth/request-auth-context.js";
import { createPlivoVoiceGateway, type PlivoVoiceGateway } from "./plivo.client.js";
import type { VoiceDispatchSource } from "./voice.schemas.js";

interface VoiceServiceDependencies {
  readonly repositories: Pick<BackendRepositories, "campaigns" | "contacts" | "voice">;
  readonly plivoGateway: PlivoVoiceGateway;
  readonly auditService?: AuditService;
  readonly publicBaseUrl?: string;
  readonly journeyDispatcher?: JourneyJobDispatcher;
}

export interface ValidateVoiceWebhookInput {
  readonly method: string;
  readonly pathWithQuery: string;
  readonly headers: IncomingHttpHeaders;
  readonly params: Record<string, string>;
}

export interface StartVoiceCallResult {
  readonly campaignId: string;
  readonly contactId: string;
  readonly answerUrl: string;
  readonly statusUrl: string;
  readonly requestUuid: string;
}

const localizedTransferAnnouncement: Record<SupportedLanguage, string> = {
  hindi: "Kripya rukiyega, main aapko ek visheshagya se jod raha hoon.",
  english: "Please hold while I connect you to a specialist.",
  tamil: "Dayavuseythu kaathirungal, ungalai oru specialist-udan inaikkiren.",
  telugu: "Dayachesi wait cheyandi, mimmalni oka specialist ki connect chestunnanu.",
  kannada: "Dayavittu swalpa nillisiri, nimmannu specialist jothege serisuttiddene.",
  bengali: "Doya kore opekkha korun, ami apnake ekjon specialist-er sathe jure dicchi.",
  marathi: "Kripaya thamba, mi tumhala eka specialist sobat jodat aahe.",
  gujarati: "Krupa kari ne thodu raho, hu tamne ek specialist sathe jodi rahyo chhu.",
  urdu: "Barah e karam intizaar kijiye, main aap ko ek specialist se milwa raha hoon.",
};

export class VoiceService {
  public constructor(private readonly dependencies: VoiceServiceDependencies) {}

  private async runWithVoiceScope<T>(
    input: {
      campaignId?: string;
      contactId?: string;
      callUuid?: string;
    },
    callback: (scope: { organizationId: string; campaignId?: string; contactId?: string }) => Promise<T>,
  ) {
    const scope = await this.dependencies.repositories.voice.resolveScope({
      campaignId: input.campaignId,
      contactId: input.contactId,
      providerCallId: input.callUuid,
    });

    return runWithRequestOrganizationId(scope.organizationId, () => callback(scope));
  }

  private requirePublicBaseUrl() {
    const publicBaseUrl = this.dependencies.publicBaseUrl?.trim();

    if (!publicBaseUrl) {
      throw new AppError(
        503,
        "voice_public_base_url_missing",
        "PUBLIC_BASE_URL must be configured before outbound voice callbacks can be created.",
      );
    }

    return publicBaseUrl;
  }

  private async getCampaign(campaignId: string) {
    const campaign = await this.dependencies.repositories.campaigns.getById(campaignId);

    if (!campaign) {
      throw new AppError(404, "campaign_not_found", `Campaign ${campaignId} was not found.`);
    }

    if (campaign.status === "completed") {
      throw new AppError(409, "campaign_completed", "Completed campaigns cannot start new calls.");
    }

    return campaign;
  }

  private async getContact(contactId: string) {
    const contact = await this.dependencies.repositories.contacts.getById(contactId);

    if (!contact) {
      throw new AppError(404, "contact_not_found", `Contact ${contactId} was not found.`);
    }

    if (contact.status !== "eligible") {
      throw new AppError(409, "contact_not_callable", "Only eligible contacts can receive a voice call.");
    }

    return contact;
  }

  private buildCallbackUrl(pathname: string, params: Record<string, string>) {
    const url = new URL(pathname, this.requirePublicBaseUrl());

    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }

    return url.toString();
  }

  private buildStreamUrl(params: Record<string, string>) {
    const url = new URL("/voice/plivo/stream", this.requirePublicBaseUrl());
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";

    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }

    return url.toString();
  }

  private async createOutboundCall(input: {
    campaignId: string;
    contactId: string;
    source: VoiceDispatchSource;
  }): Promise<StartVoiceCallResult> {
    const [campaign, contact] = await Promise.all([this.getCampaign(input.campaignId), this.getContact(input.contactId)]);
    const answerUrl = this.buildCallbackUrl("/voice/plivo/answer", {
      campaignId: input.campaignId,
      contactId: input.contactId,
      source: input.source,
    });
    const statusUrl = this.buildCallbackUrl("/voice/plivo/status", {
      campaignId: input.campaignId,
      contactId: input.contactId,
      source: input.source,
    });
    const result = await this.dependencies.plivoGateway.createCall({
      to: contact.phone,
      answerUrl,
      hangupUrl: statusUrl,
      callerName: campaign.callerIdentity,
    });

    return {
      campaignId: input.campaignId,
      contactId: input.contactId,
      answerUrl,
      statusUrl,
      requestUuid: result.requestUuid,
    };
  }

  private mapPlivoCallStatus(status: string): CallStatus {
    const normalizedStatus = status.trim().toLowerCase().replace(/[\s-]+/gu, "_");

    switch (normalizedStatus) {
      case "completed":
        return "completed";
      case "busy":
        return "busy";
      case "transferred":
        return "transferred";
      case "no_answer":
      case "timeout":
        return "no_answer";
      case "in_progress":
      case "ringing":
      case "queued":
        return "in_progress";
      default:
        return "failed";
    }
  }

  private resolveCompletedDisposition(session: VoiceCallSession) {
    const confirmedFieldCount = session.collectedData.filter((field) => field.confirmed).length;
    const hasCollectedData = session.fieldsCollected > 0 || session.collectedData.length > 0;

    if (confirmedFieldCount > 0 && confirmedFieldCount >= session.fieldsTotal) {
      return "data_collected";
    }

    return hasCollectedData ? "partial_collection" : "partial_collection";
  }

  private resolveFinalDisposition(input: {
    session: VoiceCallSession | null;
    status: CallStatus;
    providerStatus: string;
    errorCode?: string;
  }) {
    switch (input.status) {
      case "completed":
        return input.session ? this.resolveCompletedDisposition(input.session) : "partial_collection";
      case "no_answer":
        return "no_answer";
      case "busy":
        return "busy";
      case "transferred":
        return "human_transfer";
      case "failed":
        return input.errorCode ? "network_error" : input.providerStatus.trim().toLowerCase().replace(/[\s-]+/gu, "_");
      case "in_progress":
      default:
        return input.providerStatus.trim().toLowerCase().replace(/[\s-]+/gu, "_");
    }
  }

  private resolveJourneyFollowUp(input: {
    campaign: CampaignDetail;
    disposition: string;
  }): { action: "sms" | "whatsapp" | "retry"; outcome: JourneyOutcome } | null {
    switch (input.disposition) {
      case "no_answer":
      case "busy": {
        const action = input.campaign.journey.unansweredAction;
        return action === "none"
          ? null
          : {
              action,
              outcome: "unanswered",
            };
      }
      case "partial_collection": {
        const action = input.campaign.journey.partialAction;
        return action === "none"
          ? null
          : {
              action,
              outcome: "partial",
            };
      }
      default:
        return null;
    }
  }

  private async ensureVoiceSession(input: {
    campaignId: string;
    contactId: string;
    callUuid: string;
    startedAt?: string;
  }) {
    await this.getCampaign(input.campaignId);
    await this.getContact(input.contactId);

    return this.dependencies.repositories.voice.ensureCallSession({
      campaignId: input.campaignId,
      contactId: input.contactId,
      providerCallId: input.callUuid,
      provider: "plivo",
      startedAt: input.startedAt ?? new Date().toISOString(),
      transcriptMode: "restricted",
    });
  }

  private async getVoiceSessionForCall(input: {
    campaignId?: string;
    contactId?: string;
    callUuid: string;
  }) {
    return this.runWithVoiceScope(input, async (scope) => {
      const campaignId = scope.campaignId ?? input.campaignId;
      const contactId = scope.contactId ?? input.contactId;

      if (!campaignId || !contactId) {
        throw new AppError(404, "voice_session_not_found", `Voice session ${input.callUuid} could not be resolved.`);
      }

      return this.ensureVoiceSession({
        campaignId,
        contactId,
        callUuid: input.callUuid,
      });
    });
  }

  private requireTransferTarget(session: VoiceCallSession) {
    if (!session.transferEnabled) {
      throw new AppError(409, "voice_transfer_disabled", `Campaign ${session.campaignId} does not allow human transfer.`);
    }

    const transferTarget = session.transferTarget?.trim();

    if (!transferTarget) {
      throw new AppError(
        409,
        "voice_transfer_target_missing",
        `Campaign ${session.campaignId} does not have a configured transfer destination.`,
      );
    }

    return transferTarget;
  }

  public validateWebhookSignature(input: ValidateVoiceWebhookInput) {
    const url = new URL(input.pathWithQuery, this.requirePublicBaseUrl()).toString();

    this.dependencies.plivoGateway.assertValidSignature({
      method: input.method,
      url,
      headers: input.headers,
      params: input.params,
    });
  }

  public async startOutboundCall(input: {
    campaignId: string;
    contactId: string;
    source: Exclude<VoiceDispatchSource, "test">;
  }): Promise<StartVoiceCallResult> {
    return this.createOutboundCall(input);
  }

  public async startTestCall(campaignId: string, contactId: string): Promise<StartVoiceCallResult> {
    return this.createOutboundCall({
      campaignId,
      contactId,
      source: "test",
    });
  }

  public async buildAnswerXml(input: {
    campaignId: string;
    contactId: string;
    callUuid: string;
  }) {
    return this.runWithVoiceScope(input, async (scope) => {
      const campaignId = scope.campaignId ?? input.campaignId;
      const contactId = scope.contactId ?? input.contactId;
      const session = await this.ensureVoiceSession({
        campaignId,
        contactId,
        callUuid: input.callUuid,
      });
      const streamUrl = this.buildStreamUrl({
        campaignId,
        contactId,
        callUuid: input.callUuid,
      });

      return this.dependencies.plivoGateway.buildStreamXml({
        streamUrl,
        introPrompt: session.introPrompt,
      });
    });
  }

  public initializeStreamSession(input: {
    campaignId: string;
    contactId: string;
    callUuid: string;
  }): Promise<VoiceCallSession> {
    return this.runWithVoiceScope(input, async (scope) => {
      return this.ensureVoiceSession({
        campaignId: scope.campaignId ?? input.campaignId,
        contactId: scope.contactId ?? input.contactId,
        callUuid: input.callUuid,
      });
    });
  }

  public async buildTransferXml(input: { callUuid: string }) {
    const session = await this.getVoiceSessionForCall({
      callUuid: input.callUuid,
    });
    const transferTarget = this.requireTransferTarget(session);

    return this.dependencies.plivoGateway.buildTransferXml({
      announcement: localizedTransferAnnouncement[session.language] ?? localizedTransferAnnouncement.english,
      transferTarget,
    });
  }

  public async transferToHuman(input: {
    campaignId?: string;
    contactId?: string;
    callUuid: string;
    reason?: "caller_request" | "retry_limit";
  }) {
    const session = await this.getVoiceSessionForCall(input);
    this.requireTransferTarget(session);
    const transferUrl = this.buildCallbackUrl("/voice/plivo/transfer", {
      callUuid: input.callUuid,
    });

    await this.dependencies.plivoGateway.transferCall({
      callUuid: input.callUuid,
      transferUrl,
      transferMethod: "POST",
    });
    await this.dependencies.repositories.voice.updateCallStatus({
      providerCallId: input.callUuid,
      status: "transferred",
      disposition: "human_transfer",
      transcriptMode: session.transcriptMode,
    });
    await this.dependencies.repositories.campaigns.updateDialerContactDispatch({
      campaignId: session.campaignId,
      contactId: session.contactId,
      dispatchStatus: "transferred",
      expectedCurrentStatus: "in_progress",
    });
    await this.dependencies.auditService?.recordIfPossible({
      action: "Transferred call to human agent",
      entityType: "call_record",
      entityId: session.callRecordId,
      metadata: {
        displayName: `${session.contactName} • ${session.campaignName}`,
        transferQueue: session.transferQueue,
        transferReason: input.reason ?? "caller_request",
      },
    });

    return {
      callRecordId: session.callRecordId,
      transferQueue: session.transferQueue,
      transferUrl,
    };
  }

  public async processStatusCallback(input: {
    campaignId?: string;
    contactId?: string;
    callUuid: string;
    providerStatus: string;
    source?: VoiceDispatchSource;
    durationSeconds?: number;
    recordingUrl?: string;
    errorCode?: string;
    answeredAt?: string;
    endedAt?: string;
  }) {
    return this.runWithVoiceScope(
      {
        campaignId: input.campaignId,
        contactId: input.contactId,
        callUuid: input.callUuid,
      },
      async (scope) => {
        const campaignId = scope.campaignId ?? input.campaignId;
        const contactId = scope.contactId ?? input.contactId;
        const session =
          campaignId && contactId
            ? await this.ensureVoiceSession({
                campaignId,
                contactId,
                callUuid: input.callUuid,
              })
            : null;

        const status = this.mapPlivoCallStatus(input.providerStatus);
        const disposition = this.resolveFinalDisposition({
          session,
          status,
          providerStatus: input.providerStatus,
          errorCode: input.errorCode,
        });
        const updatedRecord = await this.dependencies.repositories.voice.updateCallStatus({
          providerCallId: input.callUuid,
          status,
          disposition,
          durationSeconds: input.durationSeconds,
          recordingUrl: input.recordingUrl,
          errorCode: input.errorCode,
          answeredAt: input.answeredAt,
          endedAt: input.endedAt ?? new Date().toISOString(),
        });

        if (input.source && input.source !== "test" && campaignId && contactId) {
          const dispatchStateUpdated = await this.dependencies.repositories.campaigns.updateDialerContactDispatch({
            campaignId,
            contactId,
            dispatchStatus: status,
            expectedCurrentStatus: "in_progress",
          });

          if (dispatchStateUpdated) {
            const campaign = await this.dependencies.repositories.campaigns.getById(campaignId);
            const followUp = campaign ? this.resolveJourneyFollowUp({ campaign, disposition }) : null;

            if (followUp && updatedRecord) {
              await this.dependencies.journeyDispatcher?.dispatch({
                organizationId: scope.organizationId,
                campaignId,
                contactId,
                requestedAt: input.endedAt ?? new Date().toISOString(),
                action: followUp.action,
                outcome: followUp.outcome,
                callRecordId: updatedRecord.id,
                retryWindowHours: campaign?.journey.retryWindowHours,
                traceId: updatedRecord.id,
              });
            }
          }
        }

        return updatedRecord;
      }
    );
  }
}

export function createVoiceService(repositories: BackendRepositories) {
  return new VoiceService({
    repositories,
    plivoGateway: createPlivoVoiceGateway(),
    auditService: createAuditService(repositories.audit),
    publicBaseUrl: env.PUBLIC_BASE_URL,
    journeyDispatcher: createJourneyJobDispatcher(repositories),
  });
}
