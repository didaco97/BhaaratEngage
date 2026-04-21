import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { SarvamAIClient, type SarvamAI } from "sarvamai";
import { z } from "zod";

import { env } from "../../config/env.js";
import type { SupportedLanguage } from "../../domain/enums.js";
import { AppError } from "../../lib/http-errors.js";
import type { CampaignField } from "../campaigns/campaign.schemas.js";

interface SarvamRecognizerSocket {
  on(event: "message", callback: (message: SarvamAI.SpeechToTextStreamingResponse) => void): void;
  on(event: "error", callback: (error: Error) => void): void;
  sendConfigMessage(message: SarvamAI.ConfigMessage): void;
  transcribe(params: { audio: string; sample_rate?: number; encoding?: string }): void;
  flush(): void;
  close(): void;
}

export interface VoiceRecognizer {
  updatePrompt(prompt: string): void;
  pushPcmAudio(audio: Buffer): void;
  onTranscript(callback: (transcript: string) => void): void;
  onError(callback: (error: Error) => void): void;
  close(): void;
}

export interface VoiceRecognizerFactory {
  connect(input: { language: SupportedLanguage; prompt: string }): Promise<VoiceRecognizer>;
}

export interface VoicePromptAudio {
  readonly contentType: string;
  readonly sampleRate: number;
  readonly audio: Buffer;
}

export interface VoicePromptSynthesizer {
  synthesize(input: { text: string; language: SupportedLanguage }): Promise<VoicePromptAudio>;
}

export interface VoiceFieldExtractionResult {
  readonly outcome: "captured" | "retry";
  readonly value: string | null;
  readonly confidenceScore: number;
}

export interface VoiceConfirmationDecision {
  readonly outcome: "confirmed" | "retry";
}

export interface VoiceTransferDecision {
  readonly outcome: "transfer" | "continue";
}

export interface VoiceFieldExtractor {
  extractField(input: {
    field: CampaignField;
    transcript: string;
    language: SupportedLanguage;
    collectedValues: Array<{ label: string; value: string }>;
  }): Promise<VoiceFieldExtractionResult>;
  classifyConfirmation(input: {
    transcript: string;
    language: SupportedLanguage;
    summary: Array<{ label: string; value: string }>;
  }): Promise<VoiceConfirmationDecision>;
  classifyTransferIntent(input: {
    transcript: string;
    language: SupportedLanguage;
    collectedValues: Array<{ label: string; value: string }>;
  }): Promise<VoiceTransferDecision>;
}

const fieldExtractionSchema = z.object({
  outcome: z.enum(["captured", "retry"]),
  value: z.string().trim().min(1).nullable(),
  confidenceScore: z.number().min(0).max(1),
});

const confirmationSchema = z.object({
  outcome: z.enum(["confirmed", "retry"]),
});

const transferIntentSchema = z.object({
  outcome: z.enum(["transfer", "continue"]),
});

const spokenDigitTokenMap = new Map<string, string>([
  ["zero", "0"],
  ["oh", "0"],
  ["shunya", "0"],
  ["sifar", "0"],
  ["one", "1"],
  ["ek", "1"],
  ["two", "2"],
  ["do", "2"],
  ["three", "3"],
  ["teen", "3"],
  ["four", "4"],
  ["char", "4"],
  ["chaar", "4"],
  ["five", "5"],
  ["paanch", "5"],
  ["panch", "5"],
  ["six", "6"],
  ["chhe", "6"],
  ["chhai", "6"],
  ["seven", "7"],
  ["saat", "7"],
  ["sat", "7"],
  ["eight", "8"],
  ["aath", "8"],
  ["ath", "8"],
  ["nine", "9"],
  ["nau", "9"],
]);

const identifierNoiseTokens = new Set([
  "my",
  "mera",
  "meri",
  "mere",
  "hamara",
  "hamari",
  "hamare",
  "tumhara",
  "tumhari",
  "tumhare",
  "aapka",
  "aapki",
  "aapke",
  "please",
  "kindly",
  "share",
  "provide",
  "tell",
  "say",
  "bataiye",
  "bataye",
  "kripya",
  "krupa",
  "daya",
  "kijiye",
  "karo",
  "karein",
  "hai",
  "hain",
  "tha",
  "thi",
  "the",
  "is",
  "to",
  "of",
  "for",
  "as",
  "per",
  "your",
  "you",
  "me",
  "mein",
  "main",
  "mujhe",
  "number",
  "no",
  "num",
  "digits",
  "digit",
  "card",
  "details",
  "detail",
  "id",
  "identifier",
  "pan",
  "aadhaar",
  "aadhar",
  "answer",
  "response",
]);

