import type { WebSocket } from "ws";

import type { SupportedLanguage } from "../../domain/enums.js";
import { logger } from "../../lib/logger.js";
import type { BackendRepositories, VoiceCallSession } from "../../repositories/backend-repositories.js";
import { decodeMulawToPcm16Le } from "./audio-codecs.js";
import {
  createVoiceFieldExtractor,
  createVoicePromptSynthesizer,
  createVoiceRecognizerFactory,
  type VoiceFieldExtractor,
  type VoicePromptAudio,
  type VoicePromptSynthesizer,
  type VoiceRecognizer,
  type VoiceRecognizerFactory,
} from "./voice-ai.js";
import type { VoiceService } from "./voice.service.js";

interface VoicePromptBinding {
  playAudio(input: VoicePromptAudio): void;
  clearAudio(): void;
}

interface CollectedFieldState {
  readonly fieldKey: string;
  readonly label: string;
  readonly rawValue?: string;
  readonly maskedValue: string;
  readonly sensitive: boolean;
  readonly confidenceScore: number;
  confirmed: boolean;
}

interface ActiveVoiceStream {
  readonly socket: WebSocket;
  readonly recognizer: VoiceRecognizer;
  readonly session: VoiceCallSession;
  readonly binding: VoicePromptBinding;
  readonly retryCountByFieldKey: Map<string, number>;
  readonly collectedByFieldKey: Map<string, CollectedFieldState>;
  processing: Promise<void>;
  promptTurn: number;
  lastProcessedInput: { transcript: string; promptTurn: number } | null;
  stage: "field" | "confirmation" | "completed";
  currentFieldIndex: number;
}

interface VoiceRuntimeDependencies {
  readonly voiceService: Pick<VoiceService, "initializeStreamSession" | "transferToHuman">;
  readonly repositories: Pick<BackendRepositories, "voice">;
  readonly recognizerFactory: VoiceRecognizerFactory;
  readonly synthesizer: VoicePromptSynthesizer;
  readonly extractor: VoiceFieldExtractor;
}

const localizedCopy: Record<
  SupportedLanguage,
  {
    readonly retryPrefix: string;
    readonly confirmPrefix: string;
    readonly confirmSuffix: string;
    readonly correctionPrompt: string;
    readonly completionPrompt: string;
  }
