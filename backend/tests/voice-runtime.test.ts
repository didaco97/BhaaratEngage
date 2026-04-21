import type { WebSocket } from "ws";
import { describe, expect, it, vi } from "vitest";

import type { CampaignField } from "../src/modules/campaigns/campaign.schemas.js";
import { VoiceRuntime } from "../src/modules/voice/voice-runtime.js";
import { heuristicExtractFieldValue } from "../src/modules/voice/voice-ai.js";
import type {
  VoiceConfirmationDecision,
  VoiceFieldExtractionResult,
  VoicePromptAudio,
  VoiceRecognizer,
} from "../src/modules/voice/voice-ai.js";
import type { VoiceCallSession, VoiceSessionCollectedField } from "../src/repositories/backend-repositories.js";

class FakeRecognizer implements VoiceRecognizer {
  private transcriptHandler: ((transcript: string) => void) | null = null;
  private errorHandler: ((error: Error) => void) | null = null;

  public updatePrompt = vi.fn();
  public pushPcmAudio = vi.fn();
  public close = vi.fn();

  public onTranscript(callback: (transcript: string) => void) {
    this.transcriptHandler = callback;
  }

  public onError(callback: (error: Error) => void) {
    this.errorHandler = callback;
  }

  public emitTranscript(transcript: string) {
    this.transcriptHandler?.(transcript);
  }

  public emitError(error: Error) {
    this.errorHandler?.(error);
  }
}

const sensitiveField: CampaignField = {
  field_key: "pan_number",
  label: "PAN number",
  prompt: "Please share your PAN number.",
  type: "text",
  required: true,
  sensitive: true,
  verification_label: "PAN",
  retry_limit: 2,
  validation_rule: "PAN format",
};

const booleanField: CampaignField = {
  field_key: "renewal_confirm",
  label: "Renewal confirmation",
  prompt: "Would you like to proceed?",
  type: "boolean",
  required: true,
  sensitive: false,
  verification_label: "Renewal confirmation",
  retry_limit: 2,
  validation_rule: "Yes or no",
};

const aadhaarField: CampaignField = {
  field_key: "aadhaar_number",
  label: "Aadhaar number",
  prompt: "Please share your Aadhaar number.",
  type: "text",
  required: true,
  sensitive: true,
  verification_label: "Aadhaar",
  retry_limit: 2,
  validation_rule: "Aadhaar format",
};

function createSession(overrides: Partial<VoiceCallSession> = {}): VoiceCallSession {
  const fields = overrides.fields ?? [sensitiveField];

  return {
    callRecordId: "call-voice-runtime-001",
    providerCallId: "plivo-call-runtime-001",
    campaignId: "camp-voice-runtime-001",
    campaignName: "KYC Runtime",
    contactId: "contact-voice-runtime-001",
    contactName: "Asha Sharma",
    phone: "+919999999999",
    language: "hindi",
    introPrompt: "Namaste",
    purposeStatement: "Collect PAN details",
    transferEnabled: overrides.transferEnabled ?? false,
    transferQueue: overrides.transferQueue ?? "",
    transferTarget: overrides.transferTarget ?? null,
    transcriptMode: "restricted",
    fieldsCollected: overrides.collectedData?.length ?? 0,
    fieldsTotal: fields.length,
    fields,
    collectedData: overrides.collectedData ?? [],
    ...overrides,
  };
}

function createCollectedField(overrides: Partial<VoiceSessionCollectedField> = {}): VoiceSessionCollectedField {
  return {
    fieldKey: "pan_number",
    label: "PAN number",
    rawValue: "ABCDE1234F",
    maskedValue: "******234F",
    confidenceScore: 0.94,
    confirmed: false,
    sensitive: true,
    ...overrides,
  };
}

