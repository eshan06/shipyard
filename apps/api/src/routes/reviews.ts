/**
 * Reviews router (STUB — to be implemented by a feature agent).
 *
 * Owns: `GET /previews/:id/reviews` (PR reviewer state surfaced on the
 * dashboard).
 *
 * Follow `routes/teams.ts` for the canonical pattern; use `teamIdForPreview`
 * from `lib/rbac`.
 *
 * @module
 */

import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";

/**
 * The reviews router. Mounted under `/api/v1` with `app.requireAuth`.
 *
 * @param _app - The Fastify instance (zod type provider).
 */
export const reviewsRoutes: FastifyPluginAsyncZod = async (_app) => {
  // TODO(feature-agent): implement preview review listing endpoints.
};