> = {
  hindi: {
    retryPrefix: "Maaf kijiye,",
    confirmPrefix: "Kripya pushti karein:",
    confirmSuffix: "Kya yeh sahi hai?",
    correctionPrompt: "Theek hai, chaliye phir se shuru karte hain.",
    completionPrompt: "Dhanyavaad. Aapki jankari safalta se darj ho gayi hai.",
  },
  english: {
    retryPrefix: "Sorry,",
    confirmPrefix: "Please confirm:",
    confirmSuffix: "Is that correct?",
    correctionPrompt: "Alright, let's review the details once more.",
    completionPrompt: "Thank you. Your details have been captured successfully.",
  },
  tamil: {
    retryPrefix: "Mannikkavum,",
    confirmPrefix: "Dayavuseythu urudhi seiyungal:",
    confirmSuffix: "Idhu sariyaa?",
    correctionPrompt: "Sari, meendum oru murai vivarangalai paarppom.",
    completionPrompt: "Nandri. Ungal vivarangal vettrikaramaga pathivu seiyyappattana.",
  },
  telugu: {
    retryPrefix: "Kshaminchandi,",
    confirmPrefix: "Dayachesi nirdharinchandi:",
    confirmSuffix: "Idi sari kada?",
    correctionPrompt: "Sare, marokkasari vivaralu chuddham.",
    completionPrompt: "Dhanyavadalu. Mee vivaralu safalyanga namodhu ayyayi.",
  },
  kannada: {
    retryPrefix: "Kshamisi,",
    confirmPrefix: "Dayavittu drudhikarisiri:",
    confirmSuffix: "Idhu sariyaa?",
    correctionPrompt: "Sari, mattomme vivaragalannu parishiilisona.",
    completionPrompt: "Dhanyavaadagalu. Nimma vivaragalu yashasviyagi dakhale aagive.",
  },
  bengali: {
    retryPrefix: "Dukkhito,",
    confirmPrefix: "Doya kore nischit korun:",
    confirmSuffix: "Eta ki thik?",
    correctionPrompt: "Thik ache, tahole abar ekbar dekhchi.",
    completionPrompt: "Dhonnobad. Apnar tothyo saphollo bhabe grohon kora hoyeche.",
  },
  marathi: {
    retryPrefix: "Maaf kara,",
    confirmPrefix: "Kripaya pushti kara:",
    confirmSuffix: "He barobar aahe ka?",
    correctionPrompt: "Chala, mag ha tapashil punha ekda gheu.",
    completionPrompt: "Dhanyavaad. Tumchi mahiti yashasvipane nondavali aahe.",
  },
  gujarati: {
    retryPrefix: "Maaf karsho,",
    confirmPrefix: "Krupa kari ne pushti karo:",
    confirmSuffix: "Shu aa sachu chhe?",
    correctionPrompt: "Saru, chalo fari ek vaar vigato joi lai'e.",
    completionPrompt: "Aabhar. Tamari mahiti safalta purvak darj thai gayi chhe.",
  },
  urdu: {
    retryPrefix: "Maaf kijiye,",
    confirmPrefix: "Barah e karam tasdeeq kijiye:",
    confirmSuffix: "Kya yeh theek hai?",
    correctionPrompt: "Theek hai, aaiye dobara maloomat lete hain.",
    completionPrompt: "Shukriya. Aap ki maloomat kamyabi se darj kar li gayi hai.",
  },
};

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function maskSensitiveValue(value: string) {
  const compact = value.replace(/\s+/gu, "");

  if (compact.length <= 4) {
    return "*".repeat(Math.max(compact.length, 4));
  }

  return `${"*".repeat(Math.max(compact.length - 4, 2))}${compact.slice(-4)}`;
}

function buildFlexibleIdentifierRedactionPattern(rawValue: string) {
  const compact = rawValue.replace(/\s+/gu, "").toUpperCase();

  if (!compact || !/^[A-Z0-9]+$/u.test(compact)) {
    return null;
  }

  const digitAlternatives: Record<string, string> = {
    "0": "(?:0|zero|oh|shunya|sifar)",
    "1": "(?:1|one|ek)",
    "2": "(?:2|two|do)",
    "3": "(?:3|three|teen)",
    "4": "(?:4|four|char|chaar)",
    "5": "(?:5|five|paanch|panch)",
    "6": "(?:6|six|chhe|chhai)",
    "7": "(?:7|seven|saat|sat)",
    "8": "(?:8|eight|aath|ath)",
    "9": "(?:9|nine|nau)",
  };

  const pattern = compact
    .split("")
    .map((character) => digitAlternatives[character] ?? escapeRegExp(character))
    .join("[\\s\\-_/.,:]*");

  return new RegExp(pattern, "giu");
}

function redactTranscript(text: string, replacements: Array<{ raw: string; masked: string }>) {
  let redactedText = text;

  for (const replacement of replacements) {
    if (!replacement.raw.trim()) {
      continue;
    }

    redactedText = redactedText.replace(new RegExp(escapeRegExp(replacement.raw), "giu"), replacement.masked);

    const flexiblePattern = buildFlexibleIdentifierRedactionPattern(replacement.raw);

    if (flexiblePattern) {
      redactedText = redactedText.replace(flexiblePattern, replacement.masked);
    }
  }

  return redactedText;
}

function findNextFieldIndex(session: VoiceCallSession, collectedByFieldKey: Map<string, CollectedFieldState>) {
  return session.fields.findIndex((field) => !collectedByFieldKey.has(field.field_key));
}

