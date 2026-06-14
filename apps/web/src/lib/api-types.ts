/**
 * TypeScript interfaces mirroring the Shipyard API response DTOs.
 *
 * These mirror `apps/api/src/routes/**` serializers exactly: dates are ISO-8601
 * strings, Prisma `Decimal`s are numbers, and secret env var values are `null`.
 * Enum unions mirror `@shipyard/core` zod enums.
 *
 * @module
 */

import type {
  BuildStatus,
  DeploymentStatus,
  DeploymentTrigger,
  EnvScope,
  EnvTarget,
  MembershipRole,
  NotificationType,
  PreviewStatus,
  PullRequestState,
  ReviewState,
  SeedKind,
  ServiceStatus,
  ServiceType,
  StatusColorToken,
} from "@shipyard/core";

/** A cursor-paginated list envelope. */
export interface ListResponse<T> {
  data: T[];
  nextCursor: string | null;
}

/** The stable API error envelope (`@shipyard/core` `ErrorResponse`). */
export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    httpStatus: number;
    details?: unknown;
  };
}

/** Display metadata for a status, mirrored from `@shipyard/core` StatusDisplay. */
export interface StatusDisplay {
  label: string;
  color: StatusColorToken;
  isActive: boolean;
}

/** A Shipyard user. */
export interface User {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  githubLogin: string | null;
  isAdmin: boolean;
  createdAt: string;
  updatedAt: string;
}

/** A team (organization). */
export interface Team {
  id: string;
  name: string;
  slug: string;
  avatarUrl: string | null;
  budgetUsdMonthly: number | null;
  createdAt: string;
  updatedAt: string;
}

/** A user's membership in a team. */
export interface Membership {
  id: string;
  userId: string;
  teamId: string;
  role: MembershipRole;
  createdAt: string;
  team?: Team;
}

/** Response shape of `GET /me`. */
export interface MeResponse {
  user: User;
  memberships: Membership[];
}

