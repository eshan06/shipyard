/**
 * Webhooks router (STUB — to be implemented by a feature agent). PUBLIC: these
 * routes are NOT behind `app.requireAuth`; they are authenticated by signature.
 *
 * Owns: `POST /webhooks/github` — verify the `X-Hub-Signature-256` HMAC against
 * `config.GITHUB_WEBHOOK_SECRET`, idempotently record the delivery in
 * `WebhookEvent` (keyed on `deliveryId`), and on PR open/sync/close upsert the
 * `PullRequest`/`Preview` and enqueue deploy/destroy jobs (`app.queues`).
 *
 * Follow `routes/teams.ts` for schema/handler style (but no RBAC here).
 *
 * @module
 */

import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";

/**
 * The webhooks router. Mounted under `/api/v1` WITHOUT `app.requireAuth`.
 *
 * @param _app - The Fastify instance (zod type provider).
 */
export const webhooksRoutes: FastifyPluginAsyncZod = async (_app) => {
  // TODO(feature-agent): implement signature-verified GitHub webhook ingestion.
};
