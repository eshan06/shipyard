/**
 * Deployments router.
 *
 * Owns the read + cancel surface for deployments (the build/start unit of work
 * a preview goes through for a given commit):
 *
 *  - `GET    /deployments`            list deployments (paginated; filter by
 *                                     `previewId` / `status`; each row carries a
 *                                     build summary)
 *  - `GET    /deployments/:id`        read one (VIEWER) incl. its build + a
 *                                     lightweight preview reference
 *  - `POST   /deployments/:id/cancel` cancel an in-flight deployment (MEMBER);
 *                                     also cancels its in-flight build
 *
 * (Live `GET /deployments/:id/logs` SSE lives in `routes/streams.ts`.)
 *
 * Follows the canonical `routes/teams.ts` pipeline: zod schema (from
 * `@shipyard/core`) → `app.requireAuth` (applied globally) → RBAC
 * (`lib/rbac`) → Prisma → serialize → audit (`lib/audit`).
 *
 * @module
 */

import { z } from "zod";

import {
  BuildStatusSchema,
  ConflictError,
  DeploymentStatusSchema,
  DeploymentTriggerSchema,
  NotFoundError,
  PaginationQuerySchema,
  canTransitionDeployment,
} from "@shipyard/core";

import { writeAudit } from "../lib/audit.js";
import { paginate } from "../lib/pagination.js";
import {
  callerTeamScope,
  requireTeamRole,
  teamIdForDeployment,
  teamIdForPreview,
} from "../lib/rbac.js";
import { iso } from "../lib/serialize.js";

import { ErrorResponseSchema, listResponse } from "./schemas.js";

import type {
  Build,
  BuildStatus,
  Deployment,
  DeploymentStatus,
} from "@shipyard/db";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";

// ─────────────────────────────────────────────────────────────────────────────
// Serializers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The wire shape of a {@link Build}. Dates are ISO strings; `errorSummary` is
 * surfaced so the dashboard can explain failed builds.
 */
export interface BuildDto {
  id: string;
  deploymentId: string;
  status: BuildStatus;
  imageTag: string | null;
  cacheHit: boolean;
  exitCode: number | null;
  errorSummary: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  durationMs: number | null;
}

/**
 * Serialize a {@link Build} row into its public DTO.
 *
 * @param build - A Prisma `Build` row.
 * @returns The {@link BuildDto}.
 */
export function toBuildDto(build: Build): BuildDto {
  return {
    id: build.id,
    deploymentId: build.deploymentId,
    status: build.status,
    imageTag: build.imageTag,
    cacheHit: build.cacheHit,
    exitCode: build.exitCode,
    errorSummary: build.errorSummary,
    startedAt: iso(build.startedAt),
    finishedAt: iso(build.finishedAt),
    durationMs: build.durationMs,
  };
}

/** A lightweight reference to the preview a deployment targets. */
export interface DeploymentPreviewRef {
  id: string;
  slug: string;
  name: string;
}

/**
 * The wire shape of a {@link Deployment}. Dates are ISO strings. Optionally
 * embeds its {@link BuildDto} and a {@link DeploymentPreviewRef} when those
 * relations were loaded.
 */
export interface DeploymentDto {
  id: string;
  previewId: string;
  commitSha: string;
  trigger: Deployment["trigger"];
  status: DeploymentStatus;
  createdById: string | null;
  queuedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  durationMs: number | null;
  errorSummary: string | null;
  build?: BuildDto | null;
  preview?: DeploymentPreviewRef;
}

/**
 * Serialize a {@link Deployment} row into its public DTO, embedding the build
 * and/or preview reference when those relations were included on the row.
 *
 * @param deployment - A Prisma `Deployment` row, optionally with `build` and a
 *   `preview` selection (`{ id, slug, name }`).
 * @returns The {@link DeploymentDto}.
 */
