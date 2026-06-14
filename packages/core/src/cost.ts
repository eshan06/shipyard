/**
 * Pure cost computation for preview environments.
 *
 * The cost worker periodically samples container resource usage and rolls it up
 * into `CostRecord` rows (`estimatedUsd`, stored as `Decimal(12,4)`). This
 * module turns raw usage samples + a rate configuration into a dollar estimate.
 *
 * All arithmetic is done with plain numbers and the final value is rounded to
 * 4 decimal places to match the database precision. Intermediate values are not
 * rounded, so summing many small samples stays accurate.
 *
 * Rates are read from environment variables matching `.env.example`:
 *
 * | Env var                     | Meaning                              | Default  |
 * | --------------------------- | ------------------------------------ | -------- |
 * | `COST_PER_VCPU_HOUR`        | USD per vCPU-hour                     | `0.04`   |
 * | `COST_PER_GB_MEM_HOUR`      | USD per GB of memory per hour        | `0.005`  |
 * | `COST_PER_GB_STORAGE_HOUR`  | USD per GB of storage per hour       | `0.0002` |
 * | `COST_PER_GB_EGRESS`        | USD per GB of network egress         | `0.09`   |
 *
 * @module
 */

/** Seconds in an hour, used to convert `cpuSeconds` → CPU-hours. */
const SECONDS_PER_HOUR = 3600;
/** Decimal places the database stores for `estimatedUsd` (`Decimal(12,4)`). */
const USD_DECIMAL_PLACES = 4;

/**
 * Default per-unit rates (USD), mirroring the `COST_*` defaults in
 * `.env.example`. Used as fallbacks by {@link loadCostRates}.
 */
export const DEFAULT_COST_RATES: CostRates = {
  perVcpuHour: 0.04,
  perGbMemoryHour: 0.005,
  perGbStorageHour: 0.0002,
  perGbEgress: 0.09,
};

/**
 * Per-unit pricing for the resources a preview consumes.
 */
export interface CostRates {
  /** USD per vCPU-hour. */
  perVcpuHour: number;
  /** USD per GB-hour of memory. */
  perGbMemoryHour: number;
  /** USD per GB-hour of storage. */
  perGbStorageHour: number;
  /** USD per GB of network egress. */
  perGbEgress: number;
}

/**
 * A single window of measured resource usage for a preview.
 *
 * Field names and units intentionally mirror the `CostRecord` columns in the
 * Prisma schema so samples can be persisted directly.
 */
export interface UsageSample {
  /** CPU time consumed, in CPU-seconds. */
  cpuSeconds: number;
  /** Memory consumption integrated over time, in GB-hours. */
  memoryGbHours: number;
  /** Storage consumption integrated over time, in GB-hours. */
  storageGbHours: number;
  /** Network egress, in GB. */
  egressGb: number;
}

/**
 * Per-resource breakdown of an estimate, plus the rounded total. Useful for
 * showing "where the money went" on the dashboard.
 */
export interface CostBreakdown {
  /** USD attributable to CPU usage (unrounded). */
  cpuUsd: number;
  /** USD attributable to memory usage (unrounded). */
  memoryUsd: number;
  /** USD attributable to storage usage (unrounded). */
  storageUsd: number;
  /** USD attributable to egress (unrounded). */
  egressUsd: number;
  /** Total estimate, rounded to {@link USD_DECIMAL_PLACES} decimal places. */
  totalUsd: number;
}

/**
 * Round a USD amount to the database's 4-decimal precision using
 * round-half-away-from-zero, avoiding binary floating-point artifacts (e.g.
 * `1.00005` → `1.0001`).
 *
 * @param value - The raw amount.
 * @returns The amount rounded to {@link USD_DECIMAL_PLACES} decimals.
 */
