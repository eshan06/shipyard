/**
 * The `cleanup` scheduler: periodically scans for previews that should be
 * stopped (idle) or destroyed (closed/merged PR past its TTL) and enqueues
 * `destroy` jobs for them.
 *
 * The decision logic is a pure function — {@link findPreviewsToCleanup} — so it
 * can be unit-tested without any database or queue. {@link createCleanupWorker}
 * wires it onto a repeatable BullMQ {@link Worker}: each tick it loads candidate
 * previews, runs the pure scan, and enqueues the resulting destroy jobs.
 *
 * @module
 */

import { Queue, Worker, type Job } from "bullmq";
import {
  DEFAULT_JOB_OPTIONS,
  DestroyJobSchema,
  QUEUE,
  type DestroyReason,
} from "@shipyard/core";
import type { PrismaClient, PreviewStatus, PullRequestState } from "@shipyard/db";
import type { Logger } from "pino";
import type { WorkerConfig } from "../config.js";
import { bullConnection, type WorkerConnection } from "../connection.js";

/**
 * The minimal projection of a preview the cleanup scan reasons about. Mirrors
 * the columns selected by {@link loadCleanupCandidates}.
 */
export interface CleanupCandidate {
  /** Preview id. */
  id: string;
  /** Current preview status. */
  status: PreviewStatus;
  /** Pinned previews are exempt from auto-stop/destroy. */
  isPinned: boolean;
  /** Last activity timestamp (drives idle detection). */
  lastActivityAt: Date;
  /** The preview's own idle window, in minutes. */
  autoStopMinutes: number;
  /** Effective closed-PR destroy TTL (minutes) from the owning project. */
  destroyTtlMinutes: number;
  /** Owning PR state, when the preview is linked to one. */
  pullRequestState?: PullRequestState | null;
  /** When the owning PR last changed (proxy for close/merge time). */
  pullRequestUpdatedAt?: Date | null;
}

/** A teardown decision produced by {@link findPreviewsToCleanup}. */
export interface CleanupDecision {
  /** The preview to tear down. */
  previewId: string;
  /** Why it is being torn down. */
  reason: DestroyReason;
}

/** Preview statuses that are eligible for idle auto-stop. */
const IDLE_ELIGIBLE: ReadonlySet<PreviewStatus> = new Set<PreviewStatus>([
  "RUNNING",
  "DEGRADED",
]);

/** Preview statuses that are already gone (or going) — skip for TTL destroy. */
const ALREADY_TEARING_DOWN: ReadonlySet<PreviewStatus> = new Set<PreviewStatus>([
  "DESTROYING",
  "DESTROYED",
]);

/** PR states that make a preview eligible for TTL-based destruction. */
const CLOSED_PR_STATES: ReadonlySet<PullRequestState> =
  new Set<PullRequestState>(["CLOSED", "MERGED"]);

/** Milliseconds in a minute. */
const MS_PER_MINUTE = 60_000;

/**
 * Decide which previews to tear down, given the current time and a snapshot of
 * candidates. Pure and deterministic — no I/O.
 *
 * Rules (TTL/destroy takes precedence over idle/stop for the same preview):
 *  - A preview whose owning PR is CLOSED/MERGED and whose PR last changed more
 *    than `destroyTtlMinutes` ago, and which is not already DESTROYING/DESTROYED,
 *    is destroyed with `reason: "ttl"`.
 *  - Otherwise, a RUNNING/DEGRADED, non-pinned preview idle for longer than its
 *    `autoStopMinutes` is stopped with `reason: "idle"`.
 *  - Pinned previews are never auto-stopped (but a closed PR still triggers TTL
 *    destruction — a closed PR has no reason to keep its env around).
 *
 * @param now - The current instant.
 * @param previews - Candidate previews to evaluate.
 * @returns The teardown decisions (one per affected preview).
 */