function createRuntimeFixture(session: VoiceCallSession, behavior: {
  extractField?: VoiceFieldExtractionResult | ((input: {
    field: CampaignField;
    transcript: string;
    language: VoiceCallSession["language"];
    collectedValues: Array<{ label: string; value: string }>;
  }) => VoiceFieldExtractionResult | Promise<VoiceFieldExtractionResult>);
  classifyConfirmation?: VoiceConfirmationDecision;
  classifyTransferIntent?: { outcome: "transfer" | "continue" };
} = {}) {
  const recognizer = new FakeRecognizer();
  const appendTranscriptTurn = vi.fn(async () => undefined);
  const upsertCollectedField = vi.fn(async (input) => ({
    fieldKey: input.fieldKey,
    label: input.label,
    value: input.maskedValue ?? input.rawValue ?? "",
    confidenceScore: input.confidenceScore,
    confirmed: input.confirmed,
    masked: input.sensitive,
  }));
  const clearCollectedData = vi.fn(async () => undefined);
  const updateCallStatus = vi.fn(async () => null);
  const transferToHuman = vi.fn(async () => ({
    callRecordId: session.callRecordId,
    transferQueue: session.transferQueue,
    transferUrl: "https://voice.example.com/voice/plivo/transfer",
  }));
  const synthesize = vi.fn(
    async ({ text }: { text: string }): Promise<VoicePromptAudio> => ({
      contentType: "audio/x-mulaw",
      sampleRate: 8000,
      audio: Buffer.from(text, "utf8"),
    }),
  );
  const playAudio = vi.fn();
  const clearAudio = vi.fn();

  const runtime = new VoiceRuntime({
    voiceService: {
      initializeStreamSession: async () => session,
      transferToHuman,
    },
    repositories: {
      voice: {
        resolveScope: async () => ({
          organizationId: "org-voice-runtime-001",
          campaignId: session.campaignId,
          contactId: session.contactId,
        }),
        ensureCallSession: async () => session,
        appendTranscriptTurn,
        upsertCollectedField,
        clearCollectedData,
        updateCallStatus,
      },
    },
    recognizerFactory: {
      connect: async () => recognizer,
    },
    synthesizer: {
      synthesize,
    },
    extractor: {
      extractField: async (input) => {
        if (typeof behavior.extractField === "function") {
          return behavior.extractField(input);
        }

        return (
          behavior.extractField ?? {
            outcome: "retry",
            value: null,
            confidenceScore: 0,
          }
        );
      },
      classifyConfirmation: async () =>
        behavior?.classifyConfirmation ?? {
          outcome: "retry",
        },
      classifyTransferIntent: async () =>
        behavior?.classifyTransferIntent ?? {
          outcome: "continue",
        },
    },
  });

  return {
    runtime,
    recognizer,
    appendTranscriptTurn,
    upsertCollectedField,
    clearCollectedData,
    updateCallStatus,
    synthesize,
    transferToHuman,
    playAudio,
    clearAudio,
  };
}

async function flushVoiceRuntime() {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await Promise.resolve();
}

