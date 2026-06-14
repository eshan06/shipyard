/**
 * Services router.
 *
 * Surfaces the {@link Service} containers that make up a preview environment
 * (web, api, worker, database, cache, …) so the dashboard can render each
 * service's health/status, exposed ports, and restart count.
 *
 * Follows `routes/teams.ts`: schema (zod) → auth (`app.requireAuth`, applied
 * globally) → RBAC (`teamIdForPreview` + `requireTeamRole`) → Prisma →
 * serialize. Reads require the `VIEWER` role on the owning team.
 *
 * Endpoints:
 *  - `GET /previews/:id/services`  list a preview's services (paginated)
 *
 * @module
 */

import { z } from "zod";

import { PaginationQuerySchema } from "@shipyard/core";

import { paginate } from "../lib/pagination.js";
import { requireTeamRole, teamIdForPreview } from "../lib/rbac.js";

import { ErrorResponseSchema, listResponse } from "./schemas.js";
import { ServiceResponseSchema, toServiceDto } from "./services.serialize.js";

import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";

/** Path-params schema for the nested `/previews/:id/services` route. */
const PreviewParamsSchema = z.object({ id: z.string().min(1) });

/**
 * The services router. Mounted under `/api/v1` with `app.requireAuth`.
 *
 * @param app - The Fastify instance (zod type provider).
 */
export const servicesRoutes: FastifyPluginAsyncZod = async (app) => {
  // ── List services inside a preview (VIEWER) ───────────────────────────────
  app.get(
    "/previews/:id/services",
    {
      schema: {
        tags: ["services"],
        summary: "List the services running inside a preview",
        params: PreviewParamsSchema,
        querystring: PaginationQuerySchema,
        response: {
          200: listResponse(ServiceResponseSchema),
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
      // read access before exposing any of its services.
      const teamId = await teamIdForPreview(app.prisma, previewId);
      await requireTeamRole(app, request, teamId, "VIEWER");

      const page = await paginate(app.prisma.service, {
        cursor,
        limit,
        order,
        where: { previewId },
      });

      return {
        data: page.data.map(toServiceDto),
        nextCursor: page.nextCursor,
      };
    },
  );
};
