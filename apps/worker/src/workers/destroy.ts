/**
 * The `destroy` worker: stop + remove a preview's running resources.
 *
 * Idempotent and reason-aware:
 *  - The preview moves to DESTROYING, the orchestrator tears down its resources
 *    (discovered by Shipyard labels), and `Service` rows are marked STOPPED.
 *  - `reason: "idle"` → the preview is parked at STOPPED (resumable).
 *  - `reason: "pr_closed" | "manual" | "ttl"` → the preview is DESTROYED with a
 *    `destroyedAt` stamp (terminal).
 *  - Already-destroyed previews are a no-op.
 *
 * As with the deploy worker, the testable core is {@link processDestroyJob} and
 * {@link createDestroyWorker} only wires it onto a BullMQ {@link Worker}.
 *
 * @module
 */

import { Worker, type Job } from "bullmq";
import type { PreviewOrchestrator } from "@shipyard/deploy-engine";
import {
  DestroyJobSchema,
  QUEUE,
  canTransitionPreview,
  type DestroyJob,
  type DestroyReason,
} from "@shipyard/core";
import { type PrismaClient, type PreviewStatus } from "@shipyard/db";
import type { Logger } from "pino";
import type { WorkerConfig } from "../config.js";
import { bullConnection, type WorkerConnection } from "../connection.js";
import type { EventPublisher } from "../events.js";

/** Dependencies injected into {@link processDestroyJob} and the worker. */
export interface DestroyWorkerDeps {
  /** Prisma client (the real singleton in prod; a mock in tests). */
  prisma: PrismaClient;
  /** The selected preview orchestrator. */
  orchestrator: PreviewOrchestrator;
  /** Status fan-out (live pub/sub). */
  events: EventPublisher;
  /** Validated worker configuration. */
  config: WorkerConfig;
  /** Root logger; a child is derived per job. */
  logger: Logger;
}

/** Construct-time deps for {@link createDestroyWorker} (adds the connection). */
export interface CreateDestroyWorkerDeps extends DestroyWorkerDeps {
  /** Shared BullMQ ioredis connection. */
  connection: WorkerConnection;
  /** Concurrency for this worker. Defaults to `config.WORKER_CONCURRENCY`. */
  concurrency?: number;
}

/** Reasons that result in a terminal DESTROYED preview (vs a resumable STOPPED). */
const TERMINAL_REASONS: ReadonlySet<DestroyReason> = new Set<DestroyReason>([
  "pr_closed",
  "manual",
  "ttl",
]);

/**
 * Process a single validated {@link DestroyJob}.
 *
 * @param job - The validated destroy payload.
 * @param deps - Injected Prisma/orchestrator/events/config/logger.
 */
export async function processDestroyJob(
  job: DestroyJob,
  deps: DestroyWorkerDeps,
): Promise<void> {
  const { prisma: db, orchestrator, events } = deps;
  const log = deps.logger.child({ job: "destroy", ...job });

  const preview = await db.preview.findUnique({
    where: { id: job.previewId },
    select: { id: true, status: true, projectId: true },
  });
  if (!preview) {
    log.warn("preview row not found; dropping destroy job");
    return;
  }
  if (preview.status === "DESTROYED") {
    log.info("preview already destroyed; no-op");
    return;
  }

  const teamId = await teamIdForProject(db, preview.projectId);

  // ── DESTROYING ──────────────────────────────────────────────────────────────
  await transitionPreview(db, events, preview.id, preview.status, "DESTROYING", {
    projectId: preview.projectId,
    teamId,
  });

  try {
    await orchestrator.destroy(preview.id);
  } catch (error) {
    log.error({ err: error }, "orchestrator destroy failed");
    throw error;
  }

  // Mark all of the preview's service rows STOPPED.
  await db.service.updateMany({
    where: { previewId: preview.id },
    data: { status: "STOPPED", containerId: null },
  });

  // ── Final state by reason ─────────────────────────────────────────────────
  const terminal = TERMINAL_REASONS.has(job.reason);
  const finalStatus: PreviewStatus = terminal ? "DESTROYED" : "STOPPED";
  await transitionPreview(db, events, preview.id, "DESTROYING", finalStatus, {
    projectId: preview.projectId,
    teamId,
    destroyedAt: terminal ? new Date() : undefined,
  });

  log.info({ reason: job.reason, finalStatus }, "preview torn down");
}

/**
 * Create the BullMQ {@link Worker} for the `destroy` queue.
 *
 * @param deps - Injected deps plus the shared connection + concurrency.
 * @returns A started worker. Caller is responsible for `close()`.
 */
export function createDestroyWorker(deps: CreateDestroyWorkerDeps): Worker {
  const { connection, config } = deps;
  const worker = new Worker(
    QUEUE.destroy,
    async (job: Job) => {
      const payload = DestroyJobSchema.parse(job.data);
      await processDestroyJob(payload, deps);
    },
    {
      connection: bullConnection(connection),
      concurrency: deps.concurrency ?? config.WORKER_CONCURRENCY,
    },
  );
  worker.on("failed", (job, err) => {
    deps.logger.error(
      { jobId: job?.id, err },
      "destroy job failed (will retry per attempts)",
    );
  });
  return worker;
}

// ─────────────────────────────────────────────────────────────────────────────
// Internals
// ─────────────────────────────────────────────────────────────────────────────

/** Resolve the owning team id for a project (for the firehose payload). */
async function teamIdForProject(
  db: PrismaClient,
  projectId: string,
): Promise<string | undefined> {
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { teamId: true },
  });
  return project?.teamId;
}

/** Options accepted by {@link transitionPreview}. */
interface PreviewUpdate {
  projectId?: string;
  teamId?: string;
  destroyedAt?: Date;
}

/**
 * Guarded Preview status write + status pub/sub for the teardown path.
 */
async function transitionPreview(
  db: PrismaClient,
  events: EventPublisher,
  previewId: string,
  from: PreviewStatus,
  to: PreviewStatus,
  extra: PreviewUpdate = {},
): Promise<void> {
  if (!canTransitionPreview(from, to)) return;
  const updated = await db.preview.update({
    where: { id: previewId },
    data: {
      ...(from === to ? {} : { status: to }),
      ...(extra.destroyedAt ? { destroyedAt: extra.destroyedAt } : {}),
    },
    select: { status: true, url: true },
  });
  await events.previewStatus({
    previewId,
    status: updated.status,
    url: updated.url,
    projectId: extra.projectId,
    teamId: extra.teamId,
  });
}