describe("voice runtime", () => {
  it("preserves hidden raw values when confirming a resumed sensitive field", async () => {
    const session = createSession({
      collectedData: [createCollectedField()],
    });
    const fixture = createRuntimeFixture(session, {
      classifyConfirmation: { outcome: "confirmed" },
    });

    await fixture.runtime.startConnection({} as WebSocket, {
      campaignId: session.campaignId,
      contactId: session.contactId,
      callUuid: session.providerCallId,
      playAudio: fixture.playAudio,
      clearAudio: fixture.clearAudio,
    });

    fixture.recognizer.emitTranscript("yes");
    await flushVoiceRuntime();

    expect(fixture.upsertCollectedField).toHaveBeenCalledWith({
      providerCallId: session.providerCallId,
      fieldKey: "pan_number",
      label: "PAN number",
      rawValue: "ABCDE1234F",
      maskedValue: "******234F",
      sensitive: true,
      confidenceScore: 0.94,
      confirmed: true,
    });
    expect(fixture.clearCollectedData).not.toHaveBeenCalled();
  });

  it("captures and redacts a code-switched PAN response end to end", async () => {
    const session = createSession();
    const fixture = createRuntimeFixture(session, {
      extractField: ({ field, transcript }) => heuristicExtractFieldValue(field, transcript),
      classifyConfirmation: { outcome: "confirmed" },
    });

    await fixture.runtime.startConnection({} as WebSocket, {
      campaignId: session.campaignId,
      contactId: session.contactId,
      callUuid: session.providerCallId,
      playAudio: fixture.playAudio,
      clearAudio: fixture.clearAudio,
    });

    fixture.recognizer.emitTranscript("Mera PAN number A B C D E ek do teen char F");
    await flushVoiceRuntime();

    expect(fixture.appendTranscriptTurn).toHaveBeenCalledWith({
      providerCallId: session.providerCallId,
      speaker: "User",
      textRaw: "Mera PAN number A B C D E ek do teen char F",
      textRedacted: "Mera PAN number ******234F",
    });

    fixture.recognizer.emitTranscript("haan");
    await flushVoiceRuntime();

    expect(fixture.upsertCollectedField).toHaveBeenCalledWith({
      providerCallId: session.providerCallId,
      fieldKey: "pan_number",
      label: "PAN number",
      rawValue: "ABCDE1234F",
      maskedValue: "******234F",
      sensitive: true,
      confidenceScore: 0.92,
      confirmed: true,
    });
  });

  it("redacts retry transcripts for sensitive fields and clears queued audio before replaying prompts", async () => {
    const session = createSession();
    const fixture = createRuntimeFixture(session, {
      extractField: {
        outcome: "retry",
        value: null,
        confidenceScore: 0.18,
      },
    });

    await fixture.runtime.startConnection({} as WebSocket, {
      campaignId: session.campaignId,
      contactId: session.contactId,
      callUuid: session.providerCallId,
      playAudio: fixture.playAudio,
      clearAudio: fixture.clearAudio,
    });

    fixture.recognizer.emitTranscript("My PAN is ABCDE1234F");
    await flushVoiceRuntime();

    expect(fixture.appendTranscriptTurn).toHaveBeenCalledWith({
      providerCallId: session.providerCallId,
      speaker: "User",
      textRaw: "My PAN is ABCDE1234F",
      textRedacted: "[Sensitive response redacted]",
    });
    expect(fixture.clearAudio).toHaveBeenCalledTimes(2);
    expect(fixture.playAudio).toHaveBeenCalledTimes(2);
  });

  it("normalizes code-switched Aadhaar transcripts into a canonical identifier", () => {
    const extraction = heuristicExtractFieldValue(aadhaarField, "Mera Aadhaar number ek do teen char paanch chhe saat aath nau zero ek do");

    expect(extraction).toEqual({
      outcome: "captured",
      value: "123456789012",
      confidenceScore: 0.9,
    });
  });

  it("redacts confirmation corrections that mention sensitive data before restarting collection", async () => {
    const session = createSession({
      collectedData: [createCollectedField()],
    });
    const fixture = createRuntimeFixture(session, {
      classifyConfirmation: { outcome: "retry" },
    });

    await fixture.runtime.startConnection({} as WebSocket, {
      campaignId: session.campaignId,
      contactId: session.contactId,
      callUuid: session.providerCallId,
      playAudio: fixture.playAudio,
      clearAudio: fixture.clearAudio,
    });

    fixture.recognizer.emitTranscript("No, my PAN is ABCDE1234F");
    await flushVoiceRuntime();

    expect(fixture.appendTranscriptTurn).toHaveBeenCalledWith({
      providerCallId: session.providerCallId,
      speaker: "User",
      textRaw: "No, my PAN is ABCDE1234F",
      textRedacted: "[Confirmation correction redacted]",
    });
    expect(fixture.clearCollectedData).toHaveBeenCalledWith(session.providerCallId);
    expect(fixture.updateCallStatus).toHaveBeenCalledWith({
      providerCallId: session.providerCallId,
      status: "in_progress",
      disposition: "collecting_fields",
      confirmed: false,
      fieldsCollected: 0,
      fieldsTotal: session.fieldsTotal,
      transcriptMode: session.transcriptMode,
    });
  });

  it("allows the same transcript text on later turns after the prompt changes", async () => {
    const session = createSession({
      fields: [booleanField],
      collectedData: [],
    });
    const fixture = createRuntimeFixture(session, {
      extractField: {
        outcome: "captured",
        value: "Yes",
        confidenceScore: 0.92,
      },
      classifyConfirmation: { outcome: "confirmed" },
    });

    await fixture.runtime.startConnection({} as WebSocket, {
      campaignId: session.campaignId,
      contactId: session.contactId,
      callUuid: session.providerCallId,
      playAudio: fixture.playAudio,
      clearAudio: fixture.clearAudio,
    });

    fixture.recognizer.emitTranscript("yes");
    await flushVoiceRuntime();
    fixture.recognizer.emitTranscript("yes");
    await flushVoiceRuntime();

    expect(fixture.upsertCollectedField).toHaveBeenCalledTimes(2);
    expect(fixture.upsertCollectedField).toHaveBeenLastCalledWith({
      providerCallId: session.providerCallId,
      fieldKey: "renewal_confirm",
      label: "Renewal confirmation",
      rawValue: "Yes",
      maskedValue: "Yes",
      sensitive: false,
      confidenceScore: 0.92,
      confirmed: true,
    });
    expect(fixture.updateCallStatus).toHaveBeenLastCalledWith({
      providerCallId: session.providerCallId,
      status: "in_progress",
      disposition: "confirmed",
      confirmed: true,
      fieldsCollected: 1,
      fieldsTotal: 1,
      transcriptMode: session.transcriptMode,
    });
  });

  it("transfers to a human agent when the caller explicitly asks for one", async () => {
    const session = createSession({
      transferEnabled: true,
      transferQueue: "Priority Desk",
      transferTarget: "+918000000106",
    });
    const fixture = createRuntimeFixture(session, {
      classifyTransferIntent: { outcome: "transfer" },
    });

    await fixture.runtime.startConnection({} as WebSocket, {
      campaignId: session.campaignId,
      contactId: session.contactId,
      callUuid: session.providerCallId,
      playAudio: fixture.playAudio,
      clearAudio: fixture.clearAudio,
    });

    fixture.recognizer.emitTranscript("Connect me to a human agent");
    await flushVoiceRuntime();

    expect(fixture.transferToHuman).toHaveBeenCalledWith({
      campaignId: session.campaignId,
      contactId: session.contactId,
      callUuid: session.providerCallId,
      reason: "caller_request",
    });
    expect(fixture.appendTranscriptTurn).toHaveBeenCalledWith({
      providerCallId: session.providerCallId,
      speaker: "System",
      textRaw: "Transferring call to a human agent.",
      textRedacted: "Transferring call to a human agent.",
    });
  });
});
