/**
 * Services router (STUB — to be implemented by a feature agent).
 *
 * Owns: `GET /previews/:id/services` (services inside a preview) and any
 * service-level detail endpoints.
 *
 * Follow `routes/teams.ts` for the canonical pattern; use `teamIdForPreview`
 * from `lib/rbac`.
 *
 * @module
 */

import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";

/**
 * The services router. Mounted under `/api/v1` with `app.requireAuth`.
 *
 * @param _app - The Fastify instance (zod type provider).
 */
export const servicesRoutes: FastifyPluginAsyncZod = async (_app) => {
  // TODO(feature-agent): implement preview service listing/detail endpoints.
};
