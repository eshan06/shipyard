/**
 * Costs router (STUB — to be implemented by a feature agent).
 *
 * Owns: `GET /costs/summary` (team cost roll-up vs. budget) and
 * `GET /previews/:id/costs` (per-preview cost history).
 *
 * Follow `routes/teams.ts` for the canonical pattern; use `lib/serialize`'s
 * `decimalToNumber` for `estimatedUsd` and the `@shipyard/core` cost helpers.
 *
 * @module
 */

import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";

/**
 * The costs router. Mounted under `/api/v1` with `app.requireAuth`.
 *
 * @param _app - The Fastify instance (zod type provider).
 */
export const costsRoutes: FastifyPluginAsyncZod = async (_app) => {
  // TODO(feature-agent): implement cost summary + per-preview cost endpoints.
};
