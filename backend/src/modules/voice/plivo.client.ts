import type { IncomingHttpHeaders } from "node:http";
import plivo from "plivo";

import { env } from "../../config/env.js";
import { AppError } from "../../lib/http-errors.js";

export interface CreatePlivoCallInput {
  readonly to: string;
  readonly answerUrl: string;
  readonly hangupUrl: string;
  readonly callerName?: string;
}

export interface CreatePlivoCallResult {
  readonly requestUuid: string;
}

export interface BuildPlivoStreamXmlInput {
  readonly streamUrl: string;
  readonly introPrompt: string;
}

export interface BuildPlivoTransferXmlInput {
  readonly transferTarget: string;
  readonly announcement: string;
}

export interface TransferPlivoCallInput {
  readonly callUuid: string;
  readonly transferUrl: string;
  readonly transferMethod?: "GET" | "POST";
}

export interface ValidatePlivoSignatureInput {
  readonly method: string;
  readonly url: string;
  readonly headers: IncomingHttpHeaders;
  readonly params: Record<string, string>;
}

export interface PlivoVoiceGateway {
  createCall(input: CreatePlivoCallInput): Promise<CreatePlivoCallResult>;
  buildStreamXml(input: BuildPlivoStreamXmlInput): string;
  buildTransferXml(input: BuildPlivoTransferXmlInput): string;
  transferCall(input: TransferPlivoCallInput): Promise<void>;
  assertValidSignature(input: ValidatePlivoSignatureInput): void;
}

function isPhoneTransferTarget(value: string) {
  return /^\+?\d{6,15}$/u.test(value.trim());
}

function requirePlivoConfiguration() {
  if (!env.PLIVO_AUTH_ID || !env.PLIVO_AUTH_TOKEN || !env.PLIVO_PHONE_NUMBER) {
    throw new AppError(503, "plivo_not_configured", "Plivo credentials are not configured for outbound voice calls.");
  }

  return {
    authId: env.PLIVO_AUTH_ID,
    authToken: env.PLIVO_AUTH_TOKEN,
    phoneNumber: env.PLIVO_PHONE_NUMBER,
  };
}

export class DefaultPlivoVoiceGateway implements PlivoVoiceGateway {
  public async createCall(input: CreatePlivoCallInput): Promise<CreatePlivoCallResult> {
    const config = requirePlivoConfiguration();
    const client = new plivo.Client(config.authId, config.authToken);
    const response = await client.calls.create(config.phoneNumber, input.to, input.answerUrl, {
      answerMethod: "POST",
      hangupUrl: input.hangupUrl,
      hangupMethod: "POST",
      callerName: input.callerName,
      ringTimeout: 45,
    });
    const requestUuid = Array.isArray(response.requestUuid) ? response.requestUuid[0] : response.requestUuid;

    if (!requestUuid) {
      throw new AppError(502, "plivo_call_request_failed", "Plivo accepted the request but did not return a request UUID.");
    }

    return { requestUuid };
  }

  public buildStreamXml(input: BuildPlivoStreamXmlInput) {
    const response = plivo.Response();
    const introPrompt = input.introPrompt.trim();

    if (introPrompt) {
      response.addSpeak(introPrompt);
    }

    response.addStream(input.streamUrl, {
      contentType: "audio/x-mulaw;rate=8000",
      keepCallAlive: true,
      bidirectional: true,
    });

    return response.toXML();
  }

  public buildTransferXml(input: BuildPlivoTransferXmlInput) {
    const response = plivo.Response();
    const announcement = input.announcement.trim();

    if (announcement) {
      response.addSpeak(announcement);
    }

    const dial = response.addDial({
      redirect: false,
    });
    const transferTarget = input.transferTarget.trim();

    if (isPhoneTransferTarget(transferTarget)) {
      dial.addNumber(transferTarget);
    } else {
      dial.addUser(transferTarget);
    }

    return response.toXML();
  }

  public async transferCall(input: TransferPlivoCallInput) {
    const config = requirePlivoConfiguration();
    const client = new plivo.Client(config.authId, config.authToken);

    await client.calls.transfer(input.callUuid, {
      legs: "aleg",
      alegUrl: input.transferUrl,
      alegMethod: input.transferMethod ?? "POST",
      blegUrl: "",
      blegMethod: "POST",
    });
  }

  public assertValidSignature(input: ValidatePlivoSignatureInput) {
    if (!env.PLIVO_VALIDATE_SIGNATURES) {
      return;
    }

    const config = requirePlivoConfiguration();
    const signatureHeader = input.headers["x-plivo-signature-v3"];
    const nonceHeader = input.headers["x-plivo-signature-v3-nonce"];
    const signature = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader;
    const nonce = Array.isArray(nonceHeader) ? nonceHeader[0] : nonceHeader;

    if (!signature || !nonce) {
      throw new AppError(401, "invalid_plivo_signature", "The Plivo signature headers are missing.");
    }

    const isValid = plivo.validateV3Signature(input.method.toUpperCase(), input.url, nonce, config.authToken, signature, input.params);

    if (!isValid) {
      throw new AppError(401, "invalid_plivo_signature", "The Plivo webhook signature is invalid.");
    }
  }
}

export function createPlivoVoiceGateway() {
  return new DefaultPlivoVoiceGateway();
}