function buildRecognitionPrompt(session: VoiceCallSession, fieldIndex: number) {
  const currentField = session.fields[fieldIndex];

  if (!currentField) {
    return `${session.purposeStatement}. The caller is now confirming the collected details.`;
  }

  return [
    `Campaign purpose: ${session.purposeStatement}.`,
    `Current field: ${currentField.label}.`,
    `Expected response type: ${currentField.type}.`,
    currentField.validation_rule ? `Validation rule: ${currentField.validation_rule}.` : "",
    currentField.sensitive ? "The field may contain sensitive identifiers and alphanumeric entities." : "",
  ]
    .filter(Boolean)
    .join(" ");
}

function buildConfirmationPrompt(state: ActiveVoiceStream) {
  const copy = localizedCopy[state.session.language];
  const summary = state.session.fields
    .map((field) => {
      const collected = state.collectedByFieldKey.get(field.field_key);

      if (!collected) {
        return null;
      }

      return `${field.verification_label || field.label} ${collected.maskedValue}`;
    })
    .filter((entry): entry is string => Boolean(entry));

  return `${copy.confirmPrefix} ${summary.join(". ")}. ${copy.confirmSuffix}`;
}

function buildRetryPrompt(language: SupportedLanguage, fieldPrompt: string) {
  const copy = localizedCopy[language];
  return `${copy.retryPrefix} ${fieldPrompt}`;
}

function buildRetryTranscriptRedaction(sensitive: boolean, transcript: string) {
  return sensitive ? "[Sensitive response redacted]" : transcript;
}

function buildConfirmationTranscriptRedaction(state: ActiveVoiceStream, transcript: string, confirmed: boolean) {
  if (confirmed) {
    return transcript;
  }

  const hasSensitiveFields = [...state.collectedByFieldKey.values()].some((field) => field.sensitive);
  return hasSensitiveFields ? "[Confirmation correction redacted]" : transcript;
}

function buildTransferTranscriptRedaction(state: ActiveVoiceStream, currentField: { sensitive: boolean } | null, transcript: string) {
  if (currentField?.sensitive) {
    return "[Transfer request redacted]";
  }

  const hasSensitiveFields = [...state.collectedByFieldKey.values()].some((field) => field.sensitive);
  return hasSensitiveFields ? "[Transfer request redacted]" : transcript;
}

export class VoiceRuntime {
  private readonly activeStreamBySocket = new WeakMap<WebSocket, ActiveVoiceStream>();

  public constructor(private readonly dependencies: VoiceRuntimeDependencies) {}

  private async appendTranscriptTurn(
    session: VoiceCallSession,
    speaker: "Bot" | "User" | "System",
    textRaw: string,
    textRedacted = textRaw,
  ) {
    await this.dependencies.repositories.voice.appendTranscriptTurn({
      providerCallId: session.providerCallId,
      speaker,
      textRaw,
      textRedacted,
    });
  }

  private async playPrompt(state: ActiveVoiceStream, promptText: string) {
    await this.appendTranscriptTurn(state.session, "Bot", promptText, promptText);
    state.binding.clearAudio();
    const audio = await this.dependencies.synthesizer.synthesize({
      text: promptText,
      language: state.session.language,
    });
    state.binding.playAudio(audio);
    state.promptTurn += 1;
  }

  private buildCollectedSummary(state: ActiveVoiceStream) {
    return state.session.fields
      .map((field) => {
        const collected = state.collectedByFieldKey.get(field.field_key);

        if (!collected) {
          return null;
        }

        return {
          label: field.verification_label || field.label,
          value: collected.maskedValue,
        };
      })
      .filter((entry): entry is { label: string; value: string } => Boolean(entry));
  }

  private async updateRecognitionPrompt(state: ActiveVoiceStream) {
    state.recognizer.updatePrompt(buildRecognitionPrompt(state.session, state.currentFieldIndex));
  }

