/**
 * Seed-templates router.
 *
 * Seed templates describe how a fresh preview database is populated (inline
 * SQL, a script, or a snapshot reference). They belong to a project, so RBAC is
 * resolved through the owning team via `teamIdForProject`: reads require
 * `VIEWER`, writes require `MEMBER`.
 *
 * Mounted under `/api/v1` with `app.requireAuth` applied (see `routes/index.ts`).
 *
 * Endpoints:
 *  - `GET    /projects/:id/seeds`  list a project's seed templates (VIEWER)
 *  - `POST   /projects/:id/seeds`  create a seed template (MEMBER)
 *  - `PATCH  /seeds/:id`           update a seed template (MEMBER)
 *  - `DELETE /seeds/:id`           delete a seed template (MEMBER)
 *
 * Follows the canonical pattern in `routes/teams.ts`: schema (zod from core) →
 * auth → RBAC → Prisma → serialize → audit, mapping Prisma `P2002` →
 * `ConflictError` and `P2025` → `NotFoundError`.
 *
 * @module
 */

import { z } from "zod";

import {
  ConflictError,
  NotFoundError,
  PaginationQuerySchema,
  SeedTemplateCreateSchema,
  SeedTemplateUpdateSchema,
} from "@shipyard/core";
import { Prisma } from "@shipyard/db";

import { writeAudit } from "../lib/audit.js";
import { paginate } from "../lib/pagination.js";
import { requireTeamRole, teamIdForProject } from "../lib/rbac.js";
import { requireScope } from "../lib/scopes.js";

import { ErrorResponseSchema, listResponse } from "./schemas.js";
import {
  SeedTemplateResponseSchema,
  toSeedTemplateDto,
} from "./seeds.serialize.js";

import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";

/** Path-params schema for the `/projects/:id/seeds` routes. */
const ProjectParamsSchema = z.object({ id: z.string().min(1) });

/** Path-params schema for the `/seeds/:id` routes. */
const SeedParamsSchema = z.object({ id: z.string().min(1) });

/**
 * The seed-templates router.
 *
 * @param app - The Fastify instance (zod type provider).
 */
