/**
 * Serializers and response schemas for the previews router.
 *
 * Co-located with `routes/previews.ts` to keep the router lean while honouring
 * the serializer convention (`lib/serialize.ts`): response DTO zod schemas
 * model dates as `z.string()` (ISO-8601) and Decimals as `z.number()`, and
 * handlers return the DTOs produced here — never raw Prisma rows. We never leak
 * internal columns (e.g. service `containerId` is kept, but env/secret values
 * are owned by other routers and never embedded in a preview).
 *
 * @module
 */

import { z } from "zod";

import {
  DeploymentStatusSchema,
  DeploymentTriggerSchema,
  previewStatusDisplay,
  PreviewStatusSchema,
  PullRequestStateSchema,
  ServiceStatusSchema,
  ServiceTypeSchema,
} from "@shipyard/core";

import { iso } from "../lib/serialize.js";

import type {
  Deployment,
  Preview,
  PullRequest,
  Service,
} from "@shipyard/db";

// ─────────────────────────────────────────────────────────────────────────────
// Row shapes (the Prisma `include`s used by the router, narrowed for the DTOs)
// ─────────────────────────────────────────────────────────────────────────────

/** A light project projection embedded in preview responses. */
interface LightProjectRow {
  id: string;
  name: string;
  slug: string;
  teamId: string;
}

/** The latest-deployment projection embedded in preview responses. */
type LatestDeploymentRow = Pick<
  Deployment,
  "id" | "status" | "trigger" | "queuedAt"
>;

/**
 * A `Preview` row as loaded for the list endpoint: light project, pull request,
 * a service count, and the single latest deployment.
 */
export type PreviewListRow = Preview & {
  project: LightProjectRow;
  pullRequest: PullRequest | null;
  _count: { services: number };
  deployments: LatestDeploymentRow[];
};

/**
 * A `Preview` row as loaded for the detail endpoint: everything in the list
 * row plus the full service list and a reviewer count.
 */
export type PreviewDetailRow = Preview & {
  project: LightProjectRow;
  pullRequest: PullRequest | null;
  services: Service[];
  _count: { services: number; reviews: number };
  deployments: LatestDeploymentRow[];
};

// ─────────────────────────────────────────────────────────────────────────────
// Response schemas
// ─────────────────────────────────────────────────────────────────────────────

/** Light project projection embedded in preview responses. */
const LightProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  teamId: z.string(),
});

/** Pull request projection embedded in preview responses. */
const PreviewPullRequestSchema = z.object({
  id: z.string(),
  number: z.number(),
  title: z.string(),
  authorLogin: z.string(),
  authorAvatar: z.string().nullable(),
  headRef: z.string(),
  baseRef: z.string(),
  headSha: z.string(),
  state: PullRequestStateSchema,
  url: z.string(),
});

/** Latest-deployment projection embedded in preview responses. */
const LatestDeploymentSchema = z.object({
  id: z.string(),
  status: DeploymentStatusSchema,
  trigger: DeploymentTriggerSchema,
  queuedAt: z.string(),
});

/** Display metadata mirroring `@shipyard/core`'s `StatusDisplay`. */
const StatusDisplaySchema = z.object({
  label: z.string(),
  color: z.enum(["neutral", "info", "success", "warning", "danger"]),
  isActive: z.boolean(),
});

/** Response schema for a single {@link Service} DTO inside a preview. */
export const ServiceResponseSchema = z.object({
  id: z.string(),
  previewId: z.string(),
  name: z.string(),
  type: ServiceTypeSchema,
  image: z.string().nullable(),
  command: z.string().nullable(),
  internalHost: z.string().nullable(),
  ports: z.array(z.number()),
  status: ServiceStatusSchema,
  containerId: z.string().nullable(),
  healthPath: z.string().nullable(),
  restartCount: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

/**
 * Response schema for a preview list item: the core preview fields plus a light
 * project, optional pull request, a service count, the latest deployment, and
 * dashboard display metadata.
 */
export const PreviewResponseSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  pullRequestId: z.string().nullable(),
  name: z.string(),
  slug: z.string(),
  status: PreviewStatusSchema,
  statusDisplay: StatusDisplaySchema,
  url: z.string().nullable(),
  commitSha: z.string().nullable(),
  branch: z.string().nullable(),
  isPinned: z.boolean(),
  autoStopMinutes: z.number(),
  lastActivityAt: z.string(),
  expiresAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  destroyedAt: z.string().nullable(),
  serviceCount: z.number(),
  latestDeploymentStatus: DeploymentStatusSchema.nullable(),
  project: LightProjectSchema,
  pullRequest: PreviewPullRequestSchema.nullable(),
  latestDeployment: LatestDeploymentSchema.nullable(),
});

