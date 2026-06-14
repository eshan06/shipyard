/**
 * Env-vars router (STUB — to be implemented by a feature agent).
 *
 * Owns: `GET/POST /projects/:id/env`, `GET/POST /previews/:id/env`,
 * `PATCH/DELETE /env/:id`. Uses `@shipyard/core` crypto
 * (`encryptSecret`/`decryptSecret`) to store `valueEncrypted`; NEVER returns a
 * secret value over the API (masked: `value: null, isSecret: true`).
 *
 * Follow `routes/teams.ts` for the canonical pattern.
 *
 * @module
 */

import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";

/**
 * The env-vars router. Mounted under `/api/v1` with `app.requireAuth`.
 *
 * @param _app - The Fastify instance (zod type provider).
 */
export const envVarsRoutes: FastifyPluginAsyncZod = async (_app) => {
  // TODO(feature-agent): implement env-var CRUD with secret masking + crypto.
};
