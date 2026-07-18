/**
 * Previews router.
 *
 * Owns the preview-environment lifecycle endpoints. A *preview* is the live,
 * disposable full-stack environment for a branch/PR; this router lists and
 * reads previews, lets a member create/update/redeploy/stop/destroy/pin them,
 * and enqueues the corresponding background jobs (`deploy`/`destroy`) for the
 * worker to fulfil.
 *
 * Follows the canonical `routes/teams.ts` pipeline: zod schema validation
 * (schemas from `@shipyard/core`) → `app.requireAuth` (applied globally in
 * `routes/index.ts`) → RBAC (`lib/rbac` via `teamIdForPreview`/`teamIdForProject`)
 * → Prisma → serialize (local `toPreviewDto`/`toServiceDto`) → audit
 * (`lib/audit`). Mounted under `/api/v1`.
 *
 * Endpoints:
 *  - `GET    /previews`              list (filter `?projectId`/`?status`, paginated; VIEWER on the project)
 *  - `GET    /previews/:id`          read one (VIEWER)
 *  - `POST   /previews`              create a manual preview + enqueue deploy (MEMBER)
 *  - `PATCH  /previews/:id`          update settings (MEMBER)
 *  - `POST   /previews/:id/redeploy` re-deploy current commit (MEMBER)
 *  - `POST   /previews/:id/stop`     manual stop → idle teardown (MEMBER)
 *  - `POST   /previews/:id/destroy`  permanent teardown (ADMIN)
 *  - `POST   /previews/:id/pin`      toggle pin (MEMBER)
 *
 * Sibling concerns — `:id/env`, `:id/services`, `:id/reviews`, `:id/costs`,
 * `:id/logs` — are owned by other routers and intentionally not implemented here.
 *
 * @module
 */

import { z } from "zod";

import {
  ConflictError,
  NotFoundError,
  PaginationQuerySchema,
  PreviewCreateSchema,
  PreviewStatusSchema,
  PreviewUpdateSchema,
  slugifyBranch,
} from "@shipyard/core";
import { Prisma } from "@shipyard/db";

import { writeAudit } from "../lib/audit.js";
import { paginate, type PaginatableDelegate } from "../lib/pagination.js";
import {
  callerTeamScope,
  requireTeamRole,
  teamIdForPreview,
  teamIdForProject,
} from "../lib/rbac.js";
import { requireScope } from "../lib/scopes.js";

import {
  PreviewDetailResponseSchema,
  PreviewResponseSchema,
  toPreviewDetailDto,
  toPreviewDto,
  type PreviewDetailRow,
  type PreviewListRow,
} from "./previews.serialize.js";
import { ErrorResponseSchema, listResponse } from "./schemas.js";

import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";

/** Path-params schema for the `:id` routes. */
const PreviewParamsSchema = z.object({ id: z.string().min(1) });

/**
 * Query schema for `GET /previews`: pagination plus optional `projectId` and
 * `status` filters.
 */
const PreviewListQuerySchema = PaginationQuerySchema.extend({
  /** Restrict the listing to a single project. */
  projectId: z.string().min(1).optional(),
  /** Restrict the listing to a single preview status. */
  status: PreviewStatusSchema.optional(),
});

/** Body schema for `POST /previews/:id/pin` (explicit desired pin state). */
const PinBodySchema = z.object({ pinned: z.boolean() });

/**
 * Prisma `include` for list rows: a light project, the pull request, a count of
 * services, and the single most-recent deployment (for its status).
 */
const LIST_INCLUDE = {
  project: { select: { id: true, name: true, slug: true, teamId: true } },
  pullRequest: true,
  _count: { select: { services: true } },
  deployments: {
    orderBy: { queuedAt: "desc" },
    take: 1,
    select: { id: true, status: true, trigger: true, queuedAt: true },
  },
} as const satisfies Prisma.PreviewInclude;

/**
 * Prisma `include` for the detail row: the project, pull request, all services,
 * a reviewer count, and the latest deployment.
 */
const DETAIL_INCLUDE = {
  project: { select: { id: true, name: true, slug: true, teamId: true } },
  pullRequest: true,
  services: { orderBy: { createdAt: "asc" } },
  _count: { select: { services: true, reviews: true } },
  deployments: {
    orderBy: { queuedAt: "desc" },
    take: 1,
    select: { id: true, status: true, trigger: true, queuedAt: true },
  },
} as const satisfies Prisma.PreviewInclude;

/**
 * The previews router. Mounted under `/api/v1` with `app.requireAuth`.
 *
 * @param app - The Fastify instance (zod type provider).
 */
