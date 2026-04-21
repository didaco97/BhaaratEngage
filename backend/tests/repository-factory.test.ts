import { describe, expect, it } from "vitest";

import { resolveRepositoryMode } from "../src/repositories/create-repositories.js";

describe("resolveRepositoryMode", () => {
  it("falls back to memory in auto mode when Supabase is not configured", () => {
    expect(
      resolveRepositoryMode({
        configuredDataSource: "auto",
        supabaseConfigured: false,
      }),
    ).toBe("memory");
  });

  it("uses Supabase in auto mode when credentials are present", () => {
    expect(
      resolveRepositoryMode({
        configuredDataSource: "auto",
        supabaseConfigured: true,
      }),
    ).toBe("supabase");
  });

  it("throws when Supabase mode is forced without credentials", () => {
    expect(() =>
      resolveRepositoryMode({
        configuredDataSource: "supabase",
        supabaseConfigured: false,
      }),
    ).toThrow(/supabase credentials are missing/i);
  });
});
