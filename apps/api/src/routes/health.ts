/**
 * Health/readiness routes (registered at the root, no auth).
 *
 * - `GET /healthz` — liveness: the process is up and serving.
 * - `GET /readyz`  — readiness: dependencies (Postgres, Redis) are reachable;
 *   responds 503 with per-dependency booleans when any check fails, so an
 *   orchestrator can keep the instance out of rotation until it is ready.
 *
 * @module
 */

import { z } from "zod";

import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";

/** `GET /healthz` response schema. */
const HealthSchema = z.object({ status: z.literal("ok") });

/** `GET /readyz` response schema. */
const ReadySchema = z.object({
  status: z.enum(["ready", "not_ready"]),
  db: z.boolean(),
  redis: z.boolean(),
});

/**
 * Health and readiness routes.
 *
 * @param app - The Fastify instance (zod type provider).
 */
export const healthRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    "/healthz",
    {
      schema: {
        tags: ["health"],
        summary: "Liveness probe",
        response: { 200: HealthSchema },
      },
    },
    async () => ({ status: "ok" as const }),
  );

  app.get(
    "/readyz",
    {
      schema: {
        tags: ["health"],
        summary: "Readiness probe (checks Postgres + Redis)",
        response: { 200: ReadySchema, 503: ReadySchema },
      },
    },
    async (_request, reply) => {
      const [db, redis] = await Promise.all([
        app.prisma
          .$queryRaw`SELECT 1`.then(() => true)
          .catch(() => false),
        app.redis
          .ping()
          .then((r) => r === "PONG")
          .catch(() => false),
      ]);

      const ready = db && redis;
      reply.status(ready ? 200 : 503);
      return { status: ready ? ("ready" as const) : ("not_ready" as const), db, redis };
    },
  );
};