export function findPreviewsToCleanup(
  now: Date,
  previews: readonly CleanupCandidate[],
): CleanupDecision[] {
  const decisions: CleanupDecision[] = [];
  const nowMs = now.getTime();

  for (const preview of previews) {
    if (ALREADY_TEARING_DOWN.has(preview.status)) continue;

    // TTL destroy (closed/merged PR past TTL) takes precedence.
    if (
      preview.pullRequestState &&
      CLOSED_PR_STATES.has(preview.pullRequestState) &&
      preview.pullRequestUpdatedAt
    ) {
      const elapsedMin =
        (nowMs - preview.pullRequestUpdatedAt.getTime()) / MS_PER_MINUTE;
      if (elapsedMin >= preview.destroyTtlMinutes) {
        decisions.push({ previewId: preview.id, reason: "ttl" });
        continue;
      }
    }

    // Idle auto-stop for live, non-pinned previews.
    if (!preview.isPinned && IDLE_ELIGIBLE.has(preview.status)) {
      const idleMin =
        (nowMs - preview.lastActivityAt.getTime()) / MS_PER_MINUTE;
      if (idleMin >= preview.autoStopMinutes) {
        decisions.push({ previewId: preview.id, reason: "idle" });
      }
    }
  }

  return decisions;
}

/** Dependencies for the cleanup tick + worker. */
export interface CleanupWorkerDeps {
  /** Prisma client. */
  prisma: PrismaClient;
  /** The destroy queue to enqueue teardown jobs onto. */
  destroyQueue: Queue;
  /** Validated worker configuration. */
  config: WorkerConfig;
  /** Logger. */
  logger: Logger;
}

/** Construct-time deps for {@link createCleanupWorker} (adds the connection). */
export interface CreateCleanupWorkerDeps extends CleanupWorkerDeps {
  /** Shared BullMQ ioredis connection. */
  connection: WorkerConnection;
}

/**
 * Run one cleanup tick: load candidates, decide, and enqueue destroy jobs.
 * Exposed (not just inlined in the worker) so it can be invoked/tested directly.
 *
 * @param deps - Prisma + destroy queue + config + logger.
 * @param now - The current instant (injectable for tests). Defaults to now.
 * @returns The decisions that were enqueued.
 */
export async function runCleanupTick(
  deps: CleanupWorkerDeps,
  now: Date = new Date(),
): Promise<CleanupDecision[]> {
  const candidates = await loadCleanupCandidates(deps);
  const decisions = findPreviewsToCleanup(now, candidates);

  for (const decision of decisions) {
    const payload = DestroyJobSchema.parse(decision);
    await deps.destroyQueue.add(QUEUE.destroy, payload, DEFAULT_JOB_OPTIONS);
  }

  if (decisions.length > 0) {
    const idle = decisions.filter((d) => d.reason === "idle").length;
    const ttl = decisions.filter((d) => d.reason === "ttl").length;
    deps.logger.info(
      { scanned: candidates.length, enqueued: decisions.length, idle, ttl },
      "cleanup tick: enqueued teardown jobs",
    );
  } else {
    deps.logger.debug(
      { scanned: candidates.length },
      "cleanup tick: nothing to do",
    );
  }
  return decisions;
}

/**
 * Create the BullMQ {@link Worker} for the repeatable `cleanup` queue.
 *
 * @param deps - Injected deps plus the shared connection.
 * @returns A started worker. Caller is responsible for `close()`.
 */
export function createCleanupWorker(deps: CreateCleanupWorkerDeps): Worker {
  const { connection } = deps;
  const worker = new Worker(
    QUEUE.cleanup,
    async (_job: Job) => {
      await runCleanupTick(deps);
    },
    { connection: bullConnection(connection), concurrency: 1 },
  );
  worker.on("failed", (job, err) => {
    deps.logger.error({ jobId: job?.id, err }, "cleanup tick failed");
  });
  return worker;
}

/**
 * Load the set of previews worth scanning each tick: anything not already
 * destroyed, with its owning project (for the destroy TTL) and PR (for state).
 */
async function loadCleanupCandidates(
  deps: CleanupWorkerDeps,
): Promise<CleanupCandidate[]> {
  const rows = await deps.prisma.preview.findMany({
    where: { status: { notIn: ["DESTROYED", "DESTROYING"] } },
    select: {
      id: true,
      status: true,
      isPinned: true,
      lastActivityAt: true,
      autoStopMinutes: true,
      project: { select: { destroyTtlMinutes: true } },
      pullRequest: { select: { state: true, updatedAt: true } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    status: row.status,
    isPinned: row.isPinned,
    lastActivityAt: row.lastActivityAt,
    autoStopMinutes: row.autoStopMinutes,
    destroyTtlMinutes:
      row.project?.destroyTtlMinutes ?? deps.config.PREVIEW_DESTROY_TTL_MINUTES,
    pullRequestState: row.pullRequest?.state ?? null,
    pullRequestUpdatedAt: row.pullRequest?.updatedAt ?? null,
  }));
}
