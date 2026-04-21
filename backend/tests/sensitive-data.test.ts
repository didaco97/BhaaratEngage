import { describe, expect, it } from "vitest";

import { decryptSensitiveValue, encryptSensitiveValue, isEncryptedSensitiveValue } from "../src/lib/sensitive-data.js";

describe("sensitive data encryption", () => {
  it("encrypts and decrypts values using the application envelope", () => {
    const rawValue = "ABCDE1234F";
    const encryptedValue = encryptSensitiveValue(rawValue);

    expect(encryptedValue).not.toBe(rawValue);
    expect(isEncryptedSensitiveValue(encryptedValue)).toBe(true);
    expect(decryptSensitiveValue(encryptedValue)).toBe(rawValue);
  });

  it("keeps legacy plaintext values readable during migration", () => {
    expect(decryptSensitiveValue("legacy-plaintext-value")).toBe("legacy-plaintext-value");
    expect(isEncryptedSensitiveValue("legacy-plaintext-value")).toBe(false);
  });
});