export function roundUsd(value: number): number {
  if (!Number.isFinite(value)) {
    throw new Error(`Cannot round non-finite cost value: ${value}`);
  }
  const factor = 10 ** USD_DECIMAL_PLACES;
  // `Number.EPSILON` nudge corrects values that sit just below the rounding
  // boundary due to IEEE-754 representation.
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

/**
 * Read cost rates from an environment map, falling back to
 * {@link DEFAULT_COST_RATES} for any variable that is unset or unparseable.
 *
 * Negative or non-finite values are rejected (they almost certainly indicate a
 * misconfiguration) by falling back to the corresponding default.
 *
 * @param env - Environment map to read from. Defaults to `process.env`.
 * @returns A fully-populated {@link CostRates} object.
 */
export function loadCostRates(env: NodeJS.ProcessEnv = process.env): CostRates {
  const read = (name: string, fallback: number): number => {
    const raw = env[name];
    if (raw === undefined || raw.trim() === "") return fallback;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
  };

  return {
    perVcpuHour: read("COST_PER_VCPU_HOUR", DEFAULT_COST_RATES.perVcpuHour),
    perGbMemoryHour: read(
      "COST_PER_GB_MEM_HOUR",
      DEFAULT_COST_RATES.perGbMemoryHour,
    ),
    perGbStorageHour: read(
      "COST_PER_GB_STORAGE_HOUR",
      DEFAULT_COST_RATES.perGbStorageHour,
    ),
    perGbEgress: read("COST_PER_GB_EGRESS", DEFAULT_COST_RATES.perGbEgress),
  };
}

/**
 * Compute a per-resource cost breakdown for a single usage sample.
 *
 * @param sample - The measured usage.
 * @param rates - Per-unit pricing (defaults to {@link DEFAULT_COST_RATES}).
 * @returns A {@link CostBreakdown} with unrounded per-resource costs and a
 *   rounded total.
 */
export function computeCostBreakdown(
  sample: UsageSample,
  rates: CostRates = DEFAULT_COST_RATES,
): CostBreakdown {
  const cpuUsd = (sample.cpuSeconds / SECONDS_PER_HOUR) * rates.perVcpuHour;
  const memoryUsd = sample.memoryGbHours * rates.perGbMemoryHour;
  const storageUsd = sample.storageGbHours * rates.perGbStorageHour;
  const egressUsd = sample.egressGb * rates.perGbEgress;

  const totalUsd = roundUsd(cpuUsd + memoryUsd + storageUsd + egressUsd);

  return { cpuUsd, memoryUsd, storageUsd, egressUsd, totalUsd };
}

/**
 * Estimate the dollar cost of one or more usage samples.
 *
 * When given an array, raw per-resource costs are summed across all samples and
 * only the final total is rounded — this keeps long roll-ups (many small
 * samples) accurate.
 *
 * @param usage - A single {@link UsageSample} or an array of them.
 * @param rates - Per-unit pricing (defaults to {@link DEFAULT_COST_RATES}).
 * @returns The estimated USD cost, rounded to 4 decimal places.
 *
 * @example
 * ```ts
 * estimateUsd({ cpuSeconds: 3600, memoryGbHours: 2, storageGbHours: 10, egressGb: 1 });
 * // 0.04 (cpu) + 0.01 (mem) + 0.002 (storage) + 0.09 (egress) = 0.142
 * ```
 */
export function estimateUsd(
  usage: UsageSample | readonly UsageSample[],
  rates: CostRates = DEFAULT_COST_RATES,
): number {
  const samples = Array.isArray(usage)
    ? usage
    : [usage as UsageSample];

  let cpuUsd = 0;
  let memoryUsd = 0;
  let storageUsd = 0;
  let egressUsd = 0;

  for (const sample of samples) {
    cpuUsd += (sample.cpuSeconds / SECONDS_PER_HOUR) * rates.perVcpuHour;
    memoryUsd += sample.memoryGbHours * rates.perGbMemoryHour;
    storageUsd += sample.storageGbHours * rates.perGbStorageHour;
    egressUsd += sample.egressGb * rates.perGbEgress;
  }

  return roundUsd(cpuUsd + memoryUsd + storageUsd + egressUsd);
}
