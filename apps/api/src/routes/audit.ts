/**
 * Audit router.
 *
 * Exposes the team-scoped audit log written by `lib/audit.writeAudit`. Reading
 * an audit log is a team read (VIEWER): when a `?teamId` is supplied we require
 * VIEWER on exactly that team; when it is omitted we default to every team the
 * caller belongs to (so the dashboard can show a cross-team activity feed).
 *
 * Pipeline mirrors `routes/teams.ts`:
 *   schema (zod from core) → auth (`app.requireAuth`, applied globally) →
 *   RBAC (`lib/rbac`) → Prisma → serialize → response.
 *
 * Endpoints:
 *  - `GET /audit`  list audit entries (`?teamId` optional, paginated, VIEWER).
 *
 * @module
 */

import { z } from "zod";

import { PaginationQuerySchema } from "@shipyard/core";

import { requireTeamRole } from "../lib/rbac.js";

import {
  toAuditLogDto,
  type AuditLogRow,
} from "./audit.serialize.js";
import { ErrorResponseSchema, listResponse } from "./schemas.js";

import type { Prisma } from "@shipyard/db";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";

/** Response schema for a single audit-log DTO. */
const AuditLogResponseSchema = z.object({
  id: z.string(),
  teamId: z.string().nullable(),
  actorId: z.string().nullable(),
  actorLogin: z.string().nullable(),
  action: z.string(),
  targetType: z.string().nullable(),
  targetId: z.string().nullable(),
  metadata: z.unknown(),
  createdAt: z.string(),
});

/** Query schema for `GET /audit` (pagination + optional team filter). */
const AuditListQuerySchema = PaginationQuerySchema.extend({
  /**
   * Restrict to a single team's audit log. When omitted, the response covers
   * every team the caller is a member of.
   */
  teamId: z.string().min(1).optional(),
});

/**
 * The audit router. Mounted under `/api/v1` with `app.requireAuth`.
 *
 * @param app - The Fastify instance (zod type provider).
 */
export const auditRoutes: FastifyPluginAsyncZod = async (app) => {
  // ── List audit-log entries ────────────────────────────────────────────────
  app.get(
    "/audit",
    {
      schema: {
        tags: ["audit"],
        summary: "List audit-log entries for a team (or all the caller's teams)",
        querystring: AuditListQuerySchema,
        response: {
          200: listResponse(AuditLogResponseSchema),
          401: ErrorResponseSchema,
          403: ErrorResponseSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    async (request) => {
      const userId = request.auth!.userId;
      const { cursor, limit, order, teamId } = request.query;

      // Scope the query. A specific team requires VIEWER on that team; omitting
      // it defaults to the union of teams the caller belongs to.
      const where: Prisma.AuditLogWhereInput = {};
      if (teamId !== undefined) {
        await requireTeamRole(app, request, teamId, "VIEWER");
        where.teamId = teamId;
      } else {
        where.team = { members: { some: { userId } } };
      }

      // Take N+1 to detect a following page; join the actor's login only (we
      // never leak the rest of the user record into the audit DTO).
      const rows = (await app.prisma.auditLog.findMany({
        where,
        orderBy: [{ createdAt: order }, { id: order }],
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        include: { actor: { select: { githubLogin: true } } },
      })) as AuditLogRow[];

      const hasMore = rows.length > limit;
      const data = (hasMore ? rows.slice(0, limit) : rows).map(toAuditLogDto);
      const nextCursor = hasMore ? (rows[limit]?.id ?? null) : null;

      return { data, nextCursor };
    },
  );
};
