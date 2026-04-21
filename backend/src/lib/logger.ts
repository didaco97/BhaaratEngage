import pino from "pino";

import { env } from "../config/env.js";

export const logger = pino({
  name: "bharatengage-backend",
  level: env.LOG_LEVEL,
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "req.headers['x-api-key']",
      "req.headers['x-plivo-signature-v2']",
      "req.headers['x-plivo-signature-ma-v2']",
      "req.query.apiKey",
      "req.query.token",
      "req.query.accessToken",
      "req.query.signature",
      "req.body.apiKey",
      "req.body.rawKey",
      "req.body.password",
      "req.body.token",
      "req.body.accessToken",
      "req.body.refreshToken",
      "req.body.secret",
      "req.body.signature",
      "req.body.webhookSecret",
      "req.body.textRaw",
      "req.body.rawValue",
      "req.body.extractedValue",
      "req.body.raw_value_encrypted",
      "req.body.collectedData",
      "req.body.transcript",
      "res.headers['set-cookie']",
    ],
    remove: true,
  },
});