export const previewsRoutes: FastifyPluginAsyncZod = async (app) => {
  // ── List previews (paginated, filterable) ─────────────────────────────────
  app.get(
    "/previews",
    {
      preHandler: requireScope("previews:read"),
      schema: {
        tags: ["previews"],
        summary: "List previews (filter by project/status; paginated)",
        querystring: PreviewListQuerySchema,
        response: {
          200: listResponse(PreviewResponseSchema),
          401: ErrorResponseSchema,
          403: ErrorResponseSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    async (request) => {
      const userId = request.auth!.userId;
      const { cursor, limit, order, projectId, status } = request.query;

      // Scope to teams the caller belongs to. When a project filter is given we
      // additionally require VIEWER on that project's team (and surface 404 for
      // an unknown project / 403 for a non-member); otherwise we constrain the
      // query to previews under any team the caller is a member of.
      const where: Prisma.PreviewWhereInput = {};
      if (projectId !== undefined) {
        const teamId = await teamIdForProject(app.prisma, projectId);
        await requireTeamRole(app, request, teamId, "VIEWER");
        where.projectId = projectId;
      } else {
        // A team-scoped API token may only see previews under its own team.
        const tokenTeamId = callerTeamScope(request);
        where.project = tokenTeamId
          ? { teamId: tokenTeamId, team: { members: { some: { userId } } } }
          : { team: { members: { some: { userId } } } };
      }
      if (status !== undefined) where.status = status;

      const page = await paginate<PreviewListRow>(
        app.prisma.preview as unknown as PaginatableDelegate<PreviewListRow>,
        { cursor, limit, order, where, include: LIST_INCLUDE },
      );

      return {
        data: page.data.map(toPreviewDto),
        nextCursor: page.nextCursor,
      };
    },
  );

  // ── Read one preview (VIEWER) ─────────────────────────────────────────────
  app.get(
    "/previews/:id",
    {
      preHandler: requireScope("previews:read"),
      schema: {
        tags: ["previews"],
        summary: "Get a preview by id",
        params: PreviewParamsSchema,
        response: {
          200: PreviewDetailResponseSchema,
          401: ErrorResponseSchema,
          403: ErrorResponseSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    async (request) => {
      const { id } = request.params;
      const teamId = await teamIdForPreview(app.prisma, id);
      await requireTeamRole(app, request, teamId, "VIEWER");

      const preview = (await app.prisma.preview.findUnique({
        where: { id },
        include: DETAIL_INCLUDE,
      })) as PreviewDetailRow | null;
      if (!preview) throw new NotFoundError("Preview", id);

      return toPreviewDetailDto(preview);
    },
  );

  // ── Create a manual preview (MEMBER) ──────────────────────────────────────
  app.post(
    "/previews",
    {
      preHandler: requireScope("previews:write"),
      schema: {
        tags: ["previews"],
        summary: "Create a manual preview and enqueue its first deploy",
        body: PreviewCreateSchema,
        response: {
          201: PreviewDetailResponseSchema,
          401: ErrorResponseSchema,
          403: ErrorResponseSchema,
          404: ErrorResponseSchema,
          409: ErrorResponseSchema,
          422: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const userId = request.auth!.userId;
      const {
        projectId,
        pullRequestId,
        name,
        slug,
        commitSha,
        branch,
        isPinned,
        autoStopMinutes,
      } = request.body;

      const teamId = await teamIdForProject(app.prisma, projectId);
      await requireTeamRole(app, request, teamId, "MEMBER");

      // Derive a DNS-safe slug from the branch when one was not supplied. A
      // collision suffix is always appended, so this is unique in practice.
      const resolvedSlug =
        slug ?? slugifyBranch(branch ?? name ?? "preview");

      // Create the preview and its first QUEUED deployment atomically; the
      // worker fulfils the deployment (build → start → RUNNING) off the queue.
      let created;
      try {
        created = await app.prisma.$transaction(async (tx) => {
          const preview = await tx.preview.create({
            data: {
              projectId,
              pullRequestId: pullRequestId ?? null,
              name,
              slug: resolvedSlug,
              status: "QUEUED",
              commitSha: commitSha ?? null,
              branch: branch ?? null,
              isPinned,
              autoStopMinutes,
            },
          });
          const deployment = await tx.deployment.create({
            data: {
              previewId: preview.id,
              // commitSha is required on a Deployment; fall back to a sentinel
              // when the caller did not pin a sha (the worker resolves HEAD).
              commitSha: commitSha ?? "HEAD",
              trigger: "MANUAL",
              status: "QUEUED",
              createdById: userId,
            },
          });
          return { preview, deployment };
        });
      } catch (err) {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === "P2002"
        ) {
          throw new ConflictError(
            `A preview with slug "${resolvedSlug}" already exists`,
          );
        }
        throw err;
      }

      await app.queues.enqueueDeploy({
        deploymentId: created.deployment.id,
        previewId: created.preview.id,
        projectId,
        commitSha: created.deployment.commitSha,
        trigger: "MANUAL",
      });

      await writeAudit(app.prisma, {
        teamId,
        actorId: userId,
        action: "preview.create",
        targetType: "Preview",
        targetId: created.preview.id,
        metadata: {
          projectId,
          slug: created.preview.slug,
          deploymentId: created.deployment.id,
          trigger: "MANUAL",
        },
      });

      const full = (await app.prisma.preview.findUnique({
        where: { id: created.preview.id },
        include: DETAIL_INCLUDE,
      })) as PreviewDetailRow | null;
      if (!full) throw new NotFoundError("Preview", created.preview.id);

      reply.status(201);
      return toPreviewDetailDto(full);
    },
  );

  // ── Update preview settings (MEMBER) ──────────────────────────────────────
  app.patch(
    "/previews/:id",
    {
      preHandler: requireScope("previews:write"),
      schema: {
        tags: ["previews"],
        summary: "Update a preview's settings",
        params: PreviewParamsSchema,
        body: PreviewUpdateSchema,
        response: {
          200: PreviewDetailResponseSchema,
          401: ErrorResponseSchema,
          403: ErrorResponseSchema,
          404: ErrorResponseSchema,
          422: ErrorResponseSchema,
        },
      },
    },
    async (request) => {
      const { id } = request.params;
      const teamId = await teamIdForPreview(app.prisma, id);
      await requireTeamRole(app, request, teamId, "MEMBER");

      const body = request.body;
      const data: Prisma.PreviewUpdateInput = {};
      if (body.name !== undefined) data.name = body.name;
      if (body.isPinned !== undefined) data.isPinned = body.isPinned;
      if (body.autoStopMinutes !== undefined) {
        data.autoStopMinutes = body.autoStopMinutes;
      }

      try {
        await app.prisma.preview.update({ where: { id }, data });
      } catch (err) {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === "P2025"
        ) {
          throw new NotFoundError("Preview", id);
        }
        throw err;
      }

      await writeAudit(app.prisma, {
        teamId,
        actorId: request.auth!.userId,
        action: "preview.update",
        targetType: "Preview",
        targetId: id,
        metadata: { fields: Object.keys(data) },
      });

      const full = (await app.prisma.preview.findUnique({
        where: { id },
        include: DETAIL_INCLUDE,
      })) as PreviewDetailRow | null;
      if (!full) throw new NotFoundError("Preview", id);
      return toPreviewDetailDto(full);
    },
  );

  // ── Redeploy a preview (MEMBER) ───────────────────────────────────────────
  app.post(
    "/previews/:id/redeploy",
    {
      preHandler: requireScope("previews:write"),
      schema: {
        tags: ["previews"],
        summary: "Re-deploy a preview (new QUEUED deployment)",
        params: PreviewParamsSchema,
        response: {
          202: PreviewDetailResponseSchema,
          401: ErrorResponseSchema,
          403: ErrorResponseSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const teamId = await teamIdForPreview(app.prisma, id);
      await requireTeamRole(app, request, teamId, "MEMBER");

      const preview = await app.prisma.preview.findUnique({
        where: { id },
        select: { id: true, projectId: true, commitSha: true },
      });
      if (!preview) throw new NotFoundError("Preview", id);

      const deployment = await app.prisma.deployment.create({
        data: {
          previewId: preview.id,
          commitSha: preview.commitSha ?? "HEAD",
          trigger: "REDEPLOY",
          status: "QUEUED",
          createdById: request.auth!.userId,
        },
      });

      await app.queues.enqueueDeploy({
        deploymentId: deployment.id,
        previewId: preview.id,
        projectId: preview.projectId,
        commitSha: deployment.commitSha,
        trigger: "REDEPLOY",
      });

      await writeAudit(app.prisma, {
        teamId,
        actorId: request.auth!.userId,
        action: "preview.redeploy",
        targetType: "Preview",
        targetId: preview.id,
        metadata: { deploymentId: deployment.id, trigger: "REDEPLOY" },
      });

      const full = (await app.prisma.preview.findUnique({
        where: { id },
        include: DETAIL_INCLUDE,
      })) as PreviewDetailRow | null;
      if (!full) throw new NotFoundError("Preview", id);

      reply.status(202);
      return toPreviewDetailDto(full);
    },
  );

  // ── Stop a preview (MEMBER) ───────────────────────────────────────────────
  app.post(
    "/previews/:id/stop",
    {
      preHandler: requireScope("previews:write"),
      schema: {
        tags: ["previews"],
        summary: "Stop a running preview (manual stop)",
        params: PreviewParamsSchema,
        response: {
          202: PreviewDetailResponseSchema,
          401: ErrorResponseSchema,
          403: ErrorResponseSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const teamId = await teamIdForPreview(app.prisma, id);
      await requireTeamRole(app, request, teamId, "MEMBER");

      const preview = await app.prisma.preview.findUnique({
        where: { id },
        select: { id: true },
      });
      if (!preview) throw new NotFoundError("Preview", id);

      // Manual-stop path: enqueue a destroy with reason `idle`. The worker maps
      // reason `idle` → `STOPPED` (resources torn down but the row preserved so
      // it can be re-queued), whereas `manual`/`pr_closed`/`ttl` → `DESTROYED`.
      await app.queues.enqueueDestroy({ previewId: preview.id, reason: "idle" });

      await writeAudit(app.prisma, {
        teamId,
        actorId: request.auth!.userId,
        action: "preview.stop",
        targetType: "Preview",
        targetId: preview.id,
        metadata: { reason: "idle" },
      });

      const full = (await app.prisma.preview.findUnique({
        where: { id },
        include: DETAIL_INCLUDE,
      })) as PreviewDetailRow | null;
      if (!full) throw new NotFoundError("Preview", id);

      reply.status(202);
      return toPreviewDetailDto(full);
    },
  );

  // ── Destroy a preview (ADMIN) ─────────────────────────────────────────────
  app.post(
    "/previews/:id/destroy",
    {
      preHandler: requireScope("previews:write"),
      schema: {
        tags: ["previews"],
        summary: "Permanently destroy a preview",
        params: PreviewParamsSchema,
        response: {
          202: PreviewDetailResponseSchema,
          401: ErrorResponseSchema,
          403: ErrorResponseSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const teamId = await teamIdForPreview(app.prisma, id);
      await requireTeamRole(app, request, teamId, "ADMIN");

      const preview = await app.prisma.preview.findUnique({
        where: { id },
        select: { id: true },
      });
      if (!preview) throw new NotFoundError("Preview", id);

      // Permanent teardown: the worker maps reason `manual` → `DESTROYED`.
      await app.queues.enqueueDestroy({
        previewId: preview.id,
        reason: "manual",
      });

      await writeAudit(app.prisma, {
        teamId,
        actorId: request.auth!.userId,
        action: "preview.destroy",
        targetType: "Preview",
        targetId: preview.id,
        metadata: { reason: "manual" },
      });

      const full = (await app.prisma.preview.findUnique({
        where: { id },
        include: DETAIL_INCLUDE,
      })) as PreviewDetailRow | null;
      if (!full) throw new NotFoundError("Preview", id);

      reply.status(202);
      return toPreviewDetailDto(full);
    },
  );

  // ── Pin / unpin a preview (MEMBER) ────────────────────────────────────────
  app.post(
    "/previews/:id/pin",
    {
      preHandler: requireScope("previews:write"),
      schema: {
        tags: ["previews"],
        summary: "Pin or unpin a preview (skips auto-stop/destroy when pinned)",
        params: PreviewParamsSchema,
        body: PinBodySchema,
        response: {
          200: PreviewDetailResponseSchema,
          401: ErrorResponseSchema,
          403: ErrorResponseSchema,
          404: ErrorResponseSchema,
          422: ErrorResponseSchema,
        },
      },
    },
    async (request) => {
      const { id } = request.params;
      const { pinned } = request.body;
      const teamId = await teamIdForPreview(app.prisma, id);
      await requireTeamRole(app, request, teamId, "MEMBER");

      try {
        await app.prisma.preview.update({
          where: { id },
          data: { isPinned: pinned },
        });
      } catch (err) {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === "P2025"
        ) {
          throw new NotFoundError("Preview", id);
        }
        throw err;
      }

      await writeAudit(app.prisma, {
        teamId,
        actorId: request.auth!.userId,
        action: pinned ? "preview.pin" : "preview.unpin",
        targetType: "Preview",
        targetId: id,
        metadata: { pinned },
      });

      const full = (await app.prisma.preview.findUnique({
        where: { id },
        include: DETAIL_INCLUDE,
      })) as PreviewDetailRow | null;
      if (!full) throw new NotFoundError("Preview", id);
      return toPreviewDetailDto(full);
    },
  );
};
