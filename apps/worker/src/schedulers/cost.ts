/**
 * The `cost` scheduler: periodically samples resource usage for every running
 * preview, rolls it into a `CostRecord` for the elapsed period, and raises a
 * BUDGET_EXCEEDED notification when a team's month-to-date spend crosses its
 * configured budget.
 *
 * The cost arithmetic is a pure helper — {@link usageForPreview} — that turns an
 * orchestrator stats snapshot (or, when stats are unavailable, a synthesized
 * estimate) into a `@shipyard/core` {@link UsageSample}. {@link createCostWorker}
 * wires the tick onto a repeatable BullMQ {@link Worker}.
 *
 * @module
 */

import { Worker, type Job } from "bullmq";

import {
  QUEUE,
  computeCostBreakdown,
  type CostRates,
  type UsageSample,
} from "@shipyard/core";
import { Prisma, type PrismaClient } from "@shipyard/db";

import { bullConnection, type WorkerConnection } from "../connection.js";

import type { WorkerConfig } from "../config.js";
import type { ServiceStatsSample } from "@shipyard/deploy-engine";
import type { Logger } from "pino";


/** Seconds per millisecond divisor for ms → hours. */
const MS_PER_HOUR = 3_600_000;
/** Bytes per gigabyte (binary, matching container stats reporting). */
const BYTES_PER_GB = 1024 ** 3;
/** Plausible synthetic memory footprint per service, in GB. */
const SYNTH_MEM_GB_PER_SERVICE = 0.25;
/** Plausible synthetic storage footprint per service, in GB. */
const SYNTH_STORAGE_GB_PER_SERVICE = 1;
/** Plausible synthetic CPU usage per service, in fractional cores. */
const SYNTH_CPU_CORES_PER_SERVICE = 0.1;
/** Plausible synthetic egress per service-hour, in GB. */
const SYNTH_EGRESS_GB_PER_SERVICE_HOUR = 0.05;

/**
 * Convert a set of instantaneous {@link ServiceStatsSample}s, observed at the end
 * of a period of `periodMs`, into a {@link UsageSample} for that whole period.
 *
 * The samples report rates/levels (CPU cores, resident memory, cumulative
 * rx/tx); we integrate them over the period assuming they held steady, which is
 * the standard approximation for a fixed sampling interval. When no stats are
 * available the usage is synthesized from `serviceCount` so cost still accrues
 * for previews on orchestrators that do not expose stats.
 *
 * Pure and deterministic.
 *
 * @param stats - Per-service instantaneous samples (may be empty).
 * @param serviceCount - Number of running services (for the synth fallback).
 * @param periodMs - Length of the period the usage covers.
 * @returns A {@link UsageSample} for the period.
 */
export function usageForPreview(
  stats: readonly ServiceStatsSample[],
  serviceCount: number,
  periodMs: number,
): UsageSample {
  const hours = Math.max(0, periodMs) / MS_PER_HOUR;

  if (stats.length === 0) {
    return synthesizeUsage(serviceCount, hours);
  }

  let cpuCores = 0;
  let memoryGb = 0;
  for (const sample of stats) {
    cpuCores += sample.cpuCores;
    memoryGb += sample.memoryBytes / BYTES_PER_GB;
  }
  // Egress is synthesized from service count (cumulative rx/tx deltas would need
  // the previous sample, which the per-tick stats snapshot does not carry).
  const egressGb = stats.length * SYNTH_EGRESS_GB_PER_SERVICE_HOUR * hours;

  return {
    cpuSeconds: cpuCores * hours * 3600,
    memoryGbHours: memoryGb * hours,
    storageGbHours: stats.length * SYNTH_STORAGE_GB_PER_SERVICE * hours,
    egressGb,
  };
}

/** Synthesize a plausible {@link UsageSample} from a service count + hours. */
function synthesizeUsage(serviceCount: number, hours: number): UsageSample {
  const count = Math.max(1, serviceCount);
  return {
    cpuSeconds: count * SYNTH_CPU_CORES_PER_SERVICE * hours * 3600,
    memoryGbHours: count * SYNTH_MEM_GB_PER_SERVICE * hours,
    storageGbHours: count * SYNTH_STORAGE_GB_PER_SERVICE * hours,
    egressGb: count * SYNTH_EGRESS_GB_PER_SERVICE_HOUR * hours,
  };
}

/** Dependencies for the cost tick + worker. */
export interface CostWorkerDeps {
  /** Prisma client. */
  prisma: PrismaClient;
  /** The selected preview orchestrator (for `collectStats`). */
  orchestrator: { collectStats(previewId: string): Promise<ServiceStatsSample[]> };
  /** Validated worker configuration (provides cost rates + interval). */
  config: WorkerConfig;
  /** Logger. */
  logger: Logger;
}

/** Construct-time deps for {@link createCostWorker} (adds the connection). */
export interface CreateCostWorkerDeps extends CostWorkerDeps {
  /** Shared BullMQ ioredis connection. */
  connection: WorkerConnection;
}