export const seedsRoutes: FastifyPluginAsyncZod = async (app) => {
  // ── List a project's seed templates (VIEWER) ──────────────────────────────
  app.get(
    "/projects/:id/seeds",
    {
      preHandler: requireScope("projects:read"),
      schema: {
        tags: ["seeds"],
        summary: "List a project's seed templates",
        params: ProjectParamsSchema,
        querystring: PaginationQuerySchema,
        response: {
          200: listResponse(SeedTemplateResponseSchema),
          401: ErrorResponseSchema,
          403: ErrorResponseSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    async (request) => {
      const { id: projectId } = request.params;
      const teamId = await teamIdForProject(app.prisma, projectId);
      await requireTeamRole(app, request, teamId, "VIEWER");

      const { cursor, limit, order } = request.query;
      const page = await paginate(app.prisma.seedTemplate, {
        cursor,
        limit,
        order,
        where: { projectId },
      });

      return {
        data: page.data.map(toSeedTemplateDto),
        nextCursor: page.nextCursor,
      };
    },
  );

  // ── Create a seed template (MEMBER) ───────────────────────────────────────
  app.post(
    "/projects/:id/seeds",
    {
      preHandler: requireScope("projects:write"),
      schema: {
        tags: ["seeds"],
        summary: "Create a seed template",
        params: ProjectParamsSchema,
        body: SeedTemplateCreateSchema,
        response: {
          201: SeedTemplateResponseSchema,
          401: ErrorResponseSchema,
          403: ErrorResponseSchema,
          404: ErrorResponseSchema,
          409: ErrorResponseSchema,
          422: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { id: projectId } = request.params;
      const teamId = await teamIdForProject(app.prisma, projectId);
      await requireTeamRole(app, request, teamId, "MEMBER");

      // The path's project id is authoritative; ignore any body.projectId.
      const { name, kind, source, isDefault } = request.body;

      let seed;
      try {
        // When this template is the new default, demote any existing default
        // for the project atomically so at most one default exists.
        seed = await app.prisma.$transaction(async (tx) => {
          if (isDefault) {
            await tx.seedTemplate.updateMany({
              where: { projectId, isDefault: true },
              data: { isDefault: false },
            });
          }
          return tx.seedTemplate.create({
            data: { projectId, name, kind, source, isDefault },
          });
        });
      } catch (err) {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === "P2002"
        ) {
          throw new ConflictError(
            `A seed template named "${name}" already exists for this project`,
          );
        }
        throw err;
      }

      await writeAudit(app.prisma, {
        teamId,
        actorId: request.auth!.userId,
        action: "seed.create",
        targetType: "SeedTemplate",
        targetId: seed.id,
        metadata: {
          projectId,
          name: seed.name,
          kind: seed.kind,
          isDefault: seed.isDefault,
        },
      });

      reply.status(201);
      return toSeedTemplateDto(seed);
    },
  );

  // ── Update a seed template (MEMBER) ───────────────────────────────────────
  app.patch(
    "/seeds/:id",
    {
      preHandler: requireScope("projects:write"),
      schema: {
        tags: ["seeds"],
        summary: "Update a seed template",
        params: SeedParamsSchema,
        body: SeedTemplateUpdateSchema,
        response: {
          200: SeedTemplateResponseSchema,
          401: ErrorResponseSchema,
          403: ErrorResponseSchema,
          404: ErrorResponseSchema,
          409: ErrorResponseSchema,
          422: ErrorResponseSchema,
        },
      },
    },
    async (request) => {
      const { id } = request.params;

      const existing = await app.prisma.seedTemplate.findUnique({
        where: { id },
        select: { id: true, projectId: true },
      });
      if (!existing) throw new NotFoundError("SeedTemplate", id);

      const teamId = await teamIdForProject(app.prisma, existing.projectId);
      await requireTeamRole(app, request, teamId, "MEMBER");

      const body = request.body;
      const data: Prisma.SeedTemplateUpdateInput = {};
      if (body.name !== undefined) data.name = body.name;
      if (body.kind !== undefined) data.kind = body.kind;
      if (body.source !== undefined) data.source = body.source;
      if (body.isDefault !== undefined) data.isDefault = body.isDefault;

      let seed;
      try {
        // Promoting this template to default demotes the project's previous
        // default in the same transaction.
        seed = await app.prisma.$transaction(async (tx) => {
          if (body.isDefault === true) {
            await tx.seedTemplate.updateMany({
              where: {
                projectId: existing.projectId,
                isDefault: true,
                id: { not: id },
              },
              data: { isDefault: false },
            });
          }
          return tx.seedTemplate.update({ where: { id }, data });
        });
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError) {
          if (err.code === "P2025") throw new NotFoundError("SeedTemplate", id);
          if (err.code === "P2002") {
            throw new ConflictError(
              `A seed template named "${body.name}" already exists for this project`,
            );
          }
        }
        throw err;
      }

      await writeAudit(app.prisma, {
        teamId,
        actorId: request.auth!.userId,
        action: "seed.update",
        targetType: "SeedTemplate",
        targetId: seed.id,
        metadata: { projectId: seed.projectId, fields: Object.keys(data) },
      });

      return toSeedTemplateDto(seed);
    },
  );

  // ── Delete a seed template (MEMBER) ───────────────────────────────────────
  app.delete(
    "/seeds/:id",
    {
      preHandler: requireScope("projects:write"),
      schema: {
        tags: ["seeds"],
        summary: "Delete a seed template",
        params: SeedParamsSchema,
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

      const existing = await app.prisma.seedTemplate.findUnique({
        where: { id },
        select: { id: true, projectId: true },
      });
      if (!existing) throw new NotFoundError("SeedTemplate", id);

      const teamId = await teamIdForProject(app.prisma, existing.projectId);
      await requireTeamRole(app, request, teamId, "MEMBER");

      try {
        await app.prisma.seedTemplate.delete({ where: { id } });
      } catch (err) {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === "P2025"
        ) {
          throw new NotFoundError("SeedTemplate", id);
        }
        throw err;
      }

      await writeAudit(app.prisma, {
        teamId,
        actorId: request.auth!.userId,
        action: "seed.delete",
        targetType: "SeedTemplate",
        targetId: id,
        metadata: { projectId: existing.projectId },
      });

      reply.status(204);
      return null;
    },
  );
};
