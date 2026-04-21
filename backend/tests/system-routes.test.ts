import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";

describe("system routes", () => {
  it("returns a healthy status payload", async () => {
    const response = await request(createApp()).get("/health");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("ok");
    expect(response.body.service).toBe("bharatengage-backend");
  });

  it("returns readiness details without crashing when integrations are not configured", async () => {
    const response = await request(createApp()).get("/ready");

    expect(response.status).toBe(200);
    expect(["ok", "degraded"]).toContain(response.body.status);
    expect(response.body.dependencies).toHaveProperty("database");
    expect(response.body.dependencies).toHaveProperty("plivo");
  });
});
