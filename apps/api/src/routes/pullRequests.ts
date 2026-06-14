/**
 * Pull-requests router (STUB — to be implemented by a feature agent).
 *
 * Owns: `GET /pull-requests` (list tracked PRs, filterable by project/state),
 * `GET /pull-requests/:id`.
 *
 * Follow `routes/teams.ts` for the canonical pattern.
 *
 * @module
 */

import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";

/**
 * The pull-requests router. Mounted under `/api/v1` with `app.requireAuth`.
 *
 * @param _app - The Fastify instance (zod type provider).
 */
export const pullRequestsRoutes: FastifyPluginAsyncZod = async (_app) => {
  // TODO(feature-agent): implement pull-request listing/detail endpoints.
};
