/**
 * Deployments router (STUB — to be implemented by a feature agent).
 *
 * Owns: `GET /deployments`, `GET /deployments/:id`,
 * `POST /deployments/:id/cancel`.
 * (Live `GET /deployments/:id/logs` SSE lives in `routes/streams.ts`.)
 *
 * Follow `routes/teams.ts` for the canonical pattern; use `teamIdForDeployment`
 * from `lib/rbac`.
 *
 * @module
 */

import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";

/**
 * The deployments router. Mounted under `/api/v1` with `app.requireAuth`.
 *
 * @param _app - The Fastify instance (zod type provider).
 */
export const deploymentsRoutes: FastifyPluginAsyncZod = async (_app) => {
  // TODO(feature-agent): implement deployment listing/detail/cancel endpoints.
};
