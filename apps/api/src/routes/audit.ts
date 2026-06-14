/**
 * Audit router (STUB — to be implemented by a feature agent).
 *
 * Owns: `GET /audit` (team-scoped audit log, paginated/filterable).
 *
 * Follow `routes/teams.ts` for the canonical pattern; require at least ADMIN on
 * the team whose audit log is being read.
 *
 * @module
 */

import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";

/**
 * The audit router. Mounted under `/api/v1` with `app.requireAuth`.
 *
 * @param _app - The Fastify instance (zod type provider).
 */
export const auditRoutes: FastifyPluginAsyncZod = async (_app) => {
  // TODO(feature-agent): implement audit-log listing endpoint.
};
