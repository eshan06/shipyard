/**
 * Seed-templates router (STUB — to be implemented by a feature agent).
 *
 * Owns: `GET/POST /projects/:id/seeds`, `PATCH/DELETE /seeds/:id`.
 *
 * Follow `routes/teams.ts` for the canonical pattern; use `teamIdForProject`
 * from `lib/rbac` and `SeedTemplateCreateSchema`/`SeedTemplateUpdateSchema`.
 *
 * @module
 */

import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";

/**
 * The seed-templates router. Mounted under `/api/v1` with `app.requireAuth`.
 *
 * @param _app - The Fastify instance (zod type provider).
 */
export const seedsRoutes: FastifyPluginAsyncZod = async (_app) => {
  // TODO(feature-agent): implement seed-template CRUD endpoints.
};
