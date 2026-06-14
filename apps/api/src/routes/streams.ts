/**
 * Streams router — Server-Sent Events (SSE) endpoints.
 *
 * Relays the worker's Redis pub/sub firehose to the browser as SSE, plus a
 * durable backfill of persisted rows so a client that connects mid-deploy still
 * sees the full log. The full request pipeline still applies up to the point we
 * start streaming: schema validation → auth (`app.requireAuth`) → RBAC
 * (`teamIdForPreview`/`teamIdForDeployment` + `requireTeamRole`, VIEWER) → then
 * we hijack the reply and stream.
 *
 * Endpoints (all VIEWER, all under `/api/v1` with `app.requireAuth`):
 *  - `GET /deployments/:id/logs` — backfill persisted `LogChunk` rows (ordered
 *    by `seq`) as SSE events, then live-tail `CHANNEL.deployLogs(id)`.
 *  - `GET /previews/:id/logs` — same, for the preview's latest deployment.
 *  - `GET /previews/:id/status` — current preview status immediately, then
 *    live status transitions from `CHANNEL.previewStatus(id)`.
 *
 * These routes `reply.hijack()` and write directly to the raw socket, so they
 * do not declare zod `response` schemas (there is no JSON body to serialize);
 * they keep the connection open until the client disconnects.
 *
 * @module
 */

import { z } from "zod";

import { CHANNEL, NotFoundError } from "@shipyard/core";

import { writeAudit } from "../lib/audit.js";
import {
  teamIdForDeployment,
  teamIdForPreview,
  requireTeamRole,
} from "../lib/rbac.js";
import { streamRedisChannel } from "../lib/sse.js";

import { ErrorResponseSchema } from "./schemas.js";

import type { FastifyInstance } from "fastify";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";

/** Path-params schema for the `:id` routes. */
const StreamParamsSchema = z.object({ id: z.string().min(1) });

/**
 * The wire shape of a backfilled `LogChunk`, kept identical to the live
 * `LiveLogMessage` published on `CHANNEL.deployLogs` so the browser can treat
 * the backfill and the live tail uniformly.
 */
interface LogEventDto {
  seq: number;
  level: string;
  source: string;
  message: string;
  ts: string;
}

/**
 * Load the persisted log backfill for a deployment, ordered by `seq`, as
 * pre-serialized SSE payloads matching the live `LiveLogMessage` shape.
 *
 * @param app - The Fastify instance (for `app.prisma`).
 * @param deploymentId - The deployment whose logs to load.
 * @returns JSON strings ready to be written as SSE `data:` events.
 */
async function backfillDeploymentLogs(
  app: FastifyInstance,
  deploymentId: string,
): Promise<string[]> {
  const chunks = await app.prisma.logChunk.findMany({
    where: { deploymentId },
    orderBy: { seq: "asc" },
  });

  return chunks.map((chunk) => {
    const event: LogEventDto = {
      seq: chunk.seq,
      level: chunk.level,
      source: chunk.source,
      message: chunk.message,
      ts: chunk.timestamp.toISOString(),
    };
    return JSON.stringify(event);
  });
}

/**
 * The streams (SSE) router. Mounted under `/api/v1` with `app.requireAuth`.
 *
 * @param app - The Fastify instance (zod type provider).
 */
export const streamsRoutes: FastifyPluginAsyncZod = async (app) => {
  // ── Deployment logs: backfill persisted chunks, then live-tail ────────────
  app.get(
    "/deployments/:id/logs",
    {
      schema: {
        tags: ["streams"],
        summary: "Stream a deployment's logs (SSE: backfill + live tail)",
        params: StreamParamsSchema,
        response: {
          401: ErrorResponseSchema,
          403: ErrorResponseSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const teamId = await teamIdForDeployment(app.prisma, id);
      await requireTeamRole(app, request, teamId, "VIEWER");

      const prime = await backfillDeploymentLogs(app, id);

      await writeAudit(app.prisma, {
        teamId,
        actorId: request.auth!.userId,
        action: "deployment.logs.stream",
        targetType: "Deployment",
        targetId: id,
      });

      await streamRedisChannel(app, reply, CHANNEL.deployLogs(id), { prime });
    },
  );

  // ── Preview logs: resolve latest deployment, backfill, then live-tail ─────
  app.get(
    "/previews/:id/logs",
    {
      schema: {
        tags: ["streams"],
        summary:
          "Stream a preview's latest deployment logs (SSE: backfill + live tail)",
        params: StreamParamsSchema,
        response: {
          401: ErrorResponseSchema,
          403: ErrorResponseSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const teamId = await teamIdForPreview(app.prisma, id);
      await requireTeamRole(app, request, teamId, "VIEWER");

      // The "latest" deployment is the most recently queued one for the preview.
      const latest = await app.prisma.deployment.findFirst({
        where: { previewId: id },
        orderBy: { queuedAt: "desc" },
        select: { id: true },
      });
      if (!latest) {
        throw new NotFoundError("Deployment", `latest for preview ${id}`);
      }

      const prime = await backfillDeploymentLogs(app, latest.id);

      await writeAudit(app.prisma, {
        teamId,
        actorId: request.auth!.userId,
        action: "preview.logs.stream",
        targetType: "Preview",
        targetId: id,
        metadata: { deploymentId: latest.id },
      });

      await streamRedisChannel(app, reply, CHANNEL.deployLogs(latest.id), {
        prime,
      });
    },
  );

  // ── Preview status: send current immediately, then live transitions ───────
  app.get(
    "/previews/:id/status",
    {
      schema: {
        tags: ["streams"],
        summary: "Stream a preview's status changes (SSE)",
        params: StreamParamsSchema,
        response: {
          401: ErrorResponseSchema,
          403: ErrorResponseSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const teamId = await teamIdForPreview(app.prisma, id);
      await requireTeamRole(app, request, teamId, "VIEWER");

      const preview = await app.prisma.preview.findUnique({
        where: { id },
        select: { status: true, url: true, updatedAt: true },
      });
      if (!preview) throw new NotFoundError("Preview", id);

      // Send the current status first so clients render immediately, matching
      // the live `PreviewStatusMessage` shape published on the channel.
      const current = JSON.stringify({
        previewId: id,
        status: preview.status,
        url: preview.url,
        at: preview.updatedAt.toISOString(),
      });

      await streamRedisChannel(app, reply, CHANNEL.previewStatus(id), {
        prime: [current],
      });
    },
  );
};