function isPanValidationRule(validationRule: string) {
  return validationRule.includes("pan");
}

function isAadhaarValidationRule(validationRule: string) {
  return validationRule.includes("aadhaar") || validationRule.includes("aadhar");
}

function tokenizeIdentifierTranscript(transcript: string) {
  return normalizeTranscriptValue(transcript)
    .toLowerCase()
    .split(/[^a-z0-9]+/u)
    .filter(Boolean)
    .map((token) => spokenDigitTokenMap.get(token) ?? token)
    .filter((token) => !identifierNoiseTokens.has(token));
}

function normalizeIdentifierTranscript(transcript: string) {
  return tokenizeIdentifierTranscript(transcript).join("").toUpperCase();
}

function normalizeFieldIdentifierValue(field: CampaignField, transcript: string) {
  const validationRule = field.validation_rule.toLowerCase();

  if (isPanValidationRule(validationRule)) {
    const normalizedTranscript = normalizeIdentifierTranscript(transcript);
    const panMatch = normalizedTranscript.match(/[A-Z]{5}\d{4}[A-Z]/u);
    return panMatch?.[0] ?? null;
  }

  if (isAadhaarValidationRule(validationRule)) {
    const normalizedTranscript = normalizeIdentifierTranscript(transcript);
    const aadhaarMatch = normalizedTranscript.match(/\d{12}/u);
    return aadhaarMatch?.[0] ?? null;
  }

  return normalizeTranscriptValue(transcript) || null;
}

function toSarvamSpeechLanguage(language: SupportedLanguage): SarvamAI.SpeechToTextStreamingLanguageCode {
  switch (language) {
    case "hindi":
      return "hi-IN";
    case "english":
      return "en-IN";
    case "tamil":
      return "ta-IN";
    case "telugu":
      return "te-IN";
    case "kannada":
      return "kn-IN";
    case "bengali":
      return "bn-IN";
    case "marathi":
      return "mr-IN";
    case "gujarati":
      return "gu-IN";
    case "urdu":
      return "ur-IN";
    default:
      return "unknown";
  }
}

function toSarvamTtsLanguage(language: SupportedLanguage): SarvamAI.TextToSpeechLanguage {
  switch (language) {
    case "hindi":
      return "hi-IN";
    case "english":
      return "en-IN";
    case "tamil":
      return "ta-IN";
    case "telugu":
      return "te-IN";
    case "kannada":
      return "kn-IN";
    case "bengali":
      return "bn-IN";
    case "marathi":
      return "mr-IN";
    case "gujarati":
      return "gu-IN";
    case "urdu":
      return "hi-IN";
    default:
      return "en-IN";
  }
}

function normalizeTranscriptValue(value: string) {
  return value.trim().replace(/\s+/gu, " ");
}

function matchesAnyPattern(value: string, patterns: readonly RegExp[]) {
  return patterns.some((pattern) => pattern.test(value));
}