export function toDeploymentDto(
  deployment: Deployment & {
    build?: Build | null;
    preview?: { id: string; slug: string; name: string };
  },
): DeploymentDto {
  return {
    id: deployment.id,
    previewId: deployment.previewId,
    commitSha: deployment.commitSha,
    trigger: deployment.trigger,
    status: deployment.status,
    createdById: deployment.createdById,
    queuedAt: deployment.queuedAt.toISOString(),
    startedAt: iso(deployment.startedAt),
    finishedAt: iso(deployment.finishedAt),
    durationMs: deployment.durationMs,
    errorSummary: deployment.errorSummary,
    ...(deployment.build !== undefined
      ? { build: deployment.build ? toBuildDto(deployment.build) : null }
      : {}),
    ...(deployment.preview
      ? {
          preview: {
            id: deployment.preview.id,
            slug: deployment.preview.slug,
            name: deployment.preview.name,
          },
        }
      : {}),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Response schemas (dates as ISO strings, Decimals as numbers per convention)
// ─────────────────────────────────────────────────────────────────────────────

/** Response schema for a single {@link Build} DTO. */
export const BuildResponseSchema = z.object({
  id: z.string(),
  deploymentId: z.string(),
  status: BuildStatusSchema,
  imageTag: z.string().nullable(),
  cacheHit: z.boolean(),
  exitCode: z.number().nullable(),
  errorSummary: z.string().nullable(),
  startedAt: z.string().nullable(),
  finishedAt: z.string().nullable(),
  durationMs: z.number().nullable(),
});

/** Lightweight preview reference embedded in a deployment DTO. */
const DeploymentPreviewRefSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
});

/** Response schema for a single {@link Deployment} DTO. */
const DeploymentResponseSchema = z.object({
  id: z.string(),
  previewId: z.string(),
  commitSha: z.string(),
  trigger: DeploymentTriggerSchema,
  status: DeploymentStatusSchema,
  createdById: z.string().nullable(),
  queuedAt: z.string(),
  startedAt: z.string().nullable(),
  finishedAt: z.string().nullable(),
  durationMs: z.number().nullable(),
  errorSummary: z.string().nullable(),
  build: BuildResponseSchema.nullable().optional(),
  preview: DeploymentPreviewRefSchema.optional(),
});

/** Query schema for `GET /deployments`: pagination plus optional filters. */
const DeploymentListQuerySchema = PaginationQuerySchema.extend({
  /** Only deployments belonging to this preview. */
  previewId: z.string().min(1).optional(),
  /** Only deployments in this lifecycle status. */
  status: DeploymentStatusSchema.optional(),
});

/** Path-params schema for the `:id` routes. */
const DeploymentParamsSchema = z.object({ id: z.string().min(1) });

// ─────────────────────────────────────────────────────────────────────────────
// Router
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The deployments router. Mounted under `/api/v1` with `app.requireAuth`.
 *
 * @param app - The Fastify instance (zod type provider).
 */
