import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

import { env } from "../config/env.js";

const ENCRYPTION_ALGORITHM = "aes-256-gcm";
const ENCRYPTION_ENVELOPE_PREFIX = "enc:v1";
const IV_LENGTH_BYTES = 12;
const AUTH_TAG_LENGTH_BYTES = 16;

const encryptionKey = createHash("sha256").update(env.SENSITIVE_DATA_ENCRYPTION_KEY).digest();

export function isEncryptedSensitiveValue(value: string) {
  return value.startsWith(`${ENCRYPTION_ENVELOPE_PREFIX}:`);
}

export function encryptSensitiveValue(value: string) {
  const iv = randomBytes(IV_LENGTH_BYTES);
  const cipher = createCipheriv(ENCRYPTION_ALGORITHM, encryptionKey, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [
    ENCRYPTION_ENVELOPE_PREFIX,
    iv.toString("base64url"),
    authTag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(":");
}

export function decryptSensitiveValue(value: string) {
  if (!isEncryptedSensitiveValue(value)) {
    return value;
  }

  const payload = value.slice(`${ENCRYPTION_ENVELOPE_PREFIX}:`.length);
  const [ivValue, authTagValue, encryptedValue] = payload.split(":");

  if (!ivValue || !authTagValue || !encryptedValue) {
    throw new Error("The encrypted sensitive value envelope is malformed.");
  }

  const decipher = createDecipheriv(ENCRYPTION_ALGORITHM, encryptionKey, Buffer.from(ivValue, "base64url"), {
    authTagLength: AUTH_TAG_LENGTH_BYTES,
  });
  decipher.setAuthTag(Buffer.from(authTagValue, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
