/**
 * Streams router (STUB — to be implemented by a feature agent).
 *
 * Owns the SSE endpoints that relay Redis pub/sub to the browser:
 *  - `GET /previews/:id/logs`     (live preview/deployment logs)
 *  - `GET /deployments/:id/logs`  (live deployment build/runtime logs)
 *  - `GET /previews/:id/status`   (live preview status transitions)
 *
 * Use `lib/sse.streamRedisChannel` with the channel builders from
 * `@shipyard/core` `CHANNEL` (e.g. `CHANNEL.deployLogs(deploymentId)`), and
 * `lib/rbac` (`teamIdForPreview`/`teamIdForDeployment`) to authorize before
 * subscribing. These routes require auth (mounted with `app.requireAuth`).
 *
 * @module
 */

import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";

/**
 * The streams (SSE) router. Mounted under `/api/v1` with `app.requireAuth`.
 *
 * @param _app - The Fastify instance (zod type provider).
 */
export const streamsRoutes: FastifyPluginAsyncZod = async (_app) => {
  // TODO(feature-agent): implement SSE log/status streams via streamRedisChannel.
};
