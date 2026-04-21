import { randomUUID } from "node:crypto";

import request from "supertest";
import type { WebSocket } from "ws";
import { describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";
import { createInMemoryRepositories } from "../src/repositories/in-memory-repositories.js";
import { VoiceRuntime } from "../src/modules/voice/voice-runtime.js";
import type { VoicePromptAudio, VoiceRecognizer } from "../src/modules/voice/voice-ai.js";
import type { PlivoVoiceGateway } from "../src/modules/voice/plivo.client.js";
import { VoiceService } from "../src/modules/voice/voice.service.js";

class FakeRecognizer implements VoiceRecognizer {
  private transcriptHandler: ((transcript: string) => void) | null = null;
  private errorHandler: ((error: Error) => void) | null = null;

  public updatePrompt(_prompt: string) {
    return undefined;
  }

  public pushPcmAudio(_audio: Buffer) {
    return undefined;
  }

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

  public close() {
    return undefined;
  }
}

function buildUniquePhone() {
  return `9${randomUUID().replace(/\D/gu, "").slice(0, 11).padEnd(11, "0")}`;
}

async function flushRuntimeQueue() {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await Promise.resolve();
}

describe("end-to-end acceptance flow", () => {
  it("creates a campaign, imports a contact, launches it, collects and confirms a field, then exposes the result through view and export routes", async () => {
    const repositories = createInMemoryRepositories();
    const app = createApp({ repositories });
    const recognizer = new FakeRecognizer();
    const campaignName = `E2E Campaign ${randomUUID().slice(0, 8)}`;
    const contactName = `E2E Contact ${randomUUID().slice(0, 8)}`;
    const contactPhone = buildUniquePhone();
    const callUuid = `plivo-e2e-${randomUUID()}`;

    const plivoGateway: PlivoVoiceGateway = {
      createCall: async () => ({ requestUuid: callUuid }),
      buildStreamXml: ({ streamUrl, introPrompt }) =>
        `<Response><Speak>${introPrompt}</Speak><Stream bidirectional="true">${streamUrl}</Stream></Response>`,
      buildTransferXml: () => "<Response><Dial /></Response>",
      transferCall: async () => undefined,
      assertValidSignature: () => undefined,
    };

    const voiceService = new VoiceService({
      repositories: {
        campaigns: repositories.campaigns,
        contacts: repositories.contacts,
        voice: repositories.voice,
      },
      plivoGateway,
      publicBaseUrl: "https://voice.example.com",
    });

    const voiceRuntime = new VoiceRuntime({
      voiceService: {
        initializeStreamSession: (input) => voiceService.initializeStreamSession(input),
        transferToHuman: (input) => voiceService.transferToHuman(input),
      },
      repositories: {
        voice: repositories.voice,
      },
      recognizerFactory: {
        connect: async () => recognizer,
      },
      synthesizer: {
        synthesize: async ({ text }): Promise<VoicePromptAudio> => ({
          contentType: "audio/x-mulaw",
          sampleRate: 8000,
          audio: Buffer.from(text, "utf8"),
        }),
      },
      extractor: {
        extractField: async () => ({
          outcome: "captured",
          value: "Pune",
          confidenceScore: 0.98,
        }),
        classifyConfirmation: async () => ({
          outcome: "confirmed",
        }),
        classifyTransferIntent: async () => ({
          outcome: "continue",
        }),
      },
    });

    const createCampaignResponse = await request(app).post("/api/campaigns").send({
      setup: {
        campaignName,
        vertical: "banking",
        language: "hindi",
        callerIdentity: "Bhaarat Engage",
        introScript: "Namaste, this is Bhaarat Engage calling to confirm one field.",
        purposeStatement: "We need to capture the current city and confirm it.",
        callingWindowStart: "09:00",
        callingWindowEnd: "20:00",
        transferEnabled: true,
        transferQueue: "Verification desk",
      },
      fields: [
        {
          field_key: "city_name",
          label: "City",
          prompt: "Please tell me your current city.",
          type: "text",
          required: true,
          sensitive: false,
          verification_label: "Current city",
          retry_limit: 2,
          validation_rule: "Spoken city name",
        },
      ],
      journey: {
        unansweredAction: "sms",
        partialAction: "retry",
        retryWindowHours: 4,
        maxRetries: 2,
        concurrencyLimit: 5,
        pacingPerMinute: 3,
        csvSource: "E2E upload",
      },
    });

    expect(createCampaignResponse.status).toBe(201);
    const campaignId = createCampaignResponse.body.data.id as string;

    const importResponse = await request(app).post("/api/contacts/import").send({
      filename: "e2e-flow.csv",
      source: "E2E import",
      defaultLanguage: "hindi",
      defaultConsent: true,
      csvText: ["name,phone,email", `${contactName},${contactPhone},${contactName.replace(/\s+/gu, ".").toLowerCase()}@example.invalid`].join("\n"),
    });

    expect(importResponse.status).toBe(201);
    expect(importResponse.body.data.imported).toBe(1);

    const contactListResponse = await request(app).get("/api/contacts").query({ search: contactName });
    expect(contactListResponse.status).toBe(200);
    expect(contactListResponse.body.meta.total).toBe(1);
    const contactId = contactListResponse.body.data[0].id as string;

    const assignResponse = await request(app).post(`/api/campaigns/${campaignId}/contacts`).send({
      contactIds: [contactId],
    });
    expect(assignResponse.status).toBe(200);
    expect(assignResponse.body.meta.total).toBe(1);

    const launchResponse = await request(app).post(`/api/campaigns/${campaignId}/launch`);
    expect(launchResponse.status).toBe(200);
    expect(launchResponse.body.data.status).toBe("active");

    const startCallResult = await voiceService.startTestCall(campaignId, contactId);
    expect(startCallResult.requestUuid).toBe(callUuid);

    const answerXml = await voiceService.buildAnswerXml({
      campaignId,
      contactId,
      callUuid,
    });
    expect(answerXml).toContain("<Stream");

    await voiceRuntime.startConnection({} as WebSocket, {
      campaignId,
      contactId,
      callUuid,
      playAudio: () => undefined,
      clearAudio: () => undefined,
    });

    recognizer.emitTranscript("Pune");
    await flushRuntimeQueue();
    recognizer.emitTranscript("yes");
    await flushRuntimeQueue();

    const finalizedRecord = await voiceService.processStatusCallback({
      campaignId,
      contactId,
      callUuid,
      providerStatus: "completed",
      source: "test",
      durationSeconds: 41,
      answeredAt: "2026-04-09T10:00:00.000Z",
      endedAt: "2026-04-09T10:00:41.000Z",
    });

    expect(finalizedRecord).not.toBeNull();
    expect(finalizedRecord?.status).toBe("completed");
    expect(finalizedRecord?.disposition).toBe("data_collected");
    expect(finalizedRecord?.fieldsCollected).toBe(1);
    expect(finalizedRecord?.confirmed).toBe(true);

    const campaignDetailResponse = await request(app).get(`/api/campaigns/${campaignId}`);
    expect(campaignDetailResponse.status).toBe(200);
    expect(campaignDetailResponse.body.data.setup.campaignName).toBe(campaignName);
    expect(campaignDetailResponse.body.data.answerRate).toBe(100);
    expect(campaignDetailResponse.body.data.completionRate).toBe(100);
    expect(campaignDetailResponse.body.data.confirmationRate).toBe(100);

    const campaignContactsResponse = await request(app).get(`/api/campaigns/${campaignId}/contacts`);
    expect(campaignContactsResponse.status).toBe(200);
    expect(campaignContactsResponse.body.data[0].name).toBe(contactName);

    const journeysResponse = await request(app).get("/api/journeys");
    expect(journeysResponse.status).toBe(200);
    const journey = journeysResponse.body.data.find((entry: { campaignId: string }) => entry.campaignId === campaignId);
    expect(journey).toBeDefined();
    expect(journey.successRate).toBe(100);

    const callRecordsResponse = await request(app).get("/api/call-records").query({ search: contactName });
    expect(callRecordsResponse.status).toBe(200);
    expect(callRecordsResponse.body.meta.total).toBe(1);
    expect(callRecordsResponse.body.data[0].id).toBe(finalizedRecord?.id);

    const callRecordDetailResponse = await request(app).get(`/api/call-records/${finalizedRecord?.id}`);
    expect(callRecordDetailResponse.status).toBe(200);
    expect(callRecordDetailResponse.body.data.disposition).toBe("data_collected");

    const transcriptResponse = await request(app).get(`/api/call-records/${finalizedRecord?.id}/transcript`);
    expect(transcriptResponse.status).toBe(200);
    expect(transcriptResponse.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ speaker: "User", text: "Pune" }),
        expect.objectContaining({ speaker: "User", text: "yes" }),
      ]),
    );

    const collectedDataResponse = await request(app).get(`/api/call-records/${finalizedRecord?.id}/data`);
    expect(collectedDataResponse.status).toBe(200);
    expect(collectedDataResponse.body.data).toEqual([
      expect.objectContaining({
        fieldKey: "city_name",
        label: "City",
        value: "Pune",
        confirmed: true,
      }),
    ]);

    const contactsExportResponse = await request(app).get("/api/contacts/export.csv").query({ search: contactName });
    expect(contactsExportResponse.status).toBe(200);
    expect(contactsExportResponse.text).toContain(contactName);

    const callRecordsExportResponse = await request(app).get("/api/call-records/export.csv").query({ search: contactName });
    expect(callRecordsExportResponse.status).toBe(200);
    expect(callRecordsExportResponse.text).toContain(finalizedRecord?.id ?? "");
    expect(callRecordsExportResponse.text).toContain("data_collected");

    const reportsResponse = await request(app).get("/api/reports");
    expect(reportsResponse.status).toBe(200);
    expect(reportsResponse.body.data.dailyVolume.length).toBeGreaterThan(0);

    const reportsExportResponse = await request(app).get("/api/reports/export.csv");
    expect(reportsExportResponse.status).toBe(200);
    expect(reportsExportResponse.text).toContain("section,item,metric,value");
  });
});
