import { describe, expect, it } from "vitest";

import { classifyTransferRequest, classifyYesNo, heuristicExtractFieldValue } from "../src/modules/voice/voice-ai.js";

describe("voice AI heuristics", () => {
  const panField = {
    field_key: "pan_number",
    label: "PAN number",
    prompt: "Please share your PAN number.",
    type: "text" as const,
    required: true,
    sensitive: true,
    verification_label: "PAN number",
    retry_limit: 3,
    validation_rule: "PAN format AAAA9999A",
  };

  const booleanField = {
    field_key: "renewal_confirm",
    label: "Renewal confirmation",
    prompt: "Would you like to renew?",
    type: "boolean" as const,
    required: true,
    sensitive: false,
    verification_label: "Renewal confirmation",
    retry_limit: 2,
    validation_rule: "",
  };

  it("prefers explicit negative confirmation phrases over positive substrings", () => {
    expect(classifyYesNo("No, that is not correct")).toBe(false);
    expect(classifyYesNo("don't confirm this yet")).toBe(false);
    expect(classifyYesNo("yes, that is correct")).toBe(true);
  });

  it("does not trigger human transfer when the caller explicitly declines escalation", () => {
    expect(classifyTransferRequest("Please do not transfer me to an agent")).toBe(false);
    expect(classifyTransferRequest("Connect me to a human agent")).toBe(true);
  });

  it("extracts code-switched PAN values into the canonical identifier", () => {
    expect(heuristicExtractFieldValue(panField, "Mera PAN number A B C D E ek do teen char F hai")).toEqual({
      outcome: "captured",
      value: "ABCDE1234F",
      confidenceScore: 0.92,
    });
  });

  it("retries boolean extraction when the answer is ambiguous", () => {
    expect(heuristicExtractFieldValue(booleanField, "maybe later")).toEqual({
      outcome: "retry",
      value: null,
      confidenceScore: 0.2,
    });
  });
});
