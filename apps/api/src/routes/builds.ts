/**
 * Builds router (STUB — to be implemented by a feature agent).
 *
 * Owns: `GET /builds/:id` (build detail, incl. failed-build error summary).
 *
 * Follow `routes/teams.ts` for the canonical pattern; resolve the owning team
 * via the build's deployment (`teamIdForDeployment`).
 *
 * @module
 */

import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";

/**
 * The builds router. Mounted under `/api/v1` with `app.requireAuth`.
 *
 * @param _app - The Fastify instance (zod type provider).
 */
export const buildsRoutes: FastifyPluginAsyncZod = async (_app) => {
  // TODO(feature-agent): implement build detail endpoint.
};