  private async initiateHumanTransfer(
    state: ActiveVoiceStream,
    transcript: string,
    options: {
      currentField: { sensitive: boolean } | null;
      reason: "caller_request" | "retry_limit";
    },
  ) {
    await this.appendTranscriptTurn(
      state.session,
      "User",
      transcript,
      buildTransferTranscriptRedaction(state, options.currentField, transcript),
    );
    await this.appendTranscriptTurn(state.session, "System", "Transferring call to a human agent.");
    await this.dependencies.voiceService.transferToHuman({
      campaignId: state.session.campaignId,
      contactId: state.session.contactId,
      callUuid: state.session.providerCallId,
      reason: options.reason,
    });
    state.binding.clearAudio();
    state.stage = "completed";
    state.recognizer.close();
  }

  private async maybeTransferToHuman(
    state: ActiveVoiceStream,
    transcript: string,
    currentField: { sensitive: boolean } | null,
  ) {
    if (!state.session.transferEnabled) {
      return false;
    }

    const decision = await this.dependencies.extractor.classifyTransferIntent({
      transcript,
      language: state.session.language,
      collectedValues: this.buildCollectedSummary(state),
    });

    if (decision.outcome !== "transfer") {
      return false;
    }

    await this.initiateHumanTransfer(state, transcript, {
      currentField,
      reason: "caller_request",
    });
    return true;
  }

  private async resetCollection(state: ActiveVoiceStream) {
    state.collectedByFieldKey.clear();
    state.retryCountByFieldKey.clear();
    state.currentFieldIndex = 0;
    state.lastProcessedInput = null;
    state.stage = "field";

    await this.dependencies.repositories.voice.clearCollectedData(state.session.providerCallId);
    await this.dependencies.repositories.voice.updateCallStatus({
      providerCallId: state.session.providerCallId,
      status: "in_progress",
      disposition: "collecting_fields",
      confirmed: false,
      fieldsCollected: 0,
      fieldsTotal: state.session.fieldsTotal,
      transcriptMode: state.session.transcriptMode,
    });
    await this.updateRecognitionPrompt(state);
    await this.playPrompt(state, `${localizedCopy[state.session.language].correctionPrompt} ${state.session.fields[0]?.prompt ?? ""}`.trim());
  }

  private async confirmCollection(state: ActiveVoiceStream) {
    for (const field of state.session.fields) {
      const collected = state.collectedByFieldKey.get(field.field_key);

      if (!collected) {
        continue;
      }

      collected.confirmed = true;
      await this.dependencies.repositories.voice.upsertCollectedField({
        providerCallId: state.session.providerCallId,
        fieldKey: field.field_key,
        label: field.label,
        rawValue: collected.rawValue,
        maskedValue: collected.maskedValue,
        sensitive: collected.sensitive,
        confidenceScore: collected.confidenceScore,
        confirmed: true,
      });
    }

    await this.dependencies.repositories.voice.updateCallStatus({
      providerCallId: state.session.providerCallId,
      status: "in_progress",
      disposition: "confirmed",
      confirmed: true,
      fieldsCollected: state.collectedByFieldKey.size,
      fieldsTotal: state.session.fieldsTotal,
      transcriptMode: state.session.transcriptMode,
    });
    state.stage = "completed";
    await this.playPrompt(state, localizedCopy[state.session.language].completionPrompt);
  }

