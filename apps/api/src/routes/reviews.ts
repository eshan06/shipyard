/**
 * Reviews router.
 *
 * Surfaces PR reviewer state for a preview on the dashboard (who has reviewed,
 * their avatar, and whether they approved / requested changes / are pending).
 *
 * Follows `routes/teams.ts`: schema (zod) → auth (`app.requireAuth`, applied
 * globally) → RBAC (`teamIdForPreview` + `requireTeamRole`) → Prisma →
 * serialize. Reads require the `VIEWER` role on the owning team.
 *
 * Endpoints:
 *  - `GET /previews/:id/reviews`  list a preview's reviews (paginated)
 *
 * @module
 */

import { z } from "zod";

import { PaginationQuerySchema } from "@shipyard/core";

import { paginate } from "../lib/pagination.js";
import { requireTeamRole, teamIdForPreview } from "../lib/rbac.js";

import { ReviewResponseSchema, toReviewDto } from "./reviews.serialize.js";
import { ErrorResponseSchema, listResponse } from "./schemas.js";

import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";

/** Path-params schema for the nested `/previews/:id/reviews` route. */
const PreviewParamsSchema = z.object({ id: z.string().min(1) });

/**
 * The reviews router. Mounted under `/api/v1` with `app.requireAuth`.
 *
 * @param app - The Fastify instance (zod type provider).
 */
export const reviewsRoutes: FastifyPluginAsyncZod = async (app) => {
  // ── List reviews for a preview (VIEWER) ───────────────────────────────────
  app.get(
    "/previews/:id/reviews",
    {
      schema: {
        tags: ["reviews"],
        summary: "List the PR reviews surfaced for a preview",
        params: PreviewParamsSchema,
        querystring: PaginationQuerySchema,
        response: {
          200: listResponse(ReviewResponseSchema),
          401: ErrorResponseSchema,
          403: ErrorResponseSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    async (request) => {
      const { id: previewId } = request.params;
      const { cursor, limit, order } = request.query;

      // Resolve the owning team (404s if the preview is missing) and enforce
      // read access before exposing its review state.
      const teamId = await teamIdForPreview(app.prisma, previewId);
      await requireTeamRole(app, request, teamId, "VIEWER");

      const page = await paginate(app.prisma.review, {
        cursor,
        limit,
        order,
        where: { previewId },
      });

      return {
        data: page.data.map(toReviewDto),
        nextCursor: page.nextCursor,
      };
    },
  );
};
