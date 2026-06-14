/**
 * Projects router (STUB — to be implemented by a feature agent).
 *
 * Owns: `GET/POST /projects`, `GET/PATCH/DELETE /projects/:id`,
 * `GET/POST /projects/:id/env`, `GET/POST /projects/:id/seeds`.
 *
 * Follow `routes/teams.ts` for the canonical pattern: zod schemas from
 * `@shipyard/core` → `app.requireAuth` → `lib/rbac` (`teamIdForProject`) →
 * Prisma → `lib/serialize` → `lib/audit`.
 *
 * @module
 */

import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";

/**
 * The projects router. Mounted under `/api/v1` with `app.requireAuth`.
 *
 * @param _app - The Fastify instance (zod type provider).
 */
export const projectsRoutes: FastifyPluginAsyncZod = async (_app) => {
  // TODO(feature-agent): implement project CRUD + env + seeds endpoints.
};