/**
 * Response schema for a single preview (detail view): the list shape plus the
 * full service list and a reviewer count.
 */
export const PreviewDetailResponseSchema = PreviewResponseSchema.extend({
  services: z.array(ServiceResponseSchema),
  reviewerCount: z.number(),
});

// ─────────────────────────────────────────────────────────────────────────────
// DTO types
// ─────────────────────────────────────────────────────────────────────────────

/** Wire shape of a {@link Service} embedded in a preview. */
export type ServiceDto = z.infer<typeof ServiceResponseSchema>;
/** Wire shape of a preview list item. */
export type PreviewDto = z.infer<typeof PreviewResponseSchema>;
/** Wire shape of a preview detail view. */
export type PreviewDetailDto = z.infer<typeof PreviewDetailResponseSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Serializers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Serialize a {@link Service} row into its DTO (dates → ISO strings).
 *
 * @param service - A Prisma `Service` row.
 * @returns The {@link ServiceDto}.
 */
export function toServiceDto(service: Service): ServiceDto {
  return {
    id: service.id,
    previewId: service.previewId,
    name: service.name,
    type: service.type,
    image: service.image,
    command: service.command,
    internalHost: service.internalHost,
    ports: service.ports,
    status: service.status,
    containerId: service.containerId,
    healthPath: service.healthPath,
    restartCount: service.restartCount,
    createdAt: service.createdAt.toISOString(),
    updatedAt: service.updatedAt.toISOString(),
  };
}

/** Serialize the embedded pull request projection (or null). */
function toPullRequestDto(
  pr: PullRequest | null,
): PreviewDto["pullRequest"] {
  if (!pr) return null;
  return {
    id: pr.id,
    number: pr.number,
    title: pr.title,
    authorLogin: pr.authorLogin,
    authorAvatar: pr.authorAvatar,
    headRef: pr.headRef,
    baseRef: pr.baseRef,
    headSha: pr.headSha,
    state: pr.state,
    url: pr.url,
  };
}

/** Serialize the embedded latest-deployment projection (or null). */
function toLatestDeploymentDto(
  deployments: LatestDeploymentRow[],
): PreviewDto["latestDeployment"] {
  const latest = deployments[0];
  if (!latest) return null;
  return {
    id: latest.id,
    status: latest.status,
    trigger: latest.trigger,
    queuedAt: latest.queuedAt.toISOString(),
  };
}

/**
 * Serialize a preview list row into its DTO: core fields, light project,
 * optional PR, service count, latest-deployment status, and display metadata.
 *
 * @param row - A {@link PreviewListRow}.
 * @returns The {@link PreviewDto}.
 */
export function toPreviewDto(row: PreviewListRow): PreviewDto {
  const latestDeployment = toLatestDeploymentDto(row.deployments);
  return {
    id: row.id,
    projectId: row.projectId,
    pullRequestId: row.pullRequestId,
    name: row.name,
    slug: row.slug,
    status: row.status,
    statusDisplay: previewStatusDisplay(row.status),
    url: row.url,
    commitSha: row.commitSha,
    branch: row.branch,
    isPinned: row.isPinned,
    autoStopMinutes: row.autoStopMinutes,
    lastActivityAt: row.lastActivityAt.toISOString(),
    expiresAt: iso(row.expiresAt),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    destroyedAt: iso(row.destroyedAt),
    serviceCount: row._count.services,
    latestDeploymentStatus: latestDeployment?.status ?? null,
    project: {
      id: row.project.id,
      name: row.project.name,
      slug: row.project.slug,
      teamId: row.project.teamId,
    },
    pullRequest: toPullRequestDto(row.pullRequest),
    latestDeployment,
  };
}

/**
 * Serialize a preview detail row into its DTO: the list shape plus the full
 * service list and a reviewer count.
 *
 * @param row - A {@link PreviewDetailRow}.
 * @returns The {@link PreviewDetailDto}.
 */
export function toPreviewDetailDto(row: PreviewDetailRow): PreviewDetailDto {
  return {
    ...toPreviewDto(row),
    services: row.services.map(toServiceDto),
    reviewerCount: row._count.reviews,
  };
}
