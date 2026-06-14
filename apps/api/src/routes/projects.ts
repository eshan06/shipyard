/**
 * Projects router.
 *
 * A {@link Project} is a connected source repository owned by a team; previews,
 * env vars, and seed templates all hang off it. This router implements the
 * project lifecycle CRUD, following the canonical pattern in `routes/teams.ts`:
 *
 *   schema validation (zod from core) → auth (`app.requireAuth`, applied
 *   globally) → RBAC (`lib/rbac`, team resolved via `project.teamId`) → Prisma →
 *   serialize (`lib/serialize`) → audit (`lib/audit`).
 *
 * Endpoints (mounted under `/api/v1` with `app.requireAuth`):
 *  - `GET    /projects`      list projects across the caller's teams (paginated;
 *                            optional `?teamId` filter) — VIEWER scope.
 *  - `POST   /projects`      create a project on a team (ADMIN).
 *  - `GET    /projects/:id`  read a project (VIEWER on its team).
 *  - `PATCH  /projects/:id`  update a project, incl. archive/unarchive (ADMIN).
 *  - `DELETE /projects/:id`  delete a project (OWNER).
 *
 * `GET/POST /projects/:id/env` and `/projects/:id/seeds` are owned by the
 * `envVars` and `seeds` routers respectively and are intentionally absent here.
 *
 * @module
 */

import { z } from "zod";

import {
  ConflictError,
  NotFoundError,
  PaginationQuerySchema,
  ProjectCreateSchema,
  ProjectUpdateSchema,
} from "@shipyard/core";
import { Prisma } from "@shipyard/db";

import { writeAudit } from "../lib/audit.js";
import { paginate } from "../lib/pagination.js";
import { requireTeamRole, teamIdForProject } from "../lib/rbac.js";
import { iso } from "../lib/serialize.js";

import { ErrorResponseSchema, listResponse } from "./schemas.js";

import type { Project } from "@shipyard/db";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";

/** Path-params schema for the `:id` routes. */
const ProjectParamsSchema = z.object({ id: z.string().min(1) });

/**
 * Querystring for `GET /projects`: standard pagination plus an optional
 * `teamId` to scope the listing to a single team.
 */
const ProjectListQuerySchema = PaginationQuerySchema.extend({
  /** Restrict results to a single team the caller belongs to. */
  teamId: z.string().min(1).optional(),
});

/**
 * Response schema for a single {@link Project} DTO. Dates are ISO strings and
 * `config` is an opaque JSON object passed through verbatim.
 */