  private async processFieldTranscript(state: ActiveVoiceStream, transcript: string) {
    const currentField = state.session.fields[state.currentFieldIndex];

    if (!currentField) {
      state.stage = "confirmation";
      await this.playPrompt(state, buildConfirmationPrompt(state));
      return;
    }

    if (await this.maybeTransferToHuman(state, transcript, currentField)) {
      return;
    }

    const extraction = await this.dependencies.extractor.extractField({
      field: currentField,
      transcript,
      language: state.session.language,
      collectedValues: this.buildCollectedSummary(state),
    });

    if (extraction.outcome === "retry" || !extraction.value) {
      const nextRetryCount = (state.retryCountByFieldKey.get(currentField.field_key) ?? 0) + 1;
      state.retryCountByFieldKey.set(currentField.field_key, nextRetryCount);

      if (state.session.transferEnabled && nextRetryCount > currentField.retry_limit) {
        await this.initiateHumanTransfer(state, transcript, {
          currentField,
          reason: "retry_limit",
        });
        return;
      }

      await this.appendTranscriptTurn(
        state.session,
        "User",
        transcript,
        buildRetryTranscriptRedaction(currentField.sensitive, transcript),
      );
      await this.playPrompt(state, buildRetryPrompt(state.session.language, currentField.prompt));
      return;
    }

    const rawValue = extraction.value;
    const maskedValue = currentField.sensitive ? maskSensitiveValue(rawValue) : rawValue;
    const redactedTranscript = currentField.sensitive
      ? redactTranscript(transcript, [{ raw: rawValue, masked: maskedValue }])
      : transcript;

    await this.appendTranscriptTurn(state.session, "User", transcript, redactedTranscript);
    await this.dependencies.repositories.voice.upsertCollectedField({
      providerCallId: state.session.providerCallId,
      fieldKey: currentField.field_key,
      label: currentField.label,
      rawValue,
      maskedValue,
      sensitive: currentField.sensitive,
      confidenceScore: extraction.confidenceScore,
      confirmed: false,
    });

    state.collectedByFieldKey.set(currentField.field_key, {
      fieldKey: currentField.field_key,
      label: currentField.label,
      rawValue,
      maskedValue,
      sensitive: currentField.sensitive,
      confidenceScore: extraction.confidenceScore,
      confirmed: false,
    });
    state.retryCountByFieldKey.delete(currentField.field_key);
    state.currentFieldIndex = findNextFieldIndex(state.session, state.collectedByFieldKey);

    const fieldsCollected = state.collectedByFieldKey.size;
    const nextStage = state.currentFieldIndex === -1 ? "confirmation" : "field";
    state.stage = nextStage;

    await this.dependencies.repositories.voice.updateCallStatus({
      providerCallId: state.session.providerCallId,
      status: "in_progress",
      disposition: nextStage === "confirmation" ? "awaiting_confirmation" : "collecting_fields",
      confirmed: false,
      fieldsCollected,
      fieldsTotal: state.session.fieldsTotal,
      transcriptMode: state.session.transcriptMode,
    });

    if (nextStage === "confirmation") {
      await this.updateRecognitionPrompt(state);
      await this.playPrompt(state, buildConfirmationPrompt(state));
      return;
    }

    await this.updateRecognitionPrompt(state);
    await this.playPrompt(state, state.session.fields[state.currentFieldIndex]?.prompt ?? "");
  }

  private async processConfirmationTranscript(state: ActiveVoiceStream, transcript: string) {
    if (await this.maybeTransferToHuman(state, transcript, null)) {
      return;
    }

    const decision = await this.dependencies.extractor.classifyConfirmation({
      transcript,
      language: state.session.language,
      summary: this.buildCollectedSummary(state),
    });
    await this.appendTranscriptTurn(
      state.session,
      "User",
      transcript,
      buildConfirmationTranscriptRedaction(state, transcript, decision.outcome === "confirmed"),
    );

    if (decision.outcome === "confirmed") {
      await this.confirmCollection(state);
      return;
    }

    await this.resetCollection(state);
  }

