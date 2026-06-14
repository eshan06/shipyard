/**
 * `POST /telemetry` — product-analytics ingestion.
 *
 * The dashboard's `trackEvent` seam batches client events and posts them here.
 * The route stamps the **authenticated** principal onto every event (so the
 * recorded identity can't be spoofed by the client) and forwards each to the
 * configured analytics sink (`app.analytics`). Mounted under `/api/v1` with
 * `app.requireAuth` (see `routes/index.ts`), so only signed-in callers can emit.
 *
 * @module
 */

import { z } from "zod";

import { callerTeamScope } from "../lib/rbac.js";

import { ErrorResponseSchema } from "./schemas.js";

import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";

/** One client-supplied event. Identity is added server-side, never here. */
const TelemetryEventSchema = z.object({
  /** Event name in snake_case (bounded to keep cardinality sane). */
  name: z.string().min(1).max(120),
  /** Arbitrary JSON-serializable properties. */
  properties: z.record(z.unknown()).optional(),
  /** Client ISO-8601 timestamp of when the event occurred. */
  ts: z.string().datetime().optional(),
});

/** A small batch of events (the client flushes in batches). */
const TelemetryBodySchema = z.object({
  events: z.array(TelemetryEventSchema).min(1).max(50),
});

/** Response for an accepted batch. */
const TelemetryResponseSchema = z.object({
  /** How many events were accepted. */
  accepted: z.number().int().nonnegative(),
});

/**
 * The `/telemetry` router.
 *
 * @param app - The Fastify instance (zod type provider).
 */
export const telemetryRoutes: FastifyPluginAsyncZod = async (app) => {
  app.post(
    "/telemetry",
    {
      schema: {
        tags: ["telemetry"],
        summary: "Ingest a batch of product-analytics events",
        body: TelemetryBodySchema,
        response: {
          202: TelemetryResponseSchema,
          401: ErrorResponseSchema,
          422: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const userId = request.auth!.userId;
      // For team-scoped API tokens this is the bound team; null for sessions.
      const teamId = callerTeamScope(request) ?? undefined;

      for (const ev of request.body.events) {
        app.analytics.track({
          name: ev.name,
          distinctId: userId,
          teamId,
          source: "web",
          properties: ev.properties,
          timestamp: ev.ts,
        });
      }

      reply.status(202);
      return { accepted: request.body.events.length };
    },
  );
};
