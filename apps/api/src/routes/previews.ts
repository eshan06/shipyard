/**
 * Previews router (STUB — to be implemented by a feature agent).
 *
 * Owns: `GET/POST /previews`, `GET/PATCH /previews/:id`,
 * `POST /previews/:id/redeploy|stop|destroy|pin`,
 * `GET/POST /previews/:id/env`, `GET /previews/:id/services`,
 * `GET /previews/:id/reviews`, `GET /previews/:id/costs`.
 * (Live `GET /previews/:id/logs` SSE lives in `routes/streams.ts`.)
 *
 * Follow `routes/teams.ts` for the canonical pattern; use `teamIdForPreview`
 * from `lib/rbac` and `app.queues.enqueueDeploy/enqueueDestroy` for actions.
 *
 * @module
 */

import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";

/**
 * The previews router. Mounted under `/api/v1` with `app.requireAuth`.
 *
 * @param _app - The Fastify instance (zod type provider).
 */
export const previewsRoutes: FastifyPluginAsyncZod = async (_app) => {
  // TODO(feature-agent): implement preview CRUD, lifecycle actions, env, etc.
};