  private enqueueTranscriptProcessing(state: ActiveVoiceStream, transcript: string) {
    const promptTurn = state.promptTurn;

    state.processing = state.processing
      .then(async () => {
        const normalizedTranscript = transcript.trim();

        if (
          !normalizedTranscript ||
          (state.lastProcessedInput?.transcript === normalizedTranscript && state.lastProcessedInput.promptTurn === promptTurn) ||
          state.stage === "completed"
        ) {
          return;
        }

        state.lastProcessedInput = {
          transcript: normalizedTranscript,
          promptTurn,
        };

        if (state.stage === "confirmation") {
          await this.processConfirmationTranscript(state, normalizedTranscript);
          return;
        }

        await this.processFieldTranscript(state, normalizedTranscript);
      })
      .catch((error: unknown) => {
        logger.error({ err: error, callUuid: state.session.providerCallId }, "Failed to process a voice transcript.");
      });
  }

  public async startConnection(
    socket: WebSocket,
    input: {
      campaignId: string;
      contactId: string;
      callUuid: string;
      playAudio: VoicePromptBinding["playAudio"];
      clearAudio: VoicePromptBinding["clearAudio"];
    },
  ) {
    const session = await this.dependencies.voiceService.initializeStreamSession({
      campaignId: input.campaignId,
      contactId: input.contactId,
      callUuid: input.callUuid,
    });
    const collectedByFieldKey = new Map<string, CollectedFieldState>(
      session.collectedData.map((field) => [
        field.fieldKey,
        {
          fieldKey: field.fieldKey,
          label: field.label,
          rawValue: field.rawValue,
          maskedValue: field.maskedValue,
          sensitive: field.sensitive,
          confidenceScore: field.confidenceScore,
          confirmed: field.confirmed,
        },
      ]),
    );
    const currentFieldIndex = findNextFieldIndex(session, collectedByFieldKey);
    const recognizer = await this.dependencies.recognizerFactory.connect({
      language: session.language,
      prompt: buildRecognitionPrompt(session, currentFieldIndex === -1 ? session.fields.length : currentFieldIndex),
    });
    const state: ActiveVoiceStream = {
      socket,
      recognizer,
      session,
      binding: {
        playAudio: input.playAudio,
        clearAudio: input.clearAudio,
      },
      retryCountByFieldKey: new Map(),
      collectedByFieldKey,
      processing: Promise.resolve(),
      promptTurn: 0,
      lastProcessedInput: null,
      stage: currentFieldIndex === -1 ? "confirmation" : "field",
      currentFieldIndex: currentFieldIndex === -1 ? session.fields.length : currentFieldIndex,
    };

    recognizer.onTranscript((transcript) => {
      this.enqueueTranscriptProcessing(state, transcript);
    });
    recognizer.onError((error) => {
      logger.error({ err: error, callUuid: session.providerCallId }, "Live speech recognizer error.");
    });

    this.activeStreamBySocket.set(socket, state);

    if (state.stage === "confirmation") {
      await this.playPrompt(state, buildConfirmationPrompt(state));
    } else {
      await this.playPrompt(state, state.session.fields[state.currentFieldIndex]?.prompt ?? "");
    }

    return session;
  }

  public handleInboundAudio(socket: WebSocket, track: string, audioPayloadBase64: string) {
    if (track.toLowerCase() !== "inbound") {
      return;
    }

    const state = this.activeStreamBySocket.get(socket);

    if (!state) {
      return;
    }

    const pcmAudio = decodeMulawToPcm16Le(Buffer.from(audioPayloadBase64, "base64"));
    state.recognizer.pushPcmAudio(pcmAudio);
  }

  public closeConnection(socket: WebSocket) {
    const state = this.activeStreamBySocket.get(socket);

    if (!state) {
      return;
    }

    state.recognizer.close();
    this.activeStreamBySocket.delete(socket);
  }
}

export function createVoiceRuntime(
  voiceService: Pick<VoiceService, "initializeStreamSession" | "transferToHuman">,
  repositories: Pick<BackendRepositories, "voice">,
) {
  return new VoiceRuntime({
    voiceService,
    repositories,
    recognizerFactory: createVoiceRecognizerFactory(),
    synthesizer: createVoicePromptSynthesizer(),
    extractor: createVoiceFieldExtractor(),
  });
}
