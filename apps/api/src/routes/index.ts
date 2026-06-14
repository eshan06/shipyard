/**
 * Route registration: the single place that mounts every router and applies the
 * correct auth posture to each group.
 *
 * Layout:
 *  - Health (`/healthz`, `/readyz`) at the root, no auth.
 *  - Everything under `/api/v1`:
 *    - PUBLIC group (no `requireAuth`): `auth/*`, `webhooks/*`.
 *    - AUTHENTICATED group (`app.requireAuth` as an `onRequest` hook): `me`,
 *      `teams`, and all feature routers + streams.
 *
 * Public vs. authenticated groups are separate encapsulated plugin scopes, so
 * the `requireAuth` hook applies to exactly the protected routers and nothing
 * leaks into the public ones.
 *
 * @module
 */

import { auditRoutes } from "./audit.js";
import { authRoutes } from "./auth.js";
import { buildsRoutes } from "./builds.js";
import { costsRoutes } from "./costs.js";
import { deploymentsRoutes } from "./deployments.js";
import { envVarsRoutes } from "./envVars.js";
import { healthRoutes } from "./health.js";
import { meRoutes } from "./me.js";
import { notificationsRoutes } from "./notifications.js";
import { previewsRoutes } from "./previews.js";
import { projectsRoutes } from "./projects.js";
import { pullRequestsRoutes } from "./pullRequests.js";
import { reviewsRoutes } from "./reviews.js";
import { seedsRoutes } from "./seeds.js";
import { servicesRoutes } from "./services.js";
import { streamsRoutes } from "./streams.js";
import { teamsRoutes } from "./teams.js";
import { tokensRoutes } from "./tokens.js";
import { webhooksRoutes } from "./webhooks.js";

import type { FastifyInstance } from "fastify";

/**
 * Register all application routes onto the instance.
 *
 * @param app - The Fastify instance (already decorated by the platform plugins).
 */
export async function registerRoutes(app: FastifyInstance): Promise<void> {
  // Root, unauthenticated liveness/readiness probes.
  await app.register(healthRoutes);

  await app.register(
    async (v1) => {
      // ── Public group (signature- or credential-issuing routes) ────────────
      await v1.register(async (pub) => {
        await pub.register(authRoutes);
        await pub.register(webhooksRoutes);
      });

      // ── Authenticated group ───────────────────────────────────────────────
      await v1.register(async (secure) => {
        secure.addHook("onRequest", secure.requireAuth);

        await secure.register(meRoutes);
        await secure.register(teamsRoutes);
        await secure.register(projectsRoutes);
        await secure.register(pullRequestsRoutes);
        await secure.register(previewsRoutes);
        await secure.register(deploymentsRoutes);
        await secure.register(buildsRoutes);
        await secure.register(servicesRoutes);
        await secure.register(envVarsRoutes);
        await secure.register(seedsRoutes);
        await secure.register(reviewsRoutes);
        await secure.register(costsRoutes);
        await secure.register(auditRoutes);
        await secure.register(tokensRoutes);
        await secure.register(notificationsRoutes);
        await secure.register(streamsRoutes);
      });
    },
    { prefix: "/api/v1" },
  );
}
