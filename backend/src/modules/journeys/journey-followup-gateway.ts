import type { CampaignDetail } from "../campaigns/campaign.schemas.js";
import type { Contact } from "../contacts/contact.schemas.js";
import type { SettingsSnapshot } from "../settings/settings.schemas.js";
import { AppError } from "../../lib/http-errors.js";
import type { JourneyOutcome } from "./journey-dispatch.types.js";

export interface JourneyFollowUpGatewayInput {
  readonly organizationId: string;
  readonly campaign: CampaignDetail;
  readonly contact: Contact;
  readonly action: "sms" | "whatsapp";
  readonly outcome: JourneyOutcome;
  readonly callRecordId?: string;
  readonly requestedAt: string;
  readonly traceId?: string;
}

export interface JourneyFollowUpGatewayResult {
  readonly deliveryChannel: "sms" | "whatsapp";
  readonly acceptedAt: string;
}

export interface JourneyFollowUpGateway {
  deliver(input: JourneyFollowUpGatewayInput): Promise<JourneyFollowUpGatewayResult>;
}

function buildFollowUpPayload(input: JourneyFollowUpGatewayInput) {
  return {
    event: `journey.followup.${input.action}`,
    triggeredAt: input.requestedAt,
    traceId: input.traceId,
    organizationId: input.organizationId,
    campaign: {
      id: input.campaign.id,
      name: input.campaign.name,
      language: input.campaign.language,
      purposeStatement: input.campaign.setup.purposeStatement,
    },
    contact: {
      id: input.contact.id,
      name: input.contact.name,
      phone: input.contact.phone,
      language: input.contact.language,
    },
    call: {
      id: input.callRecordId,
      outcome: input.outcome,
    },
    followUp: {
      channel: input.action,
      outcome: input.outcome,
    },
  };
}

export function createJourneyWebhookGateway(input: {
  readonly loadSettings: () => Promise<SettingsSnapshot>;
  readonly fetcher?: typeof fetch;
}): JourneyFollowUpGateway {
  const fetcher = input.fetcher ?? fetch;

  return {
    async deliver(request) {
      const settings = await input.loadSettings();
      const webhookUrl = settings.apiAccess.webhook.url.trim();

      if (!webhookUrl) {
        throw new AppError(
          503,
          "journey_webhook_missing",
          "A webhook URL must be configured before SMS or WhatsApp follow-ups can be dispatched.",
        );
      }

      const response = await fetcher(webhookUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(buildFollowUpPayload(request)),
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        throw new Error(
          `Journey follow-up webhook rejected ${request.action.toUpperCase()} delivery with ${response.status}${detail ? `: ${detail}` : "."}`,
        );
      }

      return {
        deliveryChannel: request.action,
        acceptedAt: new Date().toISOString(),
      };
    },
  };
}
