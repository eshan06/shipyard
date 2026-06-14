/**
 * Notifications router (STUB — to be implemented by a feature agent).
 *
 * Owns: `GET /notifications` (current user's notifications),
 * `POST /notifications/:id/read`, `POST /notifications/read-all`.
 *
 * Follow `routes/teams.ts` for the canonical pattern; notifications are
 * user-scoped (filter by `request.auth.userId`), not team-scoped.
 *
 * @module
 */

import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";

/**
 * The notifications router. Mounted under `/api/v1` with `app.requireAuth`.
 *
 * @param _app - The Fastify instance (zod type provider).
 */
export const notificationsRoutes: FastifyPluginAsyncZod = async (_app) => {
  // TODO(feature-agent): implement notification listing + read endpoints.
};