const ProjectResponseSchema = z.object({
  id: z.string(),
  teamId: z.string(),
  name: z.string(),
  slug: z.string(),
  provider: z.string(),
  repoFullName: z.string(),
  repoId: z.string().nullable(),
  installationId: z.string().nullable(),
  defaultBranch: z.string(),
  framework: z.string().nullable(),
  rootDirectory: z.string(),
  config: z.record(z.string(), z.unknown()),
  autoDeployPrs: z.boolean(),
  autoStopMinutes: z.number(),
  destroyTtlMinutes: z.number(),
  isArchived: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

/** The wire shape of a {@link Project}. Dates are ISO strings. */
type ProjectDto = z.infer<typeof ProjectResponseSchema>;

/**
 * Serialize a {@link Project} row into its public DTO. The `config` JSON column
 * is passed through as-is and dates are normalised to ISO strings.
 *
 * @param project - A Prisma `Project` row.
 * @returns The {@link ProjectDto}.
 */
function toProjectDto(project: Project): ProjectDto {
  return {
    id: project.id,
    teamId: project.teamId,
    name: project.name,
    slug: project.slug,
    provider: project.provider,
    repoFullName: project.repoFullName,
    repoId: project.repoId,
    installationId: project.installationId,
    defaultBranch: project.defaultBranch,
    framework: project.framework,
    rootDirectory: project.rootDirectory,
    // `config` is a free-form JSON object; pass through verbatim.
    config: (project.config ?? {}) as Record<string, unknown>,
    autoDeployPrs: project.autoDeployPrs,
    autoStopMinutes: project.autoStopMinutes,
    destroyTtlMinutes: project.destroyTtlMinutes,
    isArchived: project.isArchived,
    createdAt: iso(project.createdAt)!,
    updatedAt: iso(project.updatedAt)!,
  };
}

/**
 * The projects router. Mounted under `/api/v1` with `app.requireAuth`.
 *
 * @param app - The Fastify instance (zod type provider).
 */
export const projectsRoutes: FastifyPluginAsyncZod = async (app) => {
  // ── List projects across the caller's teams ───────────────────────────────
  app.get(
    "/projects",
    {
      schema: {
        tags: ["projects"],
        summary: "List projects across the caller's teams (optional teamId)",
        querystring: ProjectListQuerySchema,
        response: {
          200: listResponse(ProjectResponseSchema),
          401: ErrorResponseSchema,
          403: ErrorResponseSchema,
        },
      },
    },
    async (request) => {
      const userId = request.auth!.userId;
      const { cursor, limit, order, teamId } = request.query;

      // When a specific team is requested, surface a clean 403 for non-members
      // (and a 404-via-empty list is avoided). Without a teamId, the
      // membership-scoped `where` naturally limits visibility to the caller's
      // own teams.
      if (teamId !== undefined) {
        await requireTeamRole(app, request, teamId, "VIEWER");
      }

      const where: Prisma.ProjectWhereInput =
        teamId !== undefined
          ? { teamId }
          : { team: { members: { some: { userId } } } };

      const page = await paginate(app.prisma.project, {
        cursor,
        limit,
        order,
        where,
      });

      return {
        data: page.data.map(toProjectDto),
        nextCursor: page.nextCursor,
      };
    },
  );

  // ── Create a project on a team (ADMIN) ────────────────────────────────────
  app.post(
    "/projects",
    {
      schema: {
        tags: ["projects"],
        summary: "Create a project (requires ADMIN on the target team)",
        body: ProjectCreateSchema,
        response: {
          201: ProjectResponseSchema,
          401: ErrorResponseSchema,
          403: ErrorResponseSchema,
          409: ErrorResponseSchema,
          422: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const userId = request.auth!.userId;
      const body = request.body;

      // Creating a project is a team-settings action → ADMIN.
      await requireTeamRole(app, request, body.teamId, "ADMIN");

      let project;
      try {
        project = await app.prisma.project.create({
          data: {
            teamId: body.teamId,
            name: body.name,
            slug: body.slug,
            provider: body.provider,
            repoFullName: body.repoFullName,
            repoId: body.repoId,
            installationId: body.installationId,
            defaultBranch: body.defaultBranch,
            framework: body.framework,
            rootDirectory: body.rootDirectory,
            config: body.config as Prisma.InputJsonValue,
            autoDeployPrs: body.autoDeployPrs,
            autoStopMinutes: body.autoStopMinutes,
            destroyTtlMinutes: body.destroyTtlMinutes,
          },
        });
      } catch (err) {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === "P2002"
        ) {
          // Either the (teamId, slug) or (provider, repoFullName) uniqueness.
          throw new ConflictError(
            `A project with slug "${body.slug}" or repo "${body.repoFullName}" already exists in this team`,
          );
        }
        throw err;
      }

      await writeAudit(app.prisma, {
        teamId: project.teamId,
        actorId: userId,
        action: "project.create",
        targetType: "Project",
        targetId: project.id,
        metadata: {
          name: project.name,
          slug: project.slug,
          repoFullName: project.repoFullName,
        },
      });

      reply.status(201);
      return toProjectDto(project);
    },
  );

  // ── Read a project (VIEWER) ───────────────────────────────────────────────
  app.get(
    "/projects/:id",
    {
      schema: {
        tags: ["projects"],
        summary: "Get a project by id",
        params: ProjectParamsSchema,
        response: {
          200: ProjectResponseSchema,
          401: ErrorResponseSchema,
          403: ErrorResponseSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    async (request) => {
      const { id } = request.params;
      // Resolve the owning team (404 if the project is unknown), then authorise.
      const teamId = await teamIdForProject(app.prisma, id);
      await requireTeamRole(app, request, teamId, "VIEWER");

      const project = await app.prisma.project.findUnique({ where: { id } });
      if (!project) throw new NotFoundError("Project", id);
      return toProjectDto(project);
    },
  );

  // ── Update a project, incl. archive/unarchive (ADMIN) ─────────────────────
  app.patch(
    "/projects/:id",
    {
      schema: {
        tags: ["projects"],
        summary: "Update a project (supports archive via isArchived)",
        params: ProjectParamsSchema,
        body: ProjectUpdateSchema,
        response: {
          200: ProjectResponseSchema,
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
      const teamId = await teamIdForProject(app.prisma, id);
      await requireTeamRole(app, request, teamId, "ADMIN");

      const body = request.body;
      const data: Prisma.ProjectUpdateInput = {};
      if (body.name !== undefined) data.name = body.name;
      if (body.slug !== undefined) data.slug = body.slug;
      if (body.provider !== undefined) data.provider = body.provider;
      if (body.repoFullName !== undefined) data.repoFullName = body.repoFullName;
      if (body.repoId !== undefined) data.repoId = body.repoId;
      if (body.installationId !== undefined) {
        data.installationId = body.installationId;
      }
      if (body.defaultBranch !== undefined) {
        data.defaultBranch = body.defaultBranch;
      }
      if (body.framework !== undefined) data.framework = body.framework;
      if (body.rootDirectory !== undefined) {
        data.rootDirectory = body.rootDirectory;
      }
      if (body.config !== undefined) {
        data.config = body.config as Prisma.InputJsonValue;
      }
      if (body.autoDeployPrs !== undefined) {
        data.autoDeployPrs = body.autoDeployPrs;
      }
      if (body.autoStopMinutes !== undefined) {
        data.autoStopMinutes = body.autoStopMinutes;
      }
      if (body.destroyTtlMinutes !== undefined) {
        data.destroyTtlMinutes = body.destroyTtlMinutes;
      }
      if (body.isArchived !== undefined) data.isArchived = body.isArchived;

      let project;
      try {
        project = await app.prisma.project.update({ where: { id }, data });
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError) {
          if (err.code === "P2025") throw new NotFoundError("Project", id);
          if (err.code === "P2002") {
            throw new ConflictError(
              `A project with slug "${body.slug}" or repo "${body.repoFullName}" already exists in this team`,
            );
          }
        }
        throw err;
      }

      await writeAudit(app.prisma, {
        teamId: project.teamId,
        actorId: request.auth!.userId,
        action: "project.update",
        targetType: "Project",
        targetId: project.id,
        metadata: { fields: Object.keys(data) },
      });

      return toProjectDto(project);
    },
  );

  // ── Delete a project (OWNER) ──────────────────────────────────────────────
  app.delete(
    "/projects/:id",
    {
      schema: {
        tags: ["projects"],
        summary: "Delete a project",
        params: ProjectParamsSchema,
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
      const teamId = await teamIdForProject(app.prisma, id);
      await requireTeamRole(app, request, teamId, "OWNER");

      try {
        await app.prisma.project.delete({ where: { id } });
      } catch (err) {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === "P2025"
        ) {
          throw new NotFoundError("Project", id);
        }
        throw err;
      }

      await writeAudit(app.prisma, {
        teamId,
        actorId: request.auth!.userId,
        action: "project.delete",
        targetType: "Project",
        targetId: id,
      });

      reply.status(204);
      return null;
    },
  );
};
