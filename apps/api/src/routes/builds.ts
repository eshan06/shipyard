/**
 * Builds router.
 *
 * Owns: `GET /builds/:id` — the detail view of a single image build, including
 * its parsed `errorSummary` for failed builds (a dashboard surface).
 *
 * Follows the canonical `routes/teams.ts` pipeline: `app.requireAuth` (applied
 * globally) → RBAC (`lib/rbac`) → Prisma → serialize. The owning team is
 * resolved by walking the build's deployment → preview → project, then
 * `requireTeamRole(..., "VIEWER")` authorises the read.
 *
 * The build DTO + response schema are defined alongside deployments (a build is
 * always a child of a deployment) and reused here.
 *
 * @module
 */

import { z } from "zod";

import { NotFoundError } from "@shipyard/core";

import { requireTeamRole } from "../lib/rbac.js";
import { requireScope } from "../lib/scopes.js";

import { BuildResponseSchema, toBuildDto } from "./deployments.js";
import { ErrorResponseSchema } from "./schemas.js";

import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";

/** Path-params schema for `GET /builds/:id`. */
const BuildParamsSchema = z.object({ id: z.string().min(1) });

/**
 * The builds router. Mounted under `/api/v1` with `app.requireAuth`.
 *
 * @param app - The Fastify instance (zod type provider).
 */
export const buildsRoutes: FastifyPluginAsyncZod = async (app) => {
  // ── Read a build (VIEWER) incl. failed-build error summary ────────────────
  app.get(
    "/builds/:id",
    {
      preHandler: requireScope("deployments:read"),
      schema: {
        tags: ["builds"],
        summary: "Get a build by id (incl. error summary for failed builds)",
        params: BuildParamsSchema,
        response: {
          200: BuildResponseSchema,
          401: ErrorResponseSchema,
          403: ErrorResponseSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    async (request) => {
      const { id } = request.params;

      // Resolve the owning team by walking build → deployment → preview →
      // project in a single query; do not disclose existence to non-members.
      const build = await app.prisma.build.findUnique({
        where: { id },
        include: {
          deployment: {
            select: {
              preview: { select: { project: { select: { teamId: true } } } },
            },
          },
        },
      });
      if (!build) throw new NotFoundError("Build", id);

      const teamId = build.deployment.preview.project.teamId;
      await requireTeamRole(app, request, teamId, "VIEWER");

      return toBuildDto(build);
    },
  );
};
