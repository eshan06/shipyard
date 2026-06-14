/**
 * Event/log fan-out for the worker.
 *
 * Every meaningful thing that happens during a deploy or teardown is surfaced
 * two ways:
 *
 *  1. **Durably**, as a `LogChunk` row (logs) or a status column update (the
 *     workers own the row writes), and
 *  2. **Live**, by publishing to the Redis pub/sub channels the API relays over
 *     SSE (`@shipyard/core` {@link CHANNEL}).
 *
 * This module owns concern (2) plus the durable `LogChunk` write, and maintains
 * a monotonic per-deployment `seq` so the dashboard can order and de-duplicate
 * log lines. The workers call {@link createEventPublisher} once and pass the
 * returned publisher down their processing pipeline.
 *
 * @module
 */

import {
  CHANNEL,
  LiveLogMessageSchema,
  PreviewStatusMessageSchema,
  type LiveLogMessage,
  type PreviewStatusMessage,
} from "@shipyard/core";
import { prisma, type LogLevel, type LogSource } from "@shipyard/db";
import type { Logger } from "pino";
import type { WorkerConnection } from "./connection.js";

/** A log line to record + publish, before a `seq` is assigned. */
export interface LogEventInput {
  /** The deployment the line belongs to (also the pub/sub channel key). */
  deploymentId: string;
  /** Optional owning service row id (for the `serviceId` foreign key). */
  serviceId?: string;
  /** Log severity. Defaults to `INFO`. */
  level?: LogLevel;
  /** Which pipeline stage emitted the line. Defaults to `SYSTEM`. */
  source?: LogSource;
  /** The (newline-stripped) message. */
  message: string;
  /** Emission timestamp. Defaults to now. */
  at?: Date;
}

/** A preview status change to publish. */
export interface PreviewStatusEventInput {
  /** The preview whose status changed. */
  previewId: string;
  /** New status (a `PreviewStatus` string). */
  status: string;
  /** Resolved public URL, when known. */
  url?: string | null;
  /** Owning project id (for the global firehose). */
  projectId?: string;
  /** Owning team id (for the global firehose). */
  teamId?: string;
  /** Transition timestamp. Defaults to now. */
  at?: Date;
}

/**
 * The fan-out surface the workers use. Methods are best-effort with respect to
 * pub/sub: a Redis publish failure is logged but never aborts a job (the durable
 * row write is what matters for correctness).
 */
export interface EventPublisher {
  /**
   * Persist a {@link LogChunk} and publish the live line. Returns the assigned
   * monotonic `seq`.
   */
  log(event: LogEventInput): Promise<number>;
  /**
   * Publish a preview status change to both the per-preview channel and the
   * global firehose. Does not write the `Preview` row (the caller owns that).
   */
  previewStatus(event: PreviewStatusEventInput): Promise<void>;
}

/** Construct-time dependencies for {@link createEventPublisher}. */
export interface EventPublisherDeps {
  /** Redis client used for `PUBLISH`. */
  connection: WorkerConnection;
  /** Logger for best-effort publish failures. */
  logger: Logger;
}

/**
 * Create an {@link EventPublisher} backed by Prisma + Redis.
 *
 * Per-deployment `seq` counters are kept in-process. They are seeded lazily from
 * the database on first use for a deployment so retries/restarts continue the
 * sequence rather than colliding on `(deploymentId, seq)`.
 *
 * @param deps - Redis connection + logger.
 * @returns An {@link EventPublisher}.
 */
export function createEventPublisher(deps: EventPublisherDeps): EventPublisher {
  const { connection, logger } = deps;
  /** In-process next-seq cache, keyed by deploymentId. */
  const seqByDeployment = new Map<string, number>();

  /** Resolve (and cache) the next `seq` for a deployment, continuing the DB max. */
  async function nextSeq(deploymentId: string): Promise<number> {
    const cached = seqByDeployment.get(deploymentId);
    if (cached !== undefined) {
      seqByDeployment.set(deploymentId, cached + 1);
      return cached;
    }
    const last = await prisma.logChunk.findFirst({
      where: { deploymentId },
      orderBy: { seq: "desc" },
      select: { seq: true },
    });
    const start = (last?.seq ?? -1) + 1;
    seqByDeployment.set(deploymentId, start + 1);
    return start;
  }

  /** Publish a JSON payload to a channel, logging (never throwing on) failures. */
  async function publish(channel: string, payload: unknown): Promise<void> {
    try {
      await connection.publish(channel, JSON.stringify(payload));
    } catch (err) {
      logger.warn({ err, channel }, "redis publish failed");
    }
  }

  return {
    async log(event: LogEventInput): Promise<number> {
      const level: LogLevel = event.level ?? "INFO";
      const source: LogSource = event.source ?? "SYSTEM";
      const at = event.at ?? new Date();
      const seq = await nextSeq(event.deploymentId);

      await prisma.logChunk.create({
        data: {
          deploymentId: event.deploymentId,
          serviceId: event.serviceId ?? null,
          level,
          source,
          seq,
          message: event.message,
          timestamp: at,
        },
      });

      const message: LiveLogMessage = LiveLogMessageSchema.parse({
        seq,
        level,
        source,
        message: event.message,
        ts: at.toISOString(),
      });
      await publish(CHANNEL.deployLogs(event.deploymentId), message);
      return seq;
    },

    async previewStatus(event: PreviewStatusEventInput): Promise<void> {
      const at = (event.at ?? new Date()).toISOString();

      const statusMessage: PreviewStatusMessage =
        PreviewStatusMessageSchema.parse({
          previewId: event.previewId,
          status: event.status,
          url: event.url ?? null,
          at,
        });
      await publish(CHANNEL.previewStatus(event.previewId), statusMessage);

      // Global firehose drives the dashboard list; shape mirrors §5.2.
      await publish(CHANNEL.previewEvents, {
        type: "status",
        previewId: event.previewId,
        projectId: event.projectId ?? null,
        teamId: event.teamId ?? null,
        status: event.status,
        at,
      });
    },
  };
}
