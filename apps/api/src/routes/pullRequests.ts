/**
 * Pull-requests router.
 *
 * Surfaces the pull requests Shipyard tracks for connected projects. PRs are
 * read-only here (they are created/updated by the webhook ingestion path), so
 * this router exposes only list + detail endpoints. Both are team-scoped reads
 * (VIEWER) resolved via the PR's owning project's team.
 *
 * Pipeline mirrors `routes/teams.ts`:
 *   schema (zod from core) → auth (`app.requireAuth`, applied globally) →
 *   RBAC (`lib/rbac`) → Prisma → serialize → response.
 *
 * Endpoints:
 *  - `GET /pull-requests`      list tracked PRs (filter `?projectId` `?state`,
 *                              paginated, VIEWER on the project's team).
 *  - `GET /pull-requests/:id`  read one PR with a previews summary (VIEWER).
 *
 * @module
 */

import { z } from "zod";

import {
  NotFoundError,
  PaginationQuerySchema,
  PreviewStatusSchema,
  PullRequestStateSchema,
} from "@shipyard/core";

import { requireTeamRole, teamIdForProject } from "../lib/rbac.js";

import {
  toPullRequestDto,
  toPullRequestWithPreviewsDto,
  type PullRequestRow,
  type PullRequestWithPreviewsRow,
} from "./pullRequests.serialize.js";
import { ErrorResponseSchema, listResponse } from "./schemas.js";

import type { Prisma } from "@shipyard/db";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";

/** A single embedded preview summary line on a PR. */
const PreviewSummarySchema = z.object({
  id: z.string(),
  slug: z.string(),
  status: PreviewStatusSchema,
  url: z.string().nullable(),
  createdAt: z.string(),
});

/** Response schema for a single tracked pull request (list element). */
const PullRequestResponseSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  number: z.number(),
  title: z.string(),
  authorLogin: z.string(),
  authorAvatar: z.string().nullable(),
  headRef: z.string(),
  baseRef: z.string(),
  headSha: z.string(),
  state: PullRequestStateSchema,
  url: z.string(),
  labels: z.array(z.string()),
  previewCount: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

/** Response schema for a PR detail (adds a `previews` summary array). */
const PullRequestDetailResponseSchema = PullRequestResponseSchema.extend({
  previews: z.array(PreviewSummarySchema),
});

/** Query schema for `GET /pull-requests` (pagination + optional filters). */
const PullRequestListQuerySchema = PaginationQuerySchema.extend({
  /** Restrict to a single project (its team becomes the RBAC scope). */
  projectId: z.string().min(1).optional(),
  /** Restrict to PRs in a given state. */
  state: PullRequestStateSchema.optional(),
});

/** Path-params schema for the `:id` route. */
const PullRequestParamsSchema = z.object({ id: z.string().min(1) });

/**
 * The pull-requests router. Mounted under `/api/v1` with `app.requireAuth`.
 *
 * @param app - The Fastify instance (zod type provider).
 */
export const pullRequestsRoutes: FastifyPluginAsyncZod = async (app) => {
  // ── List tracked pull requests ────────────────────────────────────────────
  app.get(
    "/pull-requests",
    {
      schema: {
        tags: ["pull-requests"],
        summary: "List tracked pull requests",
        querystring: PullRequestListQuerySchema,
        response: {
          200: listResponse(PullRequestResponseSchema),
          401: ErrorResponseSchema,
          403: ErrorResponseSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    async (request) => {
      const userId = request.auth!.userId;
      const { cursor, limit, order, projectId, state } = request.query;

      // Scope the query to teams the caller can read. When a project filter is
      // supplied we resolve its team and require VIEWER directly; otherwise we
      // implicitly scope to every team the caller belongs to.
      const where: Prisma.PullRequestWhereInput = {};
      if (projectId !== undefined) {
        const teamId = await teamIdForProject(app.prisma, projectId);
        await requireTeamRole(app, request, teamId, "VIEWER");
        where.projectId = projectId;
      } else {
        where.project = { team: { members: { some: { userId } } } };
      }
      if (state !== undefined) where.state = state;

      // Take N+1 to detect a following page; include the preview count.
      const rows = (await app.prisma.pullRequest.findMany({
        where,
        orderBy: [{ createdAt: order }, { id: order }],
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        include: { _count: { select: { previews: true } } },
      })) as PullRequestRow[];

      const hasMore = rows.length > limit;
      const data = (hasMore ? rows.slice(0, limit) : rows).map(
        toPullRequestDto,
      );
      const nextCursor = hasMore ? (rows[limit]?.id ?? null) : null;

      return { data, nextCursor };
    },
  );

  // ── Read one pull request (with previews summary) ─────────────────────────
  app.get(
    "/pull-requests/:id",
    {
      schema: {
        tags: ["pull-requests"],
        summary: "Get a pull request by id",
        params: PullRequestParamsSchema,
        response: {
          200: PullRequestDetailResponseSchema,
          401: ErrorResponseSchema,
          403: ErrorResponseSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    async (request) => {
      const { id } = request.params;

      const pr = (await app.prisma.pullRequest.findUnique({
        where: { id },
        include: {
          _count: { select: { previews: true } },
          previews: {
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            select: {
              id: true,
              slug: true,
              status: true,
              url: true,
              createdAt: true,
            },
          },
        },
      })) as PullRequestWithPreviewsRow | null;

      if (!pr) throw new NotFoundError("PullRequest", id);

      // Authorize via the owning project's team.
      const teamId = await teamIdForProject(app.prisma, pr.projectId);
      await requireTeamRole(app, request, teamId, "VIEWER");

      return toPullRequestWithPreviewsDto(pr);
    },
  );
};
