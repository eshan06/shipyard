/**
 * Teams router — the CANONICAL reference router.
 *
 * Every feature agent should copy this file's shape. It demonstrates the full
 * request pipeline expected of every authenticated, team-scoped router:
 *
 *   schema validation (zod from core) → auth (`app.requireAuth`) →
 *   RBAC (`lib/rbac`) → Prisma → serialize (`lib/serialize`) → audit (`lib/audit`)
 *
 * with proper zod response schemas so the OpenAPI spec is complete. Mounted
 * under `/api/v1` with `app.requireAuth` applied (see `routes/index.ts`).
 *
 * Endpoints:
 *  - `GET    /teams`      list teams the caller belongs to (paginated)
 *  - `POST   /teams`      create a team (creator becomes OWNER)
 *  - `GET    /teams/:id`  read a team (VIEWER)
 *  - `PATCH  /teams/:id`  update a team (ADMIN)
 *  - `DELETE /teams/:id`  delete a team (OWNER)
 *
 * @module
 */

import { z } from "zod";

import {
  ConflictError,
  NotFoundError,
  PaginationQuerySchema,
  TeamCreateSchema,
  TeamUpdateSchema,
} from "@shipyard/core";
import { Prisma } from "@shipyard/db";

import { writeAudit } from "../lib/audit.js";
import { paginate } from "../lib/pagination.js";
import { callerTeamScope, requireTeamRole } from "../lib/rbac.js";
import { requireScope } from "../lib/scopes.js";
import { toTeamDto } from "../lib/serialize.js";

import {
  ErrorResponseSchema,
  TeamResponseSchema,
  listResponse,
} from "./schemas.js";

import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";

/** Path-params schema for the `:id` routes. */
const TeamParamsSchema = z.object({ id: z.string().min(1) });

/**
 * The teams router.
 *
 * @param app - The Fastify instance (zod type provider).
 */
export const teamsRoutes: FastifyPluginAsyncZod = async (app) => {
  // ── List teams the caller is a member of ──────────────────────────────────
  app.get(
    "/teams",
    {
      preHandler: requireScope("teams:read"),
      schema: {
        tags: ["teams"],
        summary: "List teams the caller is a member of",
        querystring: PaginationQuerySchema,
        response: {
          200: listResponse(TeamResponseSchema),
          401: ErrorResponseSchema,
        },
      },
    },
    async (request) => {
      // request.auth is guaranteed non-null by app.requireAuth.
      const userId = request.auth!.userId;
      const { cursor, limit, order } = request.query;

      // A team-scoped API token may only see its own team.
      const tokenTeamId = callerTeamScope(request);
      const where = tokenTeamId
        ? { id: tokenTeamId, members: { some: { userId } } }
        : { members: { some: { userId } } };

      const page = await paginate(app.prisma.team, {
        cursor,
        limit,
        order,
        where,
      });

      return {
        data: page.data.map(toTeamDto),
        nextCursor: page.nextCursor,
      };
    },
  );

  // ── Create a team (creator becomes OWNER) ─────────────────────────────────
  app.post(
    "/teams",
    {
      preHandler: requireScope("teams:write"),
      schema: {
        tags: ["teams"],
        summary: "Create a team (creator becomes OWNER)",
        body: TeamCreateSchema,
        response: {
          201: TeamResponseSchema,
          401: ErrorResponseSchema,
          409: ErrorResponseSchema,
          422: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const userId = request.auth!.userId;
      const { name, slug, avatarUrl, budgetUsdMonthly } = request.body;

      // Create the team and the creator's OWNER membership atomically.
      let team;
      try {
        team = await app.prisma.team.create({
          data: {
            name,
            slug,
            avatarUrl,
            budgetUsdMonthly:
              budgetUsdMonthly === undefined
                ? null
                : new Prisma.Decimal(budgetUsdMonthly),
            members: { create: { userId, role: "OWNER" } },
          },
        });
      } catch (err) {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === "P2002"
        ) {
          throw new ConflictError(`A team with slug "${slug}" already exists`);
        }
        throw err;
      }

      await writeAudit(app.prisma, {
        teamId: team.id,
        actorId: userId,
        action: "team.create",
        targetType: "Team",
        targetId: team.id,
        metadata: { name: team.name, slug: team.slug },
      });

      reply.status(201);
      return toTeamDto(team);
    },
  );

  // ── Read a team (VIEWER) ──────────────────────────────────────────────────
  app.get(
    "/teams/:id",
    {
      preHandler: requireScope("teams:read"),
      schema: {
        tags: ["teams"],
        summary: "Get a team by id",
        params: TeamParamsSchema,
        response: {
          200: TeamResponseSchema,
          401: ErrorResponseSchema,
          403: ErrorResponseSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    async (request) => {
      const { id } = request.params;
      await requireTeamRole(app, request, id, "VIEWER");

      const team = await app.prisma.team.findUnique({ where: { id } });
      if (!team) throw new NotFoundError("Team", id);
      return toTeamDto(team);
    },
  );

  // ── Update a team (ADMIN) ─────────────────────────────────────────────────
  app.patch(
    "/teams/:id",
    {
      preHandler: requireScope("teams:write"),
      schema: {
        tags: ["teams"],
        summary: "Update a team",
        params: TeamParamsSchema,
        body: TeamUpdateSchema,
        response: {
          200: TeamResponseSchema,
          401: ErrorResponseSchema,
          403: ErrorResponseSchema,
          404: ErrorResponseSchema,
          422: ErrorResponseSchema,
        },
      },
    },
    async (request) => {
      const { id } = request.params;
      await requireTeamRole(app, request, id, "ADMIN");

      const body = request.body;
      const data: Prisma.TeamUpdateInput = {};
      if (body.name !== undefined) data.name = body.name;
      if (body.slug !== undefined) data.slug = body.slug;
      if (body.avatarUrl !== undefined) data.avatarUrl = body.avatarUrl;
      if (body.budgetUsdMonthly !== undefined) {
        data.budgetUsdMonthly = new Prisma.Decimal(body.budgetUsdMonthly);
      }

      let team;
      try {
        team = await app.prisma.team.update({ where: { id }, data });
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError) {
          if (err.code === "P2025") throw new NotFoundError("Team", id);
          if (err.code === "P2002") {
            throw new ConflictError(
              `A team with slug "${body.slug}" already exists`,
            );
          }
        }
        throw err;
      }

      await writeAudit(app.prisma, {
        teamId: team.id,
        actorId: request.auth!.userId,
        action: "team.update",
        targetType: "Team",
        targetId: team.id,
        metadata: { fields: Object.keys(data) },
      });

      return toTeamDto(team);
    },
  );

  // ── Delete a team (OWNER) ─────────────────────────────────────────────────
  app.delete(
    "/teams/:id",
    {
      preHandler: requireScope("teams:write"),
      schema: {
        tags: ["teams"],
        summary: "Delete a team",
        params: TeamParamsSchema,
        response: {
          204: z.null(),
          401: ErrorResponseSchema,
          403: ErrorResponseSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      await requireTeamRole(app, request, id, "OWNER");

      try {
        await app.prisma.team.delete({ where: { id } });
      } catch (err) {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === "P2025"
        ) {
          throw new NotFoundError("Team", id);
        }
        throw err;
      }

      await writeAudit(app.prisma, {
        actorId: request.auth!.userId,
        action: "team.delete",
        targetType: "Team",
        targetId: id,
      });

      reply.status(204);
      return null;
    },
  );
};
