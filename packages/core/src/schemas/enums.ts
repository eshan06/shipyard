/**
 * Zod enums mirroring the Prisma domain enums in
 * `packages/db/prisma/schema.prisma`.
 *
 * These are the single source of truth for enum validation across the API and
 * worker. Each `z.enum` is paired with an inferred TypeScript type so callers
 * get both runtime validation and compile-time exhaustiveness. Keep the member
 * lists in lockstep with the Prisma schema.
 *
 * @module
 */

import { z } from "zod";

/** Lifecycle status of a {@link Preview}. */
export const PreviewStatusSchema = z.enum([
  "QUEUED",
  "BUILDING",
  "DEPLOYING",
  "RUNNING",
  "DEGRADED",
  "STOPPED",
  "FAILED",
  "DESTROYING",
  "DESTROYED",
]);
/** Inferred type for {@link PreviewStatusSchema}. */
export type PreviewStatus = z.infer<typeof PreviewStatusSchema>;

/** Lifecycle status of a {@link Deployment}. */
export const DeploymentStatusSchema = z.enum([
  "QUEUED",
  "BUILDING",
  "DEPLOYING",
  "SUCCEEDED",
  "FAILED",
  "CANCELLED",
]);
/** Inferred type for {@link DeploymentStatusSchema}. */
export type DeploymentStatus = z.infer<typeof DeploymentStatusSchema>;

/** Lifecycle status of an image Build. */
export const BuildStatusSchema = z.enum([
  "PENDING",
  "RUNNING",
  "SUCCEEDED",
  "FAILED",
  "CANCELLED",
]);
/** Inferred type for {@link BuildStatusSchema}. */
export type BuildStatus = z.infer<typeof BuildStatusSchema>;

/** Category of a service running inside a preview. */
export const ServiceTypeSchema = z.enum([
  "WEB",
  "API",
  "WORKER",
  "DATABASE",
  "CACHE",
  "CUSTOM",
]);
/** Inferred type for {@link ServiceTypeSchema}. */
export type ServiceType = z.infer<typeof ServiceTypeSchema>;

/** Runtime/health status of a service container. */
export const ServiceStatusSchema = z.enum([
  "PENDING",
  "STARTING",
  "HEALTHY",
  "UNHEALTHY",
  "STOPPED",
  "CRASHED",
]);
/** Inferred type for {@link ServiceStatusSchema}. */
export type ServiceStatus = z.infer<typeof ServiceStatusSchema>;

/** Scope an env var applies to (whole project vs. a single preview). */
export const EnvScopeSchema = z.enum(["PROJECT", "PREVIEW"]);
/** Inferred type for {@link EnvScopeSchema}. */
export type EnvScope = z.infer<typeof EnvScopeSchema>;

/** Build phase(s) an env var is injected into. */
export const EnvTargetSchema = z.enum(["BUILD", "RUNTIME", "BOTH"]);
/** Inferred type for {@link EnvTargetSchema}. */
export type EnvTarget = z.infer<typeof EnvTargetSchema>;

/** Reviewer state surfaced on the dashboard. */
export const ReviewStateSchema = z.enum([
  "PENDING",
  "APPROVED",
  "CHANGES_REQUESTED",
  "COMMENTED",
  "DISMISSED",
]);
/** Inferred type for {@link ReviewStateSchema}. */
export type ReviewState = z.infer<typeof ReviewStateSchema>;

/** What triggered a deployment. */
export const DeploymentTriggerSchema = z.enum([
  "PR_OPENED",
  "PR_SYNC",
  "MANUAL",
  "REDEPLOY",
  "ROLLBACK",
]);
/** Inferred type for {@link DeploymentTriggerSchema}. */
export type DeploymentTrigger = z.infer<typeof DeploymentTriggerSchema>;

/** Team membership role (drives RBAC). */
export const MembershipRoleSchema = z.enum([
  "OWNER",
  "ADMIN",
  "MEMBER",
  "VIEWER",
]);
/** Inferred type for {@link MembershipRoleSchema}. */
export type MembershipRole = z.infer<typeof MembershipRoleSchema>;

/** State of a tracked pull request. */
export const PullRequestStateSchema = z.enum([
  "OPEN",
  "CLOSED",
  "MERGED",
  "DRAFT",
]);
/** Inferred type for {@link PullRequestStateSchema}. */
export type PullRequestState = z.infer<typeof PullRequestStateSchema>;

/** Source-control provider for a project. */
export const RepoProviderSchema = z.enum(["GITHUB", "GITLAB", "BITBUCKET"]);
/** Inferred type for {@link RepoProviderSchema}. */
export type RepoProvider = z.infer<typeof RepoProviderSchema>;

/** Log severity level. */
export const LogLevelSchema = z.enum(["DEBUG", "INFO", "WARN", "ERROR"]);
/** Inferred type for {@link LogLevelSchema}. */
export type LogLevel = z.infer<typeof LogLevelSchema>;

/** Origin of a log chunk. */
export const LogSourceSchema = z.enum(["BUILD", "DEPLOY", "RUNTIME", "SYSTEM"]);
/** Inferred type for {@link LogSourceSchema}. */
export type LogSource = z.infer<typeof LogSourceSchema>;

/** Kind of seed template content. */
export const SeedKindSchema = z.enum(["SQL", "SCRIPT", "SNAPSHOT"]);
/** Inferred type for {@link SeedKindSchema}. */
export type SeedKind = z.infer<typeof SeedKindSchema>;

/** Idempotency processing status of an inbound webhook. */
export const WebhookStatusSchema = z.enum([
  "RECEIVED",
  "PROCESSED",
  "FAILED",
  "SKIPPED",
]);
/** Inferred type for {@link WebhookStatusSchema}. */
export type WebhookStatus = z.infer<typeof WebhookStatusSchema>;

/** Category of a user notification. */
export const NotificationTypeSchema = z.enum([
  "PREVIEW_READY",
  "BUILD_FAILED",
  "PREVIEW_STOPPED",
  "BUDGET_EXCEEDED",
  "REVIEW_REQUESTED",
]);
/** Inferred type for {@link NotificationTypeSchema}. */
export type NotificationType = z.infer<typeof NotificationTypeSchema>;
