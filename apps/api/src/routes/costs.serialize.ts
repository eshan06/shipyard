/**
 * Cost serializers + response schemas (co-located with `routes/costs.ts`).
 *
 * Follows the project serializer convention (`lib/serialize.ts`): dates are
 * emitted as ISO-8601 strings and Prisma `Decimal`s as numbers. The dashboard
 * cost views are read-only, so these are pure shaping helpers.
 *
 * @module
 */

import { z } from "zod";

import { decimalToNumber, iso } from "../lib/serialize.js";

import type { CostRecord } from "@shipyard/db";

/**
 * Response schema for a single {@link CostRecord} DTO. `estimatedUsd` is a
 * number (the DB stores `Decimal(12,4)`); the usage counters are plain floats.
 */
export const CostRecordResponseSchema = z.object({
  id: z.string(),
  previewId: z.string(),
  periodStart: z.string(),
  periodEnd: z.string(),
  cpuSeconds: z.number(),
  memoryGbHours: z.number(),
  storageGbHours: z.number(),
  egressGb: z.number(),
  estimatedUsd: z.number(),
  computedAt: z.string(),
});

/** The wire shape of a {@link CostRecord}. */
export type CostRecordDto = z.infer<typeof CostRecordResponseSchema>;

/**
 * The per-preview cost response: the cost records plus a computed total of
 * their `estimatedUsd` (so the client need not re-sum) and the page cursor.
 */
export const PreviewCostsResponseSchema = z.object({
  data: z.array(CostRecordResponseSchema),
  totalUsd: z.number(),
  nextCursor: z.string().nullable(),
});

/**
 * Summary response suitable for dashboard charts: per-project and per-day
 * `estimatedUsd` rollups for the current month, plus per-team budget-vs-spend.
 */
export const CostSummaryResponseSchema = z.object({
  /** Inclusive start of the window (current month, UTC), ISO string. */
  periodStart: z.string(),
  /** Exclusive end of the window (start of next month, UTC), ISO string. */
  periodEnd: z.string(),
  /** Total spend across all included teams for the window. */
  totalUsd: z.number(),
  /** Spend grouped by owning project (for a bar/pie chart). */
  byProject: z.array(
    z.object({
      projectId: z.string(),
      projectName: z.string(),
      teamId: z.string(),
      estimatedUsd: z.number(),
    }),
  ),
  /** Spend grouped by UTC day (`YYYY-MM-DD`) for a time-series chart. */
  byDay: z.array(
    z.object({
      date: z.string(),
      estimatedUsd: z.number(),
    }),
  ),
  /** Per-team budget vs. spend, for budget gauges/alerts. */
  teams: z.array(
    z.object({
      teamId: z.string(),
      teamName: z.string(),
      budgetUsdMonthly: z.number().nullable(),
      spendUsd: z.number(),
      /** Fraction of budget consumed (0–1+), or null when no budget is set. */
      budgetUsedFraction: z.number().nullable(),
      /** Whether spend has exceeded the configured budget. */
      overBudget: z.boolean(),
    }),
  ),
});

/** The wire shape of the cost summary. */
export type CostSummaryDto = z.infer<typeof CostSummaryResponseSchema>;

/**
 * Serialize a {@link CostRecord} row into its public DTO.
 *
 * @param record - A Prisma `CostRecord` row.
 * @returns The {@link CostRecordDto}.
 */
export function toCostRecordDto(record: CostRecord): CostRecordDto {
  return {
    id: record.id,
    previewId: record.previewId,
    periodStart: iso(record.periodStart)!,
    periodEnd: iso(record.periodEnd)!,
    cpuSeconds: record.cpuSeconds,
    memoryGbHours: record.memoryGbHours,
    storageGbHours: record.storageGbHours,
    egressGb: record.egressGb,
    estimatedUsd: decimalToNumber(record.estimatedUsd)!,
    computedAt: iso(record.computedAt)!,
  };
}
