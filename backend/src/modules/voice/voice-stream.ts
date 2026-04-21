import type { Server } from "node:http";
import PlivoWebSocketServer from "plivo-stream-sdk-node";
import type { WebSocket } from "ws";

import { env } from "../../config/env.js";
import { logger } from "../../lib/logger.js";
import type { BackendRepositories } from "../../repositories/backend-repositories.js";
import { createVoiceRuntime } from "./voice-runtime.js";
import type { VoiceService } from "./voice.service.js";

interface VoiceSocketContext {
  readonly campaignId: string;
  readonly contactId: string;
  readonly callUuid?: string;
}

function parseSocketContext(requestUrl?: string | null): VoiceSocketContext | null {
  if (!requestUrl) {
    return null;
  }

  const parsedUrl = new URL(requestUrl, "http://voice.local");
  const campaignId = parsedUrl.searchParams.get("campaignId")?.trim();
  const contactId = parsedUrl.searchParams.get("contactId")?.trim();
  const callUuid = parsedUrl.searchParams.get("callUuid")?.trim();

  if (!campaignId || !contactId) {
    return null;
  }

  return {
    campaignId,
    contactId,
    callUuid: callUuid || undefined,
  };
}

export function registerVoiceStream(server: Server, service: VoiceService, repositories: Pick<BackendRepositories, "voice">) {
  const socketContextByConnection = new WeakMap<WebSocket, VoiceSocketContext>();
  const plivoServer = new PlivoWebSocketServer({
    server,
    path: "/voice/plivo/stream",
    validateSignature: env.PLIVO_VALIDATE_SIGNATURES,
    authToken: env.PLIVO_AUTH_TOKEN ?? undefined,
  });
  const voiceRuntime = createVoiceRuntime(service, repositories);

  plivoServer
    .onConnection(async (socket, request) => {
      const context = parseSocketContext(request.url);

      if (!context) {
        throw new Error("Voice stream connection is missing campaignId or contactId.");
      }

      socketContextByConnection.set(socket, context);
    })
    .onStart((event, socket) => {
      const context = socketContextByConnection.get(socket);

      if (!context) {
        logger.warn({ callUuid: event.start.callId }, "Voice stream started without a stored connection context.");
        return;
      }

      const callUuid = context.callUuid ?? event.start.callId;

      void voiceRuntime
        .startConnection(socket, {
          campaignId: context.campaignId,
          contactId: context.contactId,
          callUuid,
          playAudio: (audio) => {
            plivoServer.playAudio(socket, audio.contentType, audio.sampleRate, audio.audio);
          },
          clearAudio: () => {
            plivoServer.clearAudio(socket);
          },
        })
        .then((session) => {
          plivoServer.checkpoint(socket, "voice-runtime-ready");
          logger.info(
            {
              callRecordId: session.callRecordId,
              callUuid,
              campaignId: session.campaignId,
              contactId: session.contactId,
              fieldsTotal: session.fieldsTotal,
            },
            "Voice stream session initialized.",
          );
        })
        .catch((error: unknown) => {
          logger.error(
            {
              err: error,
              callUuid,
              campaignId: context.campaignId,
              contactId: context.contactId,
            },
            "Failed to initialize the voice stream session.",
          );
        });
    })
    .onMedia((event, socket) => {
      voiceRuntime.handleInboundAudio(socket, event.media.track, event.media.payload);
    })
    .onError((error, _socket) => {
      logger.warn({ err: error }, "Voice stream error.");
    })
    .onClose((socket) => {
      voiceRuntime.closeConnection(socket);
      logger.debug("Voice stream connection closed.");
    })
    .start();

  return plivoServer;
}
