/**
 * Background job contracts shared by the API (producer) and the worker
 * (consumer).
 *
 * Centralizing the queue names and payload schemas here guarantees the two
 * processes agree on the wire shape of every job: the API validates with these
 * schemas before enqueuing, and the worker validates on receipt. Keep this file
 * dependency-light (zod only) so both apps can import it freely.
 *
 * @module
 */

import { z } from "zod";

import { DeploymentTriggerSchema } from "./schemas/enums.js";

/**
 * Canonical BullMQ queue names. Producers and consumers must reference these
 * constants rather than string literals so a rename is a single edit.
 */
export const QUEUE = {
  /** Build + start a preview stack for a deployment. */
  deploy: "deploy",
  /** Tear down a preview's running resources. */
  destroy: "destroy",
  /** Periodic scan for idle/expired previews to stop or destroy. */
  cleanup: "cleanup",
  /** Periodic resource-usage sampling → cost roll-ups. */
  cost: "cost",
} as const;

/** Union of known queue names. */
export type QueueName = (typeof QUEUE)[keyof typeof QUEUE];

/**
 * Recommended default BullMQ job options. Jobs must be idempotent so retries are
 * safe; completed/failed jobs are retained for a bounded window for debugging.
 */
export const DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: "exponential", delay: 5000 },
  removeOnComplete: { age: 86_400 },
  removeOnFail: { age: 604_800 },
} as const;

/**
 * Payload for a `deploy` job: build images for `commitSha`, start the preview
 * stack, seed it, wait for health, and mark the preview RUNNING. Carries the
 * pre-created `deploymentId` so the worker updates an existing row rather than
 * creating one (idempotent on retry).
 */
export const DeployJobSchema = z.object({
  /** The `Deployment` row this job fulfils (already QUEUED). */
  deploymentId: z.string().min(1),
  /** The target `Preview`. */
  previewId: z.string().min(1),
  /** The owning `Project` (drives build config / framework detection). */
  projectId: z.string().min(1),
  /** Git commit to deploy. */
  commitSha: z.string().min(1),
  /** What triggered the deployment (for audit/UX). */
  trigger: DeploymentTriggerSchema.default("PR_SYNC"),
});
/** Inferred type for {@link DeployJobSchema}. */
export type DeployJob = z.infer<typeof DeployJobSchema>;

/** Why a preview is being torn down. */
export const DestroyReasonSchema = z.enum([
  "pr_closed",
  "manual",
  "ttl",
  "idle",
]);
/** Inferred type for {@link DestroyReasonSchema}. */
export type DestroyReason = z.infer<typeof DestroyReasonSchema>;

/**
 * Payload for a `destroy` job: stop and remove a preview's running resources.
 * Whether the `Preview` row is marked STOPPED vs DESTROYED depends on `reason`
 * (idle → STOPPED, others → DESTROYED).
 */
export const DestroyJobSchema = z.object({
  /** The `Preview` to tear down. */
  previewId: z.string().min(1),
  /** Why the teardown was requested. */
  reason: DestroyReasonSchema,
});
/** Inferred type for {@link DestroyJobSchema}. */
export type DestroyJob = z.infer<typeof DestroyJobSchema>;

/**
 * Payload for the repeatable `cleanup` job. Carries no data — the worker scans
 * the database for idle/expired previews each tick.
 */
export const CleanupJobSchema = z.object({}).strict();
/** Inferred type for {@link CleanupJobSchema}. */
export type CleanupJob = z.infer<typeof CleanupJobSchema>;

/**
 * Payload for the repeatable `cost` job. Carries no data — the worker samples
 * resource usage for all running previews each tick.
 */
export const CostJobSchema = z.object({}).strict();
/** Inferred type for {@link CostJobSchema}. */
export type CostJob = z.infer<typeof CostJobSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Redis pub/sub channels (live updates → SSE)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Redis pub/sub channel name builders. The worker publishes; the API subscribes
 * and relays to browsers over SSE. The persisted `LogChunk`/`Preview` rows are
 * the durable copy — these channels are only the live tail.
 */
export const CHANNEL = {
  /** Live log lines for a deployment. */
  deployLogs: (deploymentId: string) => `sy:deploy:logs:${deploymentId}`,
  /** Status transitions for a single preview. */
  previewStatus: (previewId: string) => `sy:preview:status:${previewId}`,
  /** Global firehose of preview events (drives the dashboard list). */
  previewEvents: "sy:preview:events",
} as const;

/** A single live log line published on a {@link CHANNEL.deployLogs} channel. */
export const LiveLogMessageSchema = z.object({
  seq: z.number().int().nonnegative(),
  level: z.enum(["DEBUG", "INFO", "WARN", "ERROR"]).default("INFO"),
  source: z.enum(["BUILD", "DEPLOY", "RUNTIME", "SYSTEM"]).default("SYSTEM"),
  message: z.string(),
  ts: z.string(),
});
/** Inferred type for {@link LiveLogMessageSchema}. */
export type LiveLogMessage = z.infer<typeof LiveLogMessageSchema>;

/** A preview status change published on {@link CHANNEL.previewStatus}. */
export const PreviewStatusMessageSchema = z.object({
  previewId: z.string(),
  status: z.string(),
  url: z.string().nullable().optional(),
  at: z.string(),
});
/** Inferred type for {@link PreviewStatusMessageSchema}. */
export type PreviewStatusMessage = z.infer<typeof PreviewStatusMessageSchema>;