export const deploymentsRoutes: FastifyPluginAsyncZod = async (app) => {
  // ── List deployments (paginated; filter by previewId/status) ──────────────
  app.get(
    "/deployments",
    {
      schema: {
        tags: ["deployments"],
        summary: "List deployments the caller can see (paginated)",
        querystring: DeploymentListQuerySchema,
        response: {
          200: listResponse(DeploymentResponseSchema),
          401: ErrorResponseSchema,
          // Returned when an explicit `previewId` filter names a preview the
          // caller cannot access (non-member) or that does not exist.
          403: ErrorResponseSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    async (request) => {
      const userId = request.auth!.userId;
      const { cursor, limit, order, previewId, status } = request.query;

      // When an explicit previewId filter is given, resolve its owning team and
      // assert membership up front (mirroring previews/pull-requests list), so a
      // non-member gets a clean 403/404 rather than an ambiguous empty page.
      if (previewId) {
        const teamId = await teamIdForPreview(app.prisma, previewId);
        await requireTeamRole(app, request, teamId, "VIEWER");
      }

      // Scope to deployments whose owning team the caller is a member of, then
      // apply the optional filters. A team-scoped API token is further confined
      // to its own team. Include a build summary on each row.
      const tokenTeamId = callerTeamScope(request);
      const where = {
        preview: {
          ...(previewId ? { id: previewId } : {}),
          project: {
            ...(tokenTeamId ? { teamId: tokenTeamId } : {}),
            team: { members: { some: { userId } } },
          },
        },
        ...(status ? { status } : {}),
      };

      const page = await paginate(app.prisma.deployment, {
        cursor,
        limit,
        order,
        where,
        // Deployment has no `createdAt`; order by its queue time instead.
        orderBy: [{ queuedAt: order }, { id: order }],
      });

      // The cursor pagination helper does not project includes, so load the
      // builds + a lightweight preview reference for this page in one query each
      // and stitch them in.
      const builds =
        page.data.length === 0
          ? []
          : await app.prisma.build.findMany({
              where: { deploymentId: { in: page.data.map((d) => d.id) } },
            });
      const buildByDeployment = new Map(builds.map((b) => [b.deploymentId, b]));

      const previews =
        page.data.length === 0
          ? []
          : await app.prisma.preview.findMany({
              where: { id: { in: page.data.map((d) => d.previewId) } },
              select: { id: true, slug: true, name: true },
            });
      const previewById = new Map(previews.map((p) => [p.id, p]));

      return {
        data: page.data.map((deployment) =>
          toDeploymentDto({
            ...deployment,
            build: buildByDeployment.get(deployment.id) ?? null,
            preview: previewById.get(deployment.previewId),
          }),
        ),
        nextCursor: page.nextCursor,
      };
    },
  );

  // ── Read a deployment (VIEWER) incl. build + preview ref ──────────────────
  app.get(
    "/deployments/:id",
    {
      schema: {
        tags: ["deployments"],
        summary: "Get a deployment by id (incl. build and preview reference)",
        params: DeploymentParamsSchema,
        response: {
          200: DeploymentResponseSchema,
          401: ErrorResponseSchema,
          403: ErrorResponseSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    async (request) => {
      const { id } = request.params;

      // teamIdForDeployment throws NotFoundError when the deployment is absent.
      const teamId = await teamIdForDeployment(app.prisma, id);
      await requireTeamRole(app, request, teamId, "VIEWER");

      const deployment = await app.prisma.deployment.findUnique({
        where: { id },
        include: {
          build: true,
          preview: { select: { id: true, slug: true, name: true } },
        },
      });
      if (!deployment) throw new NotFoundError("Deployment", id);

      return toDeploymentDto(deployment);
    },
  );

  // ── Cancel an in-flight deployment (MEMBER) ───────────────────────────────
  app.post(
    "/deployments/:id/cancel",
    {
      schema: {
        tags: ["deployments"],
        summary: "Cancel an in-flight deployment (and its build)",
        params: DeploymentParamsSchema,
        response: {
          200: DeploymentResponseSchema,
          401: ErrorResponseSchema,
          403: ErrorResponseSchema,
          404: ErrorResponseSchema,
          409: ErrorResponseSchema,
        },
      },
    },
    async (request) => {
      const { id } = request.params;

      const teamId = await teamIdForDeployment(app.prisma, id);
      await requireTeamRole(app, request, teamId, "MEMBER");

      const existing = await app.prisma.deployment.findUnique({
        where: { id },
        include: { build: true },
      });
      if (!existing) throw new NotFoundError("Deployment", id);

      // Only in-flight deployments are cancellable; the core state machine is
      // the single source of truth for what transitions are legal.
      if (!canTransitionDeployment(existing.status, "CANCELLED")) {
        throw new ConflictError(
          `A deployment in status ${existing.status} cannot be cancelled`,
        );
      }

      // Cancel the deployment and, when present and still in-flight, its build
      // atomically. The worker observes CANCELLED status to abort its work.
      const cancellableBuild =
        existing.build && isBuildCancellable(existing.build.status)
          ? existing.build
          : null;

      const finishedAt = new Date();
      // The deployment.update carries the `include: { build }` used to build the
      // response DTO. When a build is also being cancelled, it MUST be flipped
      // first so the deployment's included build snapshot reflects the cancelled
      // status; Prisma runs an array transaction sequentially, so ordering the
      // build update before the deployment update keeps the response consistent
      // with persisted state.
      const cancelDeployment = app.prisma.deployment.update({
        where: { id },
        data: { status: "CANCELLED", finishedAt },
        include: {
          build: true,
          preview: { select: { id: true, slug: true, name: true } },
        },
      });
      const deployment = cancellableBuild
        ? (
            await app.prisma.$transaction([
              app.prisma.build.update({
                where: { id: cancellableBuild.id },
                data: { status: "CANCELLED", finishedAt },
              }),
              cancelDeployment,
            ])
          )[1]
        : await cancelDeployment;

      await writeAudit(app.prisma, {
        teamId,
        actorId: request.auth!.userId,
        action: "deployment.cancel",
        targetType: "Deployment",
        targetId: id,
        metadata: {
          previousStatus: existing.status,
          buildCancelled: cancellableBuild !== null,
        },
      });

      return toDeploymentDto(deployment);
    },
  );
};

/**
 * Whether a build in `status` is still in-flight and therefore cancellable.
 *
 * @param status - The build's current status.
 * @returns `true` when the build is `PENDING` or `RUNNING`.
 */
function isBuildCancellable(status: BuildStatus): boolean {
  const parsed = BuildStatusSchema.parse(status);
  return parsed === "PENDING" || parsed === "RUNNING";
}