/** A connected source-control project. */
export interface Project {
  id: string;
  teamId: string;
  name: string;
  slug: string;
  provider: string;
  repoFullName: string;
  repoId: string | null;
  installationId: string | null;
  defaultBranch: string;
  framework: string | null;
  rootDirectory: string;
  config: Record<string, unknown>;
  autoDeployPrs: boolean;
  autoStopMinutes: number;
  destroyTtlMinutes: number;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

/** A tracked pull request. */
export interface PullRequest {
  id: string;
  projectId: string;
  number: number;
  title: string;
  authorLogin: string;
  authorAvatar: string | null;
  headRef: string;
  baseRef: string;
  headSha: string;
  state: PullRequestState;
  url: string;
  labels: string[];
  previewCount: number;
  createdAt: string;
  updatedAt: string;
}

/** A pull request with its embedded preview summaries. */
export interface PullRequestWithPreviews extends PullRequest {
  previews: PreviewSummary[];
}

/** Lightweight preview reference embedded on a PR. */
export interface PreviewSummary {
  id: string;
  slug: string;
  status: PreviewStatus;
  url: string | null;
  createdAt: string;
}

/** A lightweight project reference embedded on a preview. */
export interface PreviewProjectRef {
  id: string;
  name: string;
  slug: string;
  teamId: string;
}

/** A lightweight pull-request reference embedded on a preview. */
export interface PreviewPullRequestRef {
  id: string;
  number: number;
  title: string;
  authorLogin: string;
  authorAvatar: string | null;
  headRef: string;
  baseRef: string;
  headSha: string;
  state: PullRequestState;
  url: string;
}

/** A lightweight latest-deployment reference embedded on a preview. */
export interface PreviewLatestDeploymentRef {
  id: string;
  status: DeploymentStatus;
  trigger: DeploymentTrigger;
  createdAt: string;
}

/** A preview environment (list element). */
export interface Preview {
  id: string;
  projectId: string;
  pullRequestId: string | null;
  name: string;
  slug: string;
  status: PreviewStatus;
  statusDisplay: StatusDisplay;
  url: string | null;
  commitSha: string | null;
  branch: string | null;
  isPinned: boolean;
  autoStopMinutes: number;
  lastActivityAt: string;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  destroyedAt: string | null;
  serviceCount: number;
  latestDeploymentStatus: DeploymentStatus | null;
  project: PreviewProjectRef;
  pullRequest: PreviewPullRequestRef | null;
  latestDeployment: PreviewLatestDeploymentRef | null;
}

/** A preview with full detail relations (services, reviewer count). */
export interface PreviewDetail extends Preview {
  services: Service[];
  reviewerCount: number;
}

/** A service container running inside a preview. */
export interface Service {
  id: string;
  previewId: string;
  name: string;
  type: ServiceType;
  image: string | null;
  command: string | null;
  internalHost: string | null;
  ports: number[];
  status: ServiceStatus;
  healthPath: string | null;
  restartCount: number;
  createdAt: string;
  updatedAt: string;
}

/** A container image build. */
export interface Build {
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

/** Lightweight preview reference embedded on a deployment. */
export interface DeploymentPreviewRef {
  id: string;
  slug: string;
  name: string;
}

/** A deployment (build + start of a preview for one commit). */
export interface Deployment {
  id: string;
  previewId: string;
  commitSha: string;
  trigger: DeploymentTrigger;
  status: DeploymentStatus;
  createdById: string | null;
  queuedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  durationMs: number | null;
  errorSummary: string | null;
  build?: Build | null;
  preview?: DeploymentPreviewRef;
}

/** A code reviewer's state on a preview. */
export interface Review {
  id: string;
  previewId: string;
  userId: string | null;
  login: string;
  avatarUrl: string | null;
  state: ReviewState;
  createdAt: string;
  updatedAt: string;
}

/** A project seed template. */
export interface SeedTemplate {
  id: string;
  projectId: string;
  name: string;
  kind: SeedKind;
  source: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

/** An environment variable. Secret values are masked to `null`. */
export interface EnvVar {
  id: string;
  key: string;
  scope: EnvScope;
  target: EnvTarget;
  isSecret: boolean;
  value: string | null;
}

/** A usage cost record for a preview over a period. */
export interface CostRecord {
  id: string;
  previewId: string;
  periodStart: string;
  periodEnd: string;
  cpuSeconds: number;
  memoryGbHours: number;
  storageGbHours: number;
  egressGb: number;
  estimatedUsd: number;
  computedAt: string;
}

/** Per-preview cost response (records + total). */
export interface PreviewCostsResponse {
  data: CostRecord[];
  totalUsd: number;
  nextCursor: string | null;
}

/** Dashboard cost summary for the current month. */
export interface CostSummary {
  periodStart: string;
  periodEnd: string;
  totalUsd: number;
  byProject: Array<{
    projectId: string;
    projectName: string;
    teamId: string;
    estimatedUsd: number;
  }>;
  byDay: Array<{ date: string; estimatedUsd: number }>;
  teams: Array<{
    teamId: string;
    teamName: string;
    budgetUsdMonthly: number | null;
    spendUsd: number;
    budgetUsedFraction: number | null;
    overBudget: boolean;
  }>;
}

/** A user-facing notification. */
export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string | null;
  link: string | null;
  metadata: unknown;
  readAt: string | null;
  createdAt: string;
}

/** An audit-log entry. */
export interface AuditLog {
  id: string;
  teamId: string | null;
  actorId: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  metadata: unknown;
  createdAt: string;
}

/** An API token (the raw secret is only returned on create). */
export interface ApiToken {
  id: string;
  teamId: string;
  userId: string | null;
  name: string;
  prefix: string;
  scopes: string[];
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

/**
 * The response from minting a token. `token` is the raw secret, returned
 * **exactly once** at creation time and never persisted in plaintext.
 */
export interface CreatedApiToken {
  /** The raw API token, shown once. Copy it now; it cannot be retrieved again. */
  token: string;
  /** The token's safe metadata (never includes the raw secret). */
  apiToken: ApiToken;
}

/** A streamed log line (SSE `/deployments/:id/logs`). */
export interface LogEvent {
  seq: number;
  level: string;
  source: string;
  message: string;
  ts: string;
}

/** A streamed preview-status event (SSE `/previews/:id/status`). */
export interface PreviewStatusEvent {
  previewId: string;
  status: PreviewStatus;
  url: string | null;
  at: string;
}
