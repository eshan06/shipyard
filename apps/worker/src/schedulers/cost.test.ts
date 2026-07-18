import { describe, expect, it } from "vitest";

import { estimateUsd, type UsageSample } from "@shipyard/core";

import { loadConfig } from "../config.js";
import { createFakePrisma, testLogger, type Row } from "../test-utils.js";

import { runCostTick, usageForPreview } from "./cost.js";

import type { ServiceStatsSample } from "@shipyard/deploy-engine";

const HOUR_MS = 3_600_000;

const config = loadConfig({
  DATABASE_URL: "postgres://x",
  REDIS_URL: "redis://x",
  SECRETS_ENCRYPTION_KEY: Buffer.alloc(32).toString("base64"),
  PREVIEW_BASE_DOMAIN: "preview.test",
});

describe("usageForPreview", () => {
  it("integrates instantaneous stats over the period", () => {
    const stats: ServiceStatsSample[] = [
      {
        name: "web",
        containerId: "c1",
        cpuCores: 1,
        memoryBytes: 1024 ** 3, // 1 GB
        memoryLimitBytes: 0,
        rxBytes: 0,
        txBytes: 0,
        sampledAt: 0,
      },
    ];
    const usage = usageForPreview(stats, 1, HOUR_MS);
    // 1 core for 1 hour = 3600 cpu-seconds; 1 GB for 1 hour = 1 GB-hour.
    expect(usage.cpuSeconds).toBeCloseTo(3600, 5);
    expect(usage.memoryGbHours).toBeCloseTo(1, 5);
    expect(usage.storageGbHours).toBeGreaterThan(0);
    expect(usage.egressGb).toBeGreaterThanOrEqual(0);
  });

  it("synthesizes plausible usage when no stats are available", () => {
    const usage = usageForPreview([], 3, HOUR_MS);
    expect(usage.cpuSeconds).toBeGreaterThan(0);
    expect(usage.memoryGbHours).toBeGreaterThan(0);
    expect(usage.storageGbHours).toBeGreaterThan(0);
    expect(usage.egressGb).toBeGreaterThan(0);
  });

  it("scales linearly with the period length", () => {
    const oneHour = usageForPreview([], 2, HOUR_MS);
    const twoHours = usageForPreview([], 2, 2 * HOUR_MS);
    expect(twoHours.cpuSeconds).toBeCloseTo(oneHour.cpuSeconds * 2, 5);
    expect(twoHours.memoryGbHours).toBeCloseTo(oneHour.memoryGbHours * 2, 5);
  });

  it("produces a non-zero USD estimate via core estimateUsd", () => {
    const usage: UsageSample = usageForPreview([], 2, HOUR_MS);
    expect(estimateUsd(usage, config.costRates)).toBeGreaterThan(0);
  });
});

describe("runCostTick", () => {
  const now = new Date("2026-06-14T12:00:00.000Z");

  it("writes one CostRecord per running preview for the elapsed period", async () => {
    const previews: Row[] = [
      { id: "prev-1", status: "RUNNING", projectId: "proj-1" },
    ];
    const services: Row[] = [
      { id: "svc-1", previewId: "prev-1", name: "web", status: "HEALTHY" },
    ];
    const { client, tables } = createFakePrisma({ previews, services });

    const orchestrator = {
      collectStats: async (_id: string): Promise<ServiceStatsSample[]> => [],
    };

    const written = await runCostTick(
      { prisma: client, orchestrator, config, logger: testLogger() },
      now,
    );

    expect(written).toBe(1);
    expect(tables.costRecords).toHaveLength(1);
    const record = tables.costRecords[0]!;
    expect(record.previewId).toBe("prev-1");
    expect(record.periodEnd).toEqual(now);
    expect(Number(record.cpuSeconds)).toBeGreaterThan(0);
  });

  it("continues the period from the previous record's periodEnd (within the window)", async () => {
    const previews: Row[] = [
      { id: "prev-1", status: "RUNNING", projectId: "proj-1" },
    ];
    // A gap shorter than the clamp (< 2× COST_INTERVAL_MS) bills the exact span.
    const lastEnd = new Date(now.getTime() - config.COST_INTERVAL_MS);
    const costRecords: Row[] = [
      { id: "cost-0", previewId: "prev-1", periodEnd: lastEnd },
    ];
    const { client, tables } = createFakePrisma({ previews, costRecords });
    const orchestrator = {
      collectStats: async (): Promise<ServiceStatsSample[]> => [],
    };

    await runCostTick(
      { prisma: client, orchestrator, config, logger: testLogger() },
      now,
    );

    const newest = tables.costRecords.find((c) => c.id !== "cost-0")!;
    expect(newest.periodStart).toEqual(lastEnd);
    expect(newest.periodEnd).toEqual(now);
  });

  it("clamps a long gap (worker outage / stopped preview) so it isn't billed in one lump", async () => {
    const previews: Row[] = [
      { id: "prev-1", status: "RUNNING", projectId: "proj-1" },
    ];
    // A 1-hour gap must NOT be charged as a full hour: it is clamped to a couple
    // of sampling intervals so downtime/STOPPED windows don't inflate spend.
    const lastEnd = new Date(now.getTime() - HOUR_MS);
    const costRecords: Row[] = [
      { id: "cost-0", previewId: "prev-1", periodEnd: lastEnd },
    ];
    const { client, tables } = createFakePrisma({ previews, costRecords });
    const orchestrator = {
      collectStats: async (): Promise<ServiceStatsSample[]> => [],
    };

    await runCostTick(
      { prisma: client, orchestrator, config, logger: testLogger() },
      now,
    );

    const newest = tables.costRecords.find((c) => c.id !== "cost-0")!;
    expect(newest.periodEnd).toEqual(now);
    const billedMs = now.getTime() - (newest.periodStart as Date).getTime();
    expect(billedMs).toBeLessThanOrEqual(2 * config.COST_INTERVAL_MS);
    expect(billedMs).toBeLessThan(HOUR_MS);
  });
});