function classifyYesNo(transcript: string) {
  const normalized = normalizeTranscriptValue(transcript).toLowerCase();

  if (!normalized) {
    return null;
  }

  const noSignals = [
    /\b(?:no|nahin|nahi|galat|wrong|incorrect|dobara)\b/u,
    /\bnot\s+(?:correct|right|okay|ok|confirmed)\b/u,
    /\b(?:do\s*not|don't|dont)\s+(?:confirm|proceed|continue)\b/u,
  ] as const;
  const yesSignals = [
    /\bji haan\b/u,
    /\b(?:yes|haan|ha|sahi|right|bilkul|confirmed|ok|okay|correct)\b/u,
  ] as const;

  if (matchesAnyPattern(normalized, noSignals)) {
    return false;
  }

  if (matchesAnyPattern(normalized, yesSignals)) {
    return true;
  }

  return null;
}

function classifyTransferRequest(transcript: string) {
  const normalized = normalizeTranscriptValue(transcript).toLowerCase();

  if (!normalized) {
    return false;
  }

  const transferDenySignals = [
    /\b(?:do\s*not|don't|dont|not)\s+(?:connect|transfer)\b/u,
    /\b(?:no need to|mat)\s+(?:connect|transfer)\b/u,
  ] as const;
  const transferSignals = [
    /\bcustomer care\b/u,
    /\bcustomer support\b/u,
    /\blive agent\b/u,
    /\bsomeone from your team\b/u,
    /\bagent se baat\b/u,
    /\brepresentative se\b/u,
    /\bhuman se baat\b/u,
    /\bspecialist se\b/u,
    /\bmanager se\b/u,
    /\bconnect me\b/u,
    /\btransfer me\b/u,
    /\b(?:agent|human|representative|supervisor|operator|support|person|insaan|aadmi)\b/u,
  ] as const;

  if (matchesAnyPattern(normalized, transferDenySignals)) {
    return false;
  }

  return matchesAnyPattern(normalized, transferSignals);
}

function heuristicExtractFieldValue(field: CampaignField, transcript: string): VoiceFieldExtractionResult {
  const normalizedTranscript = normalizeTranscriptValue(transcript);

  if (!normalizedTranscript) {
    return {
      outcome: "retry",
      value: null,
      confidenceScore: 0,
    };
  }

  const validationRule = field.validation_rule.toLowerCase();

  if (isPanValidationRule(validationRule)) {
    const normalizedIdentifier = normalizeIdentifierTranscript(transcript);
    const panMatch = normalizedIdentifier.match(/[A-Z]{5}\d{4}[A-Z]/u);

    if (panMatch) {
      return {
        outcome: "captured",
        value: panMatch[0],
        confidenceScore: 0.92,
      };
    }
  }

  if (isAadhaarValidationRule(validationRule)) {
    const normalizedIdentifier = normalizeIdentifierTranscript(transcript);
    const aadhaarMatch = normalizedIdentifier.match(/\d{12}/u);

    if (aadhaarMatch) {
      return {
        outcome: "captured",
        value: aadhaarMatch[0],
        confidenceScore: 0.9,
      };
    }
  }

  if (field.type === "boolean") {
    const yesNo = classifyYesNo(normalizedTranscript);

    if (yesNo === null) {
      return {
        outcome: "retry",
        value: null,
        confidenceScore: 0.2,
      };
    }

    return {
      outcome: "captured",
      value: yesNo ? "Yes" : "No",
      confidenceScore: 0.78,
    };
  }

  if (field.type === "number") {
    const digits = normalizedTranscript.match(/[\d,]+/u)?.[0]?.replace(/,/gu, "");

    if (!digits) {
      return {
        outcome: "retry",
        value: null,
        confidenceScore: 0.25,
      };
    }

    return {
      outcome: "captured",
      value: digits,
      confidenceScore: 0.76,
    };
  }

  return {
    outcome: "captured",
    value: normalizedTranscript,
    confidenceScore: field.type === "date" ? 0.62 : 0.7,
  };
}

class HeuristicVoiceFieldExtractor implements VoiceFieldExtractor {
  public async extractField(input: {
    field: CampaignField;
    transcript: string;
    language: SupportedLanguage;
    collectedValues: Array<{ label: string; value: string }>;
  }) {
    return heuristicExtractFieldValue(input.field, input.transcript);
  }

  public async classifyConfirmation(input: {
    transcript: string;
    language: SupportedLanguage;
    summary: Array<{ label: string; value: string }>;
  }) {
    return {
      outcome: classifyYesNo(input.transcript) ? "confirmed" : "retry",
    } satisfies VoiceConfirmationDecision;
  }

  public async classifyTransferIntent(input: {
    transcript: string;
    language: SupportedLanguage;
    collectedValues: Array<{ label: string; value: string }>;
  }) {
    return {
      outcome: classifyTransferRequest(input.transcript) ? "transfer" : "continue",
    } satisfies VoiceTransferDecision;
  }
}

class OpenAiVoiceFieldExtractor implements VoiceFieldExtractor {
  private readonly fallback = new HeuristicVoiceFieldExtractor();
  private readonly client: OpenAI | null;
  private readonly model: string;

  public constructor(model = env.OPENAI_VOICE_EXTRACTION_MODEL ?? "gpt-4o-mini") {
    this.client = env.OPENAI_API_KEY ? new OpenAI({ apiKey: env.OPENAI_API_KEY }) : null;
    this.model = model;
  }

  public async extractField(input: {
    field: CampaignField;
    transcript: string;
    language: SupportedLanguage;
    collectedValues: Array<{ label: string; value: string }>;
  }) {
    if (!this.client) {
      return this.fallback.extractField(input);
    }

    try {
      const completion = await this.client.chat.completions.parse({
        model: this.model,
        temperature: 0,
        messages: [
          {
            role: "system",
            content:
              "Extract one campaign field from a caller transcript. Capture a value only if the transcript directly answers the requested field. Return retry for unclear, unrelated, or empty answers.",
          },
          {
            role: "user",
            content: JSON.stringify({
              language: input.language,
              field: {
                key: input.field.field_key,
                label: input.field.label,
                prompt: input.field.prompt,
                type: input.field.type,
                required: input.field.required,
                sensitive: input.field.sensitive,
                verificationLabel: input.field.verification_label,
                validationRule: input.field.validation_rule,
              },
              alreadyCollected: input.collectedValues,
              transcript: input.transcript,
            }),
          },
        ],
        response_format: zodResponseFormat(fieldExtractionSchema, "voice_field_extraction"),
      });
      const parsed = completion.choices[0]?.message.parsed;

      if (!parsed) {
        return this.fallback.extractField(input);
      }

      if (parsed.outcome === "captured" && !parsed.value) {
        return this.fallback.extractField(input);
      }

      if (parsed.outcome === "captured") {
        const normalizedValue = parsed.value ? normalizeFieldIdentifierValue(input.field, parsed.value) : null;

        if (!normalizedValue) {
          return this.fallback.extractField(input);
        }

        return {
          ...parsed,
          value: normalizedValue,
        };
      }

      return parsed;
    } catch {
      return this.fallback.extractField(input);
    }
  }

  public async classifyConfirmation(input: {
    transcript: string;
    language: SupportedLanguage;
    summary: Array<{ label: string; value: string }>;
  }) {
    if (!this.client) {
      return this.fallback.classifyConfirmation(input);
    }

    try {
      const completion = await this.client.chat.completions.parse({
        model: this.model,
        temperature: 0,
        messages: [
          {
            role: "system",
            content:
              "Classify whether the caller confirmed the summary. Return confirmed only for clear affirmative confirmation. Return retry for corrections, uncertainty, or anything else.",
          },
          {
            role: "user",
            content: JSON.stringify({
              language: input.language,
              summary: input.summary,
              transcript: input.transcript,
            }),
          },
        ],
        response_format: zodResponseFormat(confirmationSchema, "voice_confirmation"),
      });
      const parsed = completion.choices[0]?.message.parsed;
      return parsed ?? (await this.fallback.classifyConfirmation(input));
    } catch {
      return this.fallback.classifyConfirmation(input);
    }
  }

  public async classifyTransferIntent(input: {
    transcript: string;
    language: SupportedLanguage;
    collectedValues: Array<{ label: string; value: string }>;
  }) {
    if (!this.client) {
      return this.fallback.classifyTransferIntent(input);
    }

    try {
      const completion = await this.client.chat.completions.parse({
        model: this.model,
        temperature: 0,
        messages: [
          {
            role: "system",
            content:
              "Classify whether the caller is explicitly asking to speak with a human agent, specialist, supervisor, or representative. Return transfer only for a clear escalation request.",
          },
          {
            role: "user",
            content: JSON.stringify({
              language: input.language,
              collectedValues: input.collectedValues,
              transcript: input.transcript,
            }),
          },
        ],
        response_format: zodResponseFormat(transferIntentSchema, "voice_transfer_intent"),
      });
      const parsed = completion.choices[0]?.message.parsed;
      return parsed ?? (await this.fallback.classifyTransferIntent(input));
    } catch {
      return this.fallback.classifyTransferIntent(input);
    }
  }
}

class SarvamSpeechRecognizer implements VoiceRecognizer {
  private transcriptHandler: ((transcript: string) => void) | null = null;
  private errorHandler: ((error: Error) => void) | null = null;

  public constructor(private readonly socket: SarvamRecognizerSocket) {
    this.socket.on("message", (message: SarvamAI.SpeechToTextStreamingResponse) => {
      if (message.type === "data" && "transcript" in message.data) {
        const transcript = normalizeTranscriptValue(message.data.transcript);

        if (transcript) {
          this.transcriptHandler?.(transcript);
        }
      }

      if (message.type === "events" && "signal_type" in message.data && message.data.signal_type === "END_SPEECH") {
        try {
          this.socket.flush();
        } catch {
          // The underlying socket may already be closing; the next connection lifecycle event will clean up.
        }
      }

      if (message.type === "error" && "error" in message.data) {
        this.errorHandler?.(new Error(message.data.error));
      }
    });

    this.socket.on("error", (error: Error) => {
      this.errorHandler?.(error);
    });
  }

  public updatePrompt(prompt: string) {
    this.socket.sendConfigMessage({
      type: "config",
      prompt,
    });
  }

  public pushPcmAudio(audio: Buffer) {
    this.socket.transcribe({
      audio: audio.toString("base64"),
      sample_rate: 8000,
      encoding: "pcm_s16le",
    });
  }

  public onTranscript(callback: (transcript: string) => void) {
    this.transcriptHandler = callback;
  }

  public onError(callback: (error: Error) => void) {
    this.errorHandler = callback;
  }

  public close() {
    this.socket.close();
  }
}

class SarvamSpeechRecognizerFactory implements VoiceRecognizerFactory {
  private readonly client = new SarvamAIClient({
    apiSubscriptionKey: env.SARVAM_API_KEY,
  });

  public async connect(input: { language: SupportedLanguage; prompt: string }) {
    if (!env.SARVAM_API_KEY) {
      throw new AppError(503, "sarvam_not_configured", "SARVAM_API_KEY must be configured before live voice transcription can start.");
    }

    const socket = await this.client.speechToTextStreaming.connect({
      "Api-Subscription-Key": env.SARVAM_API_KEY,
      "language-code": toSarvamSpeechLanguage(input.language),
      model: "saaras:v3" as unknown as SarvamAI.SpeechToTextTranslateModel,
      input_audio_codec: "pcm_s16le",
      sample_rate: "8000",
      vad_signals: "true",
      flush_signal: "true",
      high_vad_sensitivity: "true",
    });

    await socket.waitForOpen();

    const recognizer = new SarvamSpeechRecognizer(socket);
    recognizer.updatePrompt(input.prompt);
    return recognizer;
  }
}

class SarvamPromptSynthesizer implements VoicePromptSynthesizer {
  private readonly client = new SarvamAIClient({
    apiSubscriptionKey: env.SARVAM_API_KEY,
  });

  public async synthesize(input: { text: string; language: SupportedLanguage }): Promise<VoicePromptAudio> {
    if (!env.SARVAM_API_KEY) {
      throw new AppError(503, "sarvam_not_configured", "SARVAM_API_KEY must be configured before live voice prompts can be synthesized.");
    }

    const response = await this.client.textToSpeech.convert({
      text: input.text,
      target_language_code: toSarvamTtsLanguage(input.language),
      model: "bulbul:v3",
      speaker: "shubh",
      speech_sample_rate: 8000,
      output_audio_codec: "mulaw",
      temperature: 0.3,
      pace: 1,
    });
    const payload = response.audios[0];

    if (!payload) {
      throw new AppError(502, "sarvam_tts_failed", "Sarvam TTS did not return any audio.");
    }

    return {
      contentType: "audio/x-mulaw",
      sampleRate: 8000,
      audio: Buffer.from(payload, "base64"),
    };
  }
}

export function createVoiceRecognizerFactory(): VoiceRecognizerFactory {
  return new SarvamSpeechRecognizerFactory();
}

export function createVoicePromptSynthesizer(): VoicePromptSynthesizer {
  return new SarvamPromptSynthesizer();
}

export function createVoiceFieldExtractor(): VoiceFieldExtractor {
  return new OpenAiVoiceFieldExtractor();
}

export { classifyTransferRequest, classifyYesNo, heuristicExtractFieldValue };
