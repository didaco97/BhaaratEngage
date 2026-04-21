import { describe, expect, it } from "vitest";

import {
  buildComplianceAlerts,
  buildProviderPerformanceSnapshot,
  buildTransferQueueSummaries,
} from "../src/lib/operational-metrics.js";

describe("operational metrics", () => {
  it("builds compliance alerts from provider failures, quiet hours, and export readiness", () => {
    const alerts = buildComplianceAlerts({
      campaigns: [
        {
          id: "camp-001",
          name: "KYC Verification Drive",
          status: "paused",
          pauseMode: "quiet_hours",
          createdAt: "2026-04-09T09:00:00.000Z",
        },
        {
          id: "camp-002",
          name: "Insurance Renewal",
          status: "completed",
          createdAt: "2026-04-09T07:00:00.000Z",
          launchedAt: "2026-04-09T08:00:00.000Z",
        },
      ],
      callRecords: [
        {
          provider: "plivo",
          status: "failed",
          disposition: "network_error",
          startedAt: "2026-04-09T10:30:00.000Z",
          errorCode: "PROVIDER_TIMEOUT",
        },
        {
          provider: "plivo",
          status: "completed",
          disposition: "data_collected",
          startedAt: "2026-04-09T10:40:00.000Z",
        },
      ],
      settings: {
        quietHoursAutoPause: true,
      },
      referenceTime: "2026-04-09T11:00:00.000Z",
    });

    expect(alerts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "Plivo reliability degraded",
          severity: "risk",
        }),
        expect.objectContaining({
          title: "Quiet hours active",
          severity: "warning",
        }),
        expect.objectContaining({
          title: "Masked export ready",
          severity: "info",
        }),
      ]),
    );
  });

  it("refreshes transfer queue summaries from live transferred calls while preserving baseline fallback", () => {
    const summaries = buildTransferQueueSummaries({
      queues: [
        {
          id: "queue-001",
          name: "Priority desk",
          activeAgents: 2,
          waitingCount: 0,
          currentSlaSeconds: 0,
        },
        {
          id: "queue-002",
          name: "Review desk",
          activeAgents: 1,
          waitingCount: 3,
          currentSlaSeconds: 240,
        },
      ],
      callRecords: [
        {
          provider: "plivo",
          status: "transferred",
          disposition: "human_transfer",
          startedAt: "2026-04-09T10:25:00.000Z",
          endedAt: "2026-04-09T10:40:00.000Z",
          transferQueueId: "queue-001",
          transferQueueName: "Priority desk",
        },
      ],
      referenceTime: "2026-04-09T11:00:00.000Z",
    });

    expect(summaries).toEqual([
      {
        queue: "Review desk",
        waiting: 3,
        sla: "4m 00s",
      },
      {
        queue: "Priority desk",
        waiting: 1,
        sla: "0m 45s",
      },
    ]);
  });

  it("tracks provider performance by day using persisted call outcomes", () => {
    const performance = buildProviderPerformanceSnapshot({
      callRecords: [
        {
          provider: "plivo",
          status: "completed",
          disposition: "data_collected",
          startedAt: "2026-04-08T09:00:00.000Z",
        },
        {
          provider: "plivo",
          status: "failed",
          disposition: "network_error",
          startedAt: "2026-04-08T10:00:00.000Z",
          errorCode: "timeout",
        },
        {
          provider: "exotel",
          status: "transferred",
          disposition: "human_transfer",
          startedAt: "2026-04-09T09:30:00.000Z",
        },
      ],
      referenceTime: "2026-04-09T11:00:00.000Z",
    });

    expect(performance).toEqual([
      {
        date: "08 Apr",
        plivo: 50,
        exotel: 0,
      },
      {
        date: "09 Apr",
        plivo: 0,
        exotel: 100,
      },
    ]);
  });
});
