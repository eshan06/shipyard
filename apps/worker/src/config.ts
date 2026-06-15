/**
 * Runtime configuration for the Shipyard background worker.
 *
 * Like the API, the worker validates its entire environment once at startup with
 * a zod schema and fails fast on any invalid/missing variable (per
 * `docs/ENGINEERING.md` §4). Downstream code reads the validated, typed
 * {@link WorkerConfig} rather than touching `process.env` directly, so a
 * misconfiguration can never silently surface deep inside a job processor.
 *
 * @module
 */

import { z } from "zod";

import { loadCostRates, loadEncryptionKey, type CostRates } from "@shipyard/core";

/**
 * The full, validated environment schema for the worker. Docker-specific vars
 * are optional so the service boots in `mock` mode without a daemon configured.
 */
const ConfigSchema = z.object({
  /** Node runtime mode; gates pretty logging and Prisma global caching. */
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  /** Pino log level. */
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),

  /** Postgres connection string (read by Prisma). */
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  /** Redis connection string (BullMQ queues + pub/sub). */
  REDIS_URL: z.string().min(1, "REDIS_URL is required"),
  /**
   * Base64 32-byte secrets key. Validated via core `loadEncryptionKey`, which
   * throws a clear message when it is missing or the wrong length.
   */
  SECRETS_ENCRYPTION_KEY: z
    .string()
    .min(1, "SECRETS_ENCRYPTION_KEY is required")
    .superRefine((value, ctx) => {
      try {
        loadEncryptionKey({ SECRETS_ENCRYPTION_KEY: value });
      } catch (error) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            error instanceof Error
              ? error.message
              : "SECRETS_ENCRYPTION_KEY is invalid",
        });
      }
    }),

  /** Which orchestrator to drive: in-memory `mock` or real `docker`. */
  DEPLOY_DRIVER: z.enum(["mock", "docker"]).default("mock"),
  /** Docker daemon endpoint; empty lets dockerode use its default. */
  DOCKER_HOST: z.string().optional(),

  /** Wildcard DNS domain for preview URLs (`<slug>.<domain>`). */
  PREVIEW_BASE_DOMAIN: z.string().min(1, "PREVIEW_BASE_DOMAIN is required"),
  /**
   * Default idle window (minutes) after which a RUNNING preview is auto-stopped.
   * Used as a fallback when a preview/project does not specify its own.
   */
  PREVIEW_AUTO_STOP_MINUTES: z.coerce.number().int().min(1).default(120),
  /**
   * Default TTL (minutes) after a PR closes/merges before its preview is
   * destroyed. Used as a fallback when the project does not specify its own.
   */
  PREVIEW_DESTROY_TTL_MINUTES: z.coerce.number().int().min(1).default(60),

  /** Number of jobs the deploy/destroy workers process concurrently. */
  WORKER_CONCURRENCY: z.coerce.number().int().min(1).default(4),
  /** How often (ms) the cleanup scheduler scans for idle/expired previews. */
  CLEANUP_INTERVAL_MS: z.coerce.number().int().min(1_000).default(60_000),
  /** How often (ms) the cost scheduler samples running previews. */
  COST_INTERVAL_MS: z.coerce.number().int().min(1_000).default(300_000),

  /** USD per vCPU-hour. */
  COST_PER_VCPU_HOUR: z.coerce.number().min(0).optional(),
  /** USD per GB-hour of memory. */
  COST_PER_GB_MEM_HOUR: z.coerce.number().min(0).optional(),
  /** USD per GB-hour of storage. */
  COST_PER_GB_STORAGE_HOUR: z.coerce.number().min(0).optional(),
  /** USD per GB of network egress. */
  COST_PER_GB_EGRESS: z.coerce.number().min(0).optional(),
});

/**
 * The validated, typed worker configuration. The {@link WorkerConfig.costRates}
 * field is derived from the `COST_*` env vars via core `loadCostRates`, so cost
 * math stays consistent with the rest of the platform.
 */
export type WorkerConfig = Readonly<
  z.infer<typeof ConfigSchema> & {
    /** Per-unit cost rates resolved from the `COST_*` environment variables. */
    costRates: CostRates;
  }
>;

/**
 * Parse and validate the process environment into a {@link WorkerConfig}.
 *
 * @param env - Environment map to read from. Defaults to `process.env`.
 * @returns A frozen, fully-validated configuration object (including
 *   {@link CostRates}).
 * @throws Error with a single message listing every invalid/missing field when
 *   validation fails — surfaced once at startup so the operator can fix them all.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): WorkerConfig {
  // Treat a blank env var as unset, so empty `.env` placeholders fall through to
  // `.optional()`/`.default()` instead of being coerced (e.g. an empty
  // `COST_PER_VCPU_HOUR=` would otherwise coerce to 0, not undefined). Keeps
  // "unset" and "empty" equivalent across every field. Mirrors the API config.
  const compact: NodeJS.ProcessEnv = {};
  for (const [key, value] of Object.entries(env)) {
    if (value !== undefined && value !== "") compact[key] = value;
  }
  const parsed = ConfigSchema.safeParse(compact);
  if (!parsed.success) {
    const lines = parsed.error.issues
      .map((issue) => {
        const path = issue.path.join(".") || "(root)";
        return `  - ${path}: ${issue.message}`;
      })
      .join("\n");
    throw new Error(
      `Invalid worker configuration. Fix the following environment variables:\n${lines}`,
    );
  }
  return Object.freeze({ ...parsed.data, costRates: loadCostRates(env) });
}
