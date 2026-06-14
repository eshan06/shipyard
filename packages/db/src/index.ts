/**
 * `@shipyard/db` — the shared data-access layer for Shipyard.
 *
 * This module exposes a process-wide singleton {@link PrismaClient} instance
 * (`prisma`) and re-exports the full generated Prisma client surface — every
 * model type, enum, input/where type, and the {@link Prisma} namespace — so
 * that consumers (`apps/api`, `apps/worker`, the seed) import everything they
 * need from a single place:
 *
 * ```ts
 * import { prisma, PreviewStatus, type Preview, Prisma } from "@shipyard/db";
 * ```
 *
 * ## Why a singleton?
 *
 * In development, hot-reloading module systems (Next.js, `tsx watch`, Vitest)
 * re-evaluate modules repeatedly. Each fresh `new PrismaClient()` opens a new
 * connection pool, which quickly exhausts Postgres connection limits — the
 * classic "too many connections" / "connection storm" failure mode. To avoid
 * it we cache the instance on `globalThis` and reuse it across reloads. In
 * production we intentionally do **not** attach to the global so each process
 * owns exactly one client for its lifetime.
 *
 * @packageDocumentation
 */

import { PrismaClient } from "../generated/client/index.js";

// Re-export the entire generated client surface (models, enums, Prisma
// namespace, input/where types, etc.). Downstream packages import their
// domain types from here rather than reaching into `generated/`.
export * from "../generated/client/index.js";

/**
 * Resolve the desired Prisma log levels from the environment.
 *
 * - `PRISMA_LOG` may be a comma-separated list of Prisma log levels
 *   (`query`, `info`, `warn`, `error`).
 * - Otherwise we default to a quiet, production-friendly set (`warn`, `error`),
 *   widening to include `info` outside production.
 */
type PrismaLogLevel = "query" | "info" | "warn" | "error";

const ALLOWED_LOG_LEVELS: readonly PrismaLogLevel[] = [
  "query",
  "info",
  "warn",
  "error",
];

function isLogLevel(value: string): value is PrismaLogLevel {
  return (ALLOWED_LOG_LEVELS as readonly string[]).includes(value);
}

function resolveLogLevels(): PrismaLogLevel[] {
  const raw = process.env.PRISMA_LOG?.trim();
  if (raw) {
    const levels = raw
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(isLogLevel);
    if (levels.length > 0) return levels;
  }
  return process.env.NODE_ENV === "production"
    ? ["warn", "error"]
    : ["info", "warn", "error"];
}

/**
 * Construct a fully-configured {@link PrismaClient}.
 *
 * Datasource configuration (notably `DATABASE_URL`) is read from the
 * environment by Prisma itself, matching the `datasource db` block in
 * `schema.prisma`.
 */
function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    log: resolveLogLevels(),
  });
}

/**
 * The shape we cache on `globalThis` in non-production environments. Using a
 * unique symbol-ish property name avoids collisions with anything else that
 * augments the global object.
 */
type PrismaGlobal = typeof globalThis & {
  __shipyardPrisma__?: PrismaClient;
};

const globalForPrisma = globalThis as PrismaGlobal;

/**
 * The shared, singleton Prisma client for Shipyard.
 *
 * Import this directly — do **not** instantiate your own `PrismaClient`:
 *
 * ```ts
 * import { prisma } from "@shipyard/db";
 *
 * const previews = await prisma.preview.findMany({ where: { status: "RUNNING" } });
 * ```
 *
 * In development the instance is memoized on `globalThis` so repeated module
 * evaluation (hot reload) reuses one connection pool. In production a new,
 * un-cached instance is created per process.
 */
export const prisma: PrismaClient =
  globalForPrisma.__shipyardPrisma__ ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.__shipyardPrisma__ = prisma;
}

export default prisma;
