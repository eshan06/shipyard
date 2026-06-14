/**
 * API-tokens router (STUB — to be implemented by a feature agent).
 *
 * Owns: `GET/POST /teams/:id/tokens`, `DELETE /teams/:id/tokens/:tokenId`
 * (revoke). On create, return the raw token EXACTLY ONCE (use
 * `lib/tokens.generateApiToken`); persist only `hashedToken`/`prefix`.
 *
 * Follow `routes/teams.ts` for the canonical pattern; require ADMIN to manage
 * tokens. Use `ApiTokenCreateSchema`/`ApiTokenUpdateSchema` from `@shipyard/core`.
 *
 * @module
 */

import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";

/**
 * The API-tokens router. Mounted under `/api/v1` with `app.requireAuth`.
 *
 * @param _app - The Fastify instance (zod type provider).
 */
export const tokensRoutes: FastifyPluginAsyncZod = async (_app) => {
  // TODO(feature-agent): implement token create/list/revoke endpoints.
};