/**
 * Run one cost tick: sample every running preview, write a `CostRecord` for the
 * elapsed period, then raise budget alerts where month-to-date spend exceeds the
 * team budget.
 *
 * Exposed for direct invocation/testing.
 *
 * @param deps - Prisma + orchestrator + config + logger.
 * @param now - The current instant (injectable for tests). Defaults to now.
 * @returns The number of `CostRecord` rows written.
 */
export async function runCostTick(
  deps: CostWorkerDeps,
  now: Date = new Date(),
): Promise<number> {
  const { prisma: db, orchestrator, config } = deps;
  const rates: CostRates = config.costRates;

  const previews = await db.preview.findMany({
    where: { status: { in: ["RUNNING", "DEGRADED"] } },
    select: { id: true, projectId: true },
  });

  let written = 0;
  for (const preview of previews) {
    const lastRecord = await db.costRecord.findFirst({
      where: { previewId: preview.id },
      orderBy: { periodEnd: "desc" },
      select: { periodEnd: true },
    });
    const periodStart =
      lastRecord?.periodEnd ?? new Date(now.getTime() - config.COST_INTERVAL_MS);
    const periodMs = now.getTime() - periodStart.getTime();
    if (periodMs <= 0) continue;

    const stats = await orchestrator.collectStats(preview.id).catch(() => []);
    const serviceCount = await db.service.count({
      where: { previewId: preview.id, status: "HEALTHY" },
    });
    const usage = usageForPreview(stats, serviceCount, periodMs);
    const breakdown = computeCostBreakdown(usage, rates);

    await db.costRecord.create({
      data: {
        previewId: preview.id,
        periodStart,
        periodEnd: now,
        cpuSeconds: usage.cpuSeconds,
        memoryGbHours: usage.memoryGbHours,
        storageGbHours: usage.storageGbHours,
        egressGb: usage.egressGb,
        estimatedUsd: new Prisma.Decimal(breakdown.totalUsd),
        computedAt: now,
      },
    });
    written += 1;
  }

  await checkBudgets(deps, now);

  deps.logger.info(
    { sampled: previews.length, recordsWritten: written },
    "cost tick complete",
  );
  return written;
}

/**
 * Create the BullMQ {@link Worker} for the repeatable `cost` queue.
 *
 * @param deps - Injected deps plus the shared connection.
 * @returns A started worker. Caller is responsible for `close()`.
 */
export function createCostWorker(deps: CreateCostWorkerDeps): Worker {
  const { connection } = deps;
  const worker = new Worker(
    QUEUE.cost,
    async (_job: Job) => {
      await runCostTick(deps);
    },
    { connection: bullConnection(connection), concurrency: 1 },
  );
  worker.on("failed", (job, err) => {
    deps.logger.error({ jobId: job?.id, err }, "cost tick failed");
  });
  return worker;
}

// ─────────────────────────────────────────────────────────────────────────────
// Budgets
// ─────────────────────────────────────────────────────────────────────────────

/** First instant of the calendar month containing `at` (UTC). */
function monthStart(at: Date): Date {
  return new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), 1));
}

/**
 * For every team with a configured monthly budget, compare its month-to-date
 * spend (summed `CostRecord.estimatedUsd` across the team's previews) to the
 * budget and, if exceeded, create a BUDGET_EXCEEDED notification for each team
 * OWNER — at most once per team per calendar month.
 */
async function checkBudgets(deps: CostWorkerDeps, now: Date): Promise<void> {
  const { prisma: db } = deps;
  const since = monthStart(now);

  const teams = await db.team.findMany({
    where: { budgetUsdMonthly: { not: null } },
    select: { id: true, name: true, budgetUsdMonthly: true },
  });

  for (const team of teams) {
    if (team.budgetUsdMonthly == null) continue;
    const budget = team.budgetUsdMonthly;

    const agg = await db.costRecord.aggregate({
      _sum: { estimatedUsd: true },
      where: {
        periodStart: { gte: since },
        preview: { project: { teamId: team.id } },
      },
    });
    const spend = agg._sum.estimatedUsd ?? new Prisma.Decimal(0);
    if (spend.lessThanOrEqualTo(budget)) continue;

    // De-dupe: skip if a BUDGET_EXCEEDED note for this team already exists this
    // month.
    const owners = await db.membership.findMany({
      where: { teamId: team.id, role: "OWNER" },
      select: { userId: true },
    });
    if (owners.length === 0) continue;

    const existing = await db.notification.findFirst({
      where: {
        type: "BUDGET_EXCEEDED",
        createdAt: { gte: since },
        userId: { in: owners.map((o) => o.userId) },
        // metadata teamId match keeps separate teams' alerts independent.
        metadata: { path: ["teamId"], equals: team.id },
      },
      select: { id: true },
    });
    if (existing) continue;

    await db.notification.createMany({
      data: owners.map((owner) => ({
        userId: owner.userId,
        type: "BUDGET_EXCEEDED" as const,
        title: "Monthly budget exceeded",
        body: `Team "${team.name}" has spent $${spend.toFixed(2)} this month, over its $${budget.toFixed(2)} budget.`,
        metadata: { teamId: team.id },
      })),
    });
    deps.logger.warn(
      { teamId: team.id, spend: spend.toFixed(2), budget: budget.toFixed(2) },
      "team over monthly budget; notified owners",
    );
  }
}
