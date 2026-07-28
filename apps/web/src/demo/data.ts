/**
 * The demo dataset.
 *
 * A believable snapshot of a mid-size team using Shipyard: three connected
 * repos, ten previews spread across every lifecycle state, a month of cost
 * history, and the deployments/services/reviewers that hang off them.
 *
 * Everything is generated relative to {@link NOW} (captured once at module
 * load) so the demo always reads as "just now" no matter when it is opened —
 * a fixed date would make every timestamp say "8 months ago" a year from now.
 *
 * This file is only bundled when `NEXT_PUBLIC_DEMO=true`.
 *
 * @module
 */

import type {
  ApiToken,
  AuditLog,
  Build,
  CostRecord,
  CostSummary,
  Deployment,
  EnvVar,
  MeResponse,
  Notification,
  Preview,
  Project,
  PullRequest,
  Review,
  SeedTemplate,
  Service,
} from "@/lib/api-types";
import type {
  DeploymentStatus,
  DeploymentTrigger,
  PreviewStatus,
  ServiceStatus,
} from "@shipyard/core";

/** Reference instant for every relative timestamp in the dataset. */
export const NOW = Date.now();

/** ISO timestamp `minutes` before {@link NOW}. */
export function minutesAgo(minutes: number): string {
  return new Date(NOW - minutes * 60_000).toISOString();
}

/** ISO timestamp `hours` before {@link NOW}. */
export function hoursAgo(hours: number): string {
  return minutesAgo(hours * 60);
}

/** ISO timestamp `days` before {@link NOW}. */
export function daysAgo(days: number): string {
  return hoursAgo(days * 24);
}

// ─────────────────────────────────────────────────────────────────────────────
// Identity
// ─────────────────────────────────────────────────────────────────────────────

/** The signed-in demo user + team membership (`GET /me`). */
export const ME: MeResponse = {
  user: {
    id: "user_alice",
    email: "alice@acme.dev",
    name: "Alice Nguyen",
    avatarUrl: null,
    githubLogin: "alicen",
    isAdmin: true,
    createdAt: daysAgo(240),
    updatedAt: daysAgo(2),
  },
  memberships: [
    {
      id: "mem_alice_acme",
      userId: "user_alice",
      teamId: "team_acme",
      role: "OWNER",
      createdAt: daysAgo(240),
      team: {
        id: "team_acme",
        name: "Acme",
        slug: "acme",
        avatarUrl: null,
        budgetUsdMonthly: 750,
        createdAt: daysAgo(240),
        updatedAt: daysAgo(30),
      },
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Projects
// ─────────────────────────────────────────────────────────────────────────────

/** Shared defaults so each project literal stays readable. */
function project(
  overrides: Pick<Project, "id" | "name" | "slug" | "repoFullName" | "framework"> &
    Partial<Project>,
): Project {
  return {
    teamId: "team_acme",
    provider: "GITHUB",
    repoId: null,
    installationId: "42891734",
    defaultBranch: "main",
    rootDirectory: ".",
    config: {},
    autoDeployPrs: true,
    autoStopMinutes: 120,
    destroyTtlMinutes: 60,
    isArchived: false,
    createdAt: daysAgo(210),
    updatedAt: daysAgo(5),
    ...overrides,
  };
}

export const PROJECTS: Project[] = [
  project({
    id: "proj_storefront",
    name: "Storefront",
    slug: "storefront",
    repoFullName: "acme/storefront",
    framework: "nextjs",
  }),
  project({
    id: "proj_payments",
    name: "Payments API",
    slug: "payments-api",
    repoFullName: "acme/payments-api",
    framework: "fastify",
    autoStopMinutes: 60,
  }),
  project({
    id: "proj_admin",
    name: "Admin Console",
    slug: "admin-console",
    repoFullName: "acme/admin-console",
    framework: "vite",
    createdAt: daysAgo(90),
  }),
];

/** Project lookup by id. */
export const PROJECT_BY_ID = new Map(PROJECTS.map((p) => [p.id, p]));

// ─────────────────────────────────────────────────────────────────────────────
// Pull requests
// ─────────────────────────────────────────────────────────────────────────────

/** One row per PR that produced a preview below. */
export const PULL_REQUESTS: PullRequest[] = [
  {
    id: "pr_sf_412",
    projectId: "proj_storefront",
    number: 412,
    title: "feat: redesigned product detail page",
    authorLogin: "priyapatel",
    authorAvatar: null,
    headRef: "feat/pdp-redesign",
    baseRef: "main",
    headSha: "a1b2c3d4e5f60718293a4b5c6d7e8f9012345678",
    state: "OPEN",
    url: "https://github.com/acme/storefront/pull/412",
    labels: ["frontend", "needs-review"],
    previewCount: 1,
    createdAt: hoursAgo(30),
    updatedAt: minutesAgo(12),
  },
  {
    id: "pr_sf_414",
    projectId: "proj_storefront",
    number: 414,
    title: "perf: image CDN + responsive srcset",
    authorLogin: "marcusreed",
    authorAvatar: null,
    headRef: "perf/image-cdn",
    baseRef: "main",
    headSha: "f6071829a4b5c6d7e8f90123456789ab12cd34ef",
    state: "OPEN",
    url: "https://github.com/acme/storefront/pull/414",
    labels: ["performance"],
    previewCount: 1,
    createdAt: hoursAgo(3),
    updatedAt: minutesAgo(2),
  },
  {
    id: "pr_pa_236",
    projectId: "proj_payments",
    number: 236,
    title: "feat: 3DS challenge flow",
    authorLogin: "danielokafor",
    authorAvatar: null,
    headRef: "feat/3ds-challenge",
    baseRef: "main",
    headSha: "5066473821abcdef0123456789aabbcc1d2e3f45",
    state: "OPEN",
    url: "https://github.com/acme/payments-api/pull/236",
    labels: ["payments", "security"],
    previewCount: 1,
    createdAt: hoursAgo(6),
    updatedAt: minutesAgo(4),
  },
  {
    id: "pr_pa_233",
    projectId: "proj_payments",
    number: 233,
    title: "feat: idempotency keys for charge endpoint",
    authorLogin: "alicen",
    authorAvatar: null,
    headRef: "feat/idempotency-keys",
    baseRef: "main",
    headSha: "1029384756abcdef0123456789aabbcc1d2e3f45",
    state: "OPEN",
    url: "https://github.com/acme/payments-api/pull/233",
    labels: ["payments"],
    previewCount: 1,
    createdAt: daysAgo(2),
    updatedAt: hoursAgo(20),
  },
  {
    id: "pr_pa_230",
    projectId: "proj_payments",
    number: 230,
    title: "fix: webhook retry backoff jitter",
    authorLogin: "marcusreed",
    authorAvatar: null,
    headRef: "fix/webhook-backoff",
    baseRef: "main",
    headSha: "2038475619abcdef0123456789aabbcc1d2e3f45",
    state: "OPEN",
    url: "https://github.com/acme/payments-api/pull/230",
    labels: ["bug"],
    previewCount: 1,
    createdAt: daysAgo(2),
    updatedAt: hoursAgo(18),
  },
  {
    id: "pr_sf_409",
    projectId: "proj_storefront",
    number: 409,
    title: "fix: cart total rounding on multi-currency",
    authorLogin: "priyapatel",
    authorAvatar: null,
    headRef: "fix/cart-rounding",
    baseRef: "main",
    headSha: "b2c3d4e5f60718293a4b5c6d7e8f901234567890",
    state: "OPEN",
    url: "https://github.com/acme/storefront/pull/409",
    labels: ["bug", "checkout"],
    previewCount: 1,
    createdAt: daysAgo(3),
    updatedAt: daysAgo(1),
  },
  {
    id: "pr_sf_401",
    projectId: "proj_storefront",
    number: 401,
    title: "feat: wishlist (WIP)",
    authorLogin: "danielokafor",
    authorAvatar: null,
    headRef: "feat/wishlist",
    baseRef: "main",
    headSha: "d4e5f60718293a4b5c6d7e8f9012345678901234",
    state: "DRAFT",
    url: "https://github.com/acme/storefront/pull/401",
    labels: ["frontend"],
    previewCount: 1,
    createdAt: daysAgo(4),
    updatedAt: daysAgo(2),
  },
  {
    id: "pr_ac_118",
    projectId: "proj_admin",
    number: 118,
    title: "feat: bulk refund tooling",
    authorLogin: "alicen",
    authorAvatar: null,
    headRef: "feat/bulk-refunds",
    baseRef: "main",
    headSha: "c3d4e5f60718293a4b5c6d7e8f9012345678abcd",
    state: "OPEN",
    url: "https://github.com/acme/admin-console/pull/118",
    labels: ["internal"],
    previewCount: 1,
    createdAt: daysAgo(1),
    updatedAt: hoursAgo(5),
  },
  {
    id: "pr_pa_226",
    projectId: "proj_payments",
    number: 226,
    title: "feat: refund partial amounts",
    authorLogin: "priyapatel",
    authorAvatar: null,
    headRef: "feat/partial-refunds",
    baseRef: "main",
    headSha: "3047566281abcdef0123456789aabbcc1d2e3f45",
    state: "MERGED",
    url: "https://github.com/acme/payments-api/pull/226",
    labels: ["payments"],
    previewCount: 1,
    createdAt: daysAgo(9),
    updatedAt: daysAgo(6),
  },
  {
    id: "pr_sf_398",
    projectId: "proj_storefront",
    number: 398,
    title: "fix: hydration mismatch in header",
    authorLogin: "marcusreed",
    authorAvatar: null,
    headRef: "fix/header-hydration",
    baseRef: "main",
    headSha: "e5f60718293a4b5c6d7e8f90123456789abcdef0",
    state: "MERGED",
    url: "https://github.com/acme/storefront/pull/398",
    labels: ["bug"],
    previewCount: 1,
    createdAt: daysAgo(11),
    updatedAt: daysAgo(8),
  },
];

/** Pull-request lookup by id. */
export const PR_BY_ID = new Map(PULL_REQUESTS.map((pr) => [pr.id, pr]));

// ─────────────────────────────────────────────────────────────────────────────
// Previews
// ─────────────────────────────────────────────────────────────────────────────

/** Spec for one seeded preview; expanded into a full {@link Preview} below. */
interface PreviewSpec {
  id: string;
  prId: string;
  status: PreviewStatus;
  /** Minutes since the last activity, drives "updated N ago". */
  updatedMinutesAgo: number;
  createdDaysAgo: number;
  isPinned?: boolean;
  /** Service loadout; defaults to the full four-service stack. */
  services?: Array<{ name: string; type: Service["type"]; image: string; port: number }>;
}

/** The canonical four-service preview stack. */
const FULL_STACK: NonNullable<PreviewSpec["services"]> = [
  { name: "postgres", type: "DATABASE", image: "postgres:16-alpine", port: 5432 },
  { name: "redis", type: "CACHE", image: "redis:7-alpine", port: 6379 },
  { name: "api", type: "API", image: "shipyard/{slug}-api:latest", port: 3001 },
  { name: "web", type: "WEB", image: "shipyard/{slug}-web:latest", port: 3000 },
];

const PREVIEW_SPECS: PreviewSpec[] = [
  { id: "prev_sf_412", prId: "pr_sf_412", status: "RUNNING", updatedMinutesAgo: 12, createdDaysAgo: 1, isPinned: true },
  { id: "prev_pa_236", prId: "pr_pa_236", status: "RUNNING", updatedMinutesAgo: 4, createdDaysAgo: 1 },
  { id: "prev_ac_118", prId: "pr_ac_118", status: "RUNNING", updatedMinutesAgo: 25, createdDaysAgo: 1 },
  { id: "prev_sf_414", prId: "pr_sf_414", status: "BUILDING", updatedMinutesAgo: 1, createdDaysAgo: 0 },
  { id: "prev_pa_233", prId: "pr_pa_233", status: "STOPPED", updatedMinutesAgo: 20 * 60, createdDaysAgo: 2 },
  { id: "prev_sf_409", prId: "pr_sf_409", status: "STOPPED", updatedMinutesAgo: 26 * 60, createdDaysAgo: 3 },
  { id: "prev_sf_401", prId: "pr_sf_401", status: "STOPPED", updatedMinutesAgo: 48 * 60, createdDaysAgo: 4 },
  { id: "prev_pa_230", prId: "pr_pa_230", status: "FAILED", updatedMinutesAgo: 18 * 60, createdDaysAgo: 2 },
  { id: "prev_pa_226", prId: "pr_pa_226", status: "DESTROYED", updatedMinutesAgo: 6 * 24 * 60, createdDaysAgo: 9 },
  { id: "prev_sf_398", prId: "pr_sf_398", status: "DESTROYED", updatedMinutesAgo: 8 * 24 * 60, createdDaysAgo: 11 },
];

/** Statuses whose containers are live (services healthy, URL reachable). */
const LIVE_STATUSES = new Set<PreviewStatus>(["RUNNING", "DEGRADED"]);

/** Slug for a preview, mirroring the API's `<project>-pr-<n>` convention. */
function slugFor(pr: PullRequest, proj: Project): string {
  return `${proj.slug}-pr-${pr.number}`;
}

/** Expand the compact specs into full API-shaped previews + their services. */
function buildPreviews(): { previews: Preview[]; services: Service[] } {
  const previews: Preview[] = [];
  const services: Service[] = [];

  for (const spec of PREVIEW_SPECS) {
    const pr = PR_BY_ID.get(spec.prId)!;
    const proj = PROJECT_BY_ID.get(pr.projectId)!;
    const slug = slugFor(pr, proj);
    const isLive = LIVE_STATUSES.has(spec.status);
    const stack = spec.services ?? FULL_STACK;

    // A destroyed preview has no service rows left; everything else keeps them.
    const serviceStatus: ServiceStatus =
      spec.status === "RUNNING"
        ? "HEALTHY"
        : spec.status === "BUILDING" || spec.status === "DEPLOYING"
          ? "STARTING"
          : spec.status === "FAILED"
            ? "CRASHED"
            : "STOPPED";

    if (spec.status !== "DESTROYED") {
      stack.forEach((svc, index) => {
        services.push({
          id: `svc_${spec.id}_${svc.name}`,
          previewId: spec.id,
          name: svc.name,
          type: svc.type,
          image: svc.image.replace("{slug}", slug),
          command: null,
          internalHost: svc.name,
          ports: [svc.port],
          // In a BUILDING preview the backing services are already up and only
          // the app containers are still coming: makes the demo read correctly.
          status:
            spec.status === "BUILDING" && index < 2 ? "HEALTHY" : serviceStatus,
          healthPath: svc.type === "WEB" || svc.type === "API" ? "/healthz" : null,
          restartCount: spec.status === "FAILED" && svc.type === "API" ? 3 : 0,
          createdAt: daysAgo(spec.createdDaysAgo),
          updatedAt: minutesAgo(spec.updatedMinutesAgo),
        });
      });
    }

    const latestDeploymentStatus: DeploymentStatus =
      spec.status === "RUNNING"
        ? "SUCCEEDED"
        : spec.status === "BUILDING"
          ? "BUILDING"
          : spec.status === "DEPLOYING"
            ? "DEPLOYING"
            : spec.status === "FAILED"
              ? "FAILED"
              : "SUCCEEDED";

    previews.push({
      id: spec.id,
      projectId: proj.id,
      pullRequestId: pr.id,
      name: `PR #${pr.number} · ${pr.headRef.split("/").pop()}`,
      slug,
      status: spec.status,
      // Filled in by the store via previewStatusDisplay() so the demo and the
      // real API agree on labels/colors.
      statusDisplay: { label: spec.status, color: "neutral", isActive: false },
      url: isLive ? `https://${slug}.preview.acme.dev` : null,
      commitSha: pr.headSha,
      branch: pr.headRef,
      isPinned: spec.isPinned ?? false,
      autoStopMinutes: proj.autoStopMinutes,
      lastActivityAt: minutesAgo(spec.updatedMinutesAgo),
      expiresAt: null,
      createdAt: daysAgo(spec.createdDaysAgo),
      updatedAt: minutesAgo(spec.updatedMinutesAgo),
      destroyedAt: spec.status === "DESTROYED" ? minutesAgo(spec.updatedMinutesAgo) : null,
      serviceCount: spec.status === "DESTROYED" ? 0 : stack.length,
      latestDeploymentStatus,
      project: { id: proj.id, name: proj.name, slug: proj.slug, teamId: proj.teamId },
      pullRequest: {
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
      },
      latestDeployment: null, // linked after deployments are built
    });
  }

  return { previews, services };
}

const built = buildPreviews();
export const PREVIEWS: Preview[] = built.previews;
export const SERVICES: Service[] = built.services;

// ─────────────────────────────────────────────────────────────────────────────
// Deployments + builds
// ─────────────────────────────────────────────────────────────────────────────

/** Compact deployment spec expanded below. */
interface DeploymentSpec {
  id: string;
  previewId: string;
  status: DeploymentStatus;
  trigger: DeploymentTrigger;
  minutesAgo: number;
  durationMs: number | null;
  errorSummary?: string;
}

const DEPLOYMENT_SPECS: DeploymentSpec[] = [
  { id: "dep_sf_412_3", previewId: "prev_sf_412", status: "SUCCEEDED", trigger: "PR_SYNC", minutesAgo: 12, durationMs: 88_000 },
  { id: "dep_pa_236_2", previewId: "prev_pa_236", status: "SUCCEEDED", trigger: "PR_SYNC", minutesAgo: 4, durationMs: 71_000 },
  { id: "dep_ac_118_1", previewId: "prev_ac_118", status: "SUCCEEDED", trigger: "PR_OPENED", minutesAgo: 25, durationMs: 64_000 },
  { id: "dep_sf_414_1", previewId: "prev_sf_414", status: "BUILDING", trigger: "PR_OPENED", minutesAgo: 1, durationMs: null },
  { id: "dep_pa_233_2", previewId: "prev_pa_233", status: "SUCCEEDED", trigger: "PR_SYNC", minutesAgo: 20 * 60, durationMs: 41_000 },
  { id: "dep_sf_409_2", previewId: "prev_sf_409", status: "SUCCEEDED", trigger: "PR_SYNC", minutesAgo: 26 * 60, durationMs: 94_000 },
  { id: "dep_sf_401_1", previewId: "prev_sf_401", status: "SUCCEEDED", trigger: "PR_OPENED", minutesAgo: 48 * 60, durationMs: 90_000 },
  {
    id: "dep_pa_230_2",
    previewId: "prev_pa_230",
    status: "FAILED",
    trigger: "PR_SYNC",
    minutesAgo: 18 * 60,
    durationMs: 75_000,
    errorSummary: "container exited (code 1): migration 20260714_add_idempotency_keys failed",
  },
  { id: "dep_sf_412_2", previewId: "prev_sf_412", status: "SUCCEEDED", trigger: "PR_OPENED", minutesAgo: 26 * 60, durationMs: 92_000 },
  { id: "dep_pa_236_1", previewId: "prev_pa_236", status: "SUCCEEDED", trigger: "PR_OPENED", minutesAgo: 6 * 60, durationMs: 83_000 },
  {
    id: "dep_sf_412_1",
    previewId: "prev_sf_412",
    status: "FAILED",
    trigger: "PR_OPENED",
    minutesAgo: 29 * 60,
    durationMs: 45_000,
    errorSummary: "build failed: TS2304 Cannot find name 'ProductGallery'",
  },
  { id: "dep_pa_233_1", previewId: "prev_pa_233", status: "SUCCEEDED", trigger: "PR_OPENED", minutesAgo: 44 * 60, durationMs: 64_000 },
  { id: "dep_pa_226_1", previewId: "prev_pa_226", status: "SUCCEEDED", trigger: "PR_OPENED", minutesAgo: 9 * 24 * 60, durationMs: 62_000 },
  { id: "dep_sf_398_1", previewId: "prev_sf_398", status: "SUCCEEDED", trigger: "PR_OPENED", minutesAgo: 11 * 24 * 60, durationMs: 87_000 },
];

/** Expand deployment specs into API-shaped deployments with embedded builds. */
function buildDeployments(): Deployment[] {
  return DEPLOYMENT_SPECS.map((spec) => {
    const preview = PREVIEWS.find((p) => p.id === spec.previewId)!;
    const finished = spec.durationMs !== null;
    const build: Build = {
      id: `bld_${spec.id}`,
      deploymentId: spec.id,
      status:
        spec.status === "SUCCEEDED"
          ? "SUCCEEDED"
          : spec.status === "FAILED"
            ? "FAILED"
            : "RUNNING",
      imageTag: spec.status === "SUCCEEDED" ? `shipyard/${preview.slug}-web:latest` : null,
      cacheHit: spec.trigger === "PR_SYNC",
      exitCode: spec.status === "FAILED" ? 1 : spec.status === "SUCCEEDED" ? 0 : null,
      errorSummary: spec.errorSummary ?? null,
      startedAt: minutesAgo(spec.minutesAgo),
      finishedAt: finished ? minutesAgo(spec.minutesAgo - spec.durationMs! / 60_000) : null,
      durationMs: spec.durationMs,
    };

    return {
      id: spec.id,
      previewId: spec.previewId,
      commitSha: preview.commitSha!,
      trigger: spec.trigger,
      status: spec.status,
      createdById: spec.trigger === "MANUAL" || spec.trigger === "REDEPLOY" ? "user_alice" : null,
      queuedAt: minutesAgo(spec.minutesAgo),
      startedAt: minutesAgo(spec.minutesAgo),
      finishedAt: finished ? minutesAgo(spec.minutesAgo - spec.durationMs! / 60_000) : null,
      durationMs: spec.durationMs,
      errorSummary: spec.errorSummary ?? null,
      build,
      preview: { id: preview.id, slug: preview.slug, name: preview.name },
    };
  });
}

export const DEPLOYMENTS: Deployment[] = buildDeployments();

// Link each preview to its most recent deployment (list pages render this).
for (const preview of PREVIEWS) {
  const latest = DEPLOYMENTS.find((d) => d.previewId === preview.id);
  if (latest) {
    preview.latestDeployment = {
      id: latest.id,
      status: latest.status,
      trigger: latest.trigger,
      createdAt: latest.queuedAt,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Reviewers
// ─────────────────────────────────────────────────────────────────────────────

/** Reviewer rows keyed by preview id. */
export const REVIEWS: Review[] = [
  { id: "rev_1", previewId: "prev_sf_412", userId: null, login: "marcusreed", avatarUrl: null, state: "APPROVED", createdAt: hoursAgo(20), updatedAt: hoursAgo(4) },
  { id: "rev_2", previewId: "prev_sf_412", userId: "user_alice", login: "alicen", avatarUrl: null, state: "COMMENTED", createdAt: hoursAgo(18), updatedAt: hoursAgo(3) },
  { id: "rev_3", previewId: "prev_sf_412", userId: null, login: "danielokafor", avatarUrl: null, state: "PENDING", createdAt: hoursAgo(18), updatedAt: hoursAgo(18) },
  { id: "rev_4", previewId: "prev_pa_236", userId: "user_alice", login: "alicen", avatarUrl: null, state: "CHANGES_REQUESTED", createdAt: hoursAgo(5), updatedAt: hoursAgo(1) },
  { id: "rev_5", previewId: "prev_pa_236", userId: null, login: "priyapatel", avatarUrl: null, state: "APPROVED", createdAt: hoursAgo(4), updatedAt: minutesAgo(40) },
  { id: "rev_6", previewId: "prev_ac_118", userId: null, login: "marcusreed", avatarUrl: null, state: "PENDING", createdAt: hoursAgo(5), updatedAt: hoursAgo(5) },
  { id: "rev_7", previewId: "prev_sf_414", userId: null, login: "priyapatel", avatarUrl: null, state: "PENDING", createdAt: hoursAgo(2), updatedAt: hoursAgo(2) },
];

// ─────────────────────────────────────────────────────────────────────────────
// Environment variables + seed templates
// ─────────────────────────────────────────────────────────────────────────────

/** Env vars per project (secrets are masked to `null`, exactly as the API does). */
export const ENV_VARS: Array<EnvVar & { projectId: string }> = [
  { id: "env_1", projectId: "proj_storefront", key: "NEXT_PUBLIC_API_URL", scope: "PROJECT", target: "BOTH", isSecret: false, value: "https://api.preview.acme.dev" },
  { id: "env_2", projectId: "proj_storefront", key: "NEXT_PUBLIC_SENTRY_DSN", scope: "PROJECT", target: "BUILD", isSecret: false, value: "https://ingest.sentry.io/acme-storefront" },
  { id: "env_3", projectId: "proj_storefront", key: "SESSION_SECRET", scope: "PROJECT", target: "RUNTIME", isSecret: true, value: null },
  { id: "env_4", projectId: "proj_storefront", key: "STRIPE_PUBLISHABLE_KEY", scope: "PROJECT", target: "BOTH", isSecret: false, value: "pk_test_acme_demo" },
  { id: "env_5", projectId: "proj_storefront", key: "STRIPE_SECRET_KEY", scope: "PROJECT", target: "RUNTIME", isSecret: true, value: null },
  { id: "env_6", projectId: "proj_payments", key: "DATABASE_URL", scope: "PROJECT", target: "RUNTIME", isSecret: true, value: null },
  { id: "env_7", projectId: "proj_payments", key: "LOG_LEVEL", scope: "PROJECT", target: "RUNTIME", isSecret: false, value: "info" },
  { id: "env_8", projectId: "proj_payments", key: "WEBHOOK_SIGNING_SECRET", scope: "PROJECT", target: "RUNTIME", isSecret: true, value: null },
  { id: "env_9", projectId: "proj_admin", key: "VITE_API_BASE", scope: "PROJECT", target: "BUILD", isSecret: false, value: "https://api.preview.acme.dev" },
  { id: "env_10", projectId: "proj_admin", key: "ADMIN_SSO_CLIENT_SECRET", scope: "PROJECT", target: "RUNTIME", isSecret: true, value: null },
];

/** Seed templates per project. */
export const SEED_TEMPLATES: SeedTemplate[] = [
  { id: "seed_1", projectId: "proj_storefront", name: "Catalog + 500 orders", kind: "SQL", source: "seeds/storefront-full.sql", isDefault: true, createdAt: daysAgo(120), updatedAt: daysAgo(30) },
  { id: "seed_2", projectId: "proj_storefront", name: "Minimal (smoke tests)", kind: "SQL", source: "seeds/storefront-min.sql", isDefault: false, createdAt: daysAgo(120), updatedAt: daysAgo(60) },
  { id: "seed_3", projectId: "proj_payments", name: "Sandbox merchants", kind: "SCRIPT", source: "scripts/seed-merchants.ts", isDefault: true, createdAt: daysAgo(110), updatedAt: daysAgo(14) },
  { id: "seed_4", projectId: "proj_admin", name: "Staging snapshot (anonymized)", kind: "SNAPSHOT", source: "s3://acme-seeds/admin-2026-07.dump", isDefault: true, createdAt: daysAgo(80), updatedAt: daysAgo(9) },
];

// ─────────────────────────────────────────────────────────────────────────────
// Costs
// ─────────────────────────────────────────────────────────────────────────────

/** A believable 30-day spend curve: weekday-heavy, with a mid-sprint peak. */
const DAILY_SPEND = [
  6.4, 7.1, 2.2, 1.9, 8.6, 9.4, 10.2, 11.7, 12.4, 3.1, 2.6, 13.8, 14.9, 15.6,
  16.2, 14.1, 3.4, 2.9, 12.8, 13.4, 15.1, 16.8, 17.4, 4.2, 3.6, 15.9, 17.2,
  18.1, 16.4, 12.7,
];

/** Month-to-date cost summary (`GET /costs/summary`). */
export function costSummary(): CostSummary {
  const byDay = DAILY_SPEND.map((usd, index) => ({
    date: daysAgo(DAILY_SPEND.length - 1 - index).slice(0, 10),
    estimatedUsd: usd,
  }));
  const totalUsd = Number(DAILY_SPEND.reduce((sum, v) => sum + v, 0).toFixed(2));

  // Split across projects with a stable, plausible weighting.
  const weights: Record<string, number> = {
    proj_storefront: 0.52,
    proj_payments: 0.33,
    proj_admin: 0.15,
  };
  const byProject = PROJECTS.map((p) => ({
    projectId: p.id,
    projectName: p.name,
    teamId: p.teamId,
    estimatedUsd: Number((totalUsd * weights[p.id]!).toFixed(2)),
  }));

  return {
    periodStart: daysAgo(DAILY_SPEND.length - 1),
    periodEnd: new Date(NOW).toISOString(),
    totalUsd,
    byProject,
    byDay,
    teams: [
      {
        teamId: "team_acme",
        teamName: "Acme",
        budgetUsdMonthly: 750,
        spendUsd: totalUsd,
        budgetUsedFraction: Number((totalUsd / 750).toFixed(4)),
        overBudget: totalUsd > 750,
      },
    ],
  };
}

/** Per-preview cost records (hourly rollups over the preview's lifetime). */
export function costRecordsFor(previewId: string): CostRecord[] {
  const preview = PREVIEWS.find((p) => p.id === previewId);
  if (!preview) return [];
  // Deterministic pseudo-random from the id so numbers are stable per preview.
  const seedBase = previewId.split("").reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  const hours = 12;
  return Array.from({ length: hours }, (_, index) => {
    const jitter = ((seedBase + index * 37) % 21) / 100; // 0.00–0.20
    const estimatedUsd = Number((0.14 + jitter).toFixed(4));
    return {
      id: `cost_${previewId}_${index}`,
      previewId,
      periodStart: hoursAgo(hours - index),
      periodEnd: hoursAgo(hours - index - 1),
      cpuSeconds: Number((900 + jitter * 2400).toFixed(1)),
      memoryGbHours: Number((0.5 + jitter).toFixed(3)),
      storageGbHours: Number((2 + jitter * 3).toFixed(3)),
      egressGb: Number((0.02 + jitter / 10).toFixed(4)),
      estimatedUsd,
      computedAt: hoursAgo(hours - index - 1),
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Notifications, audit log, API tokens
// ─────────────────────────────────────────────────────────────────────────────

export const NOTIFICATIONS: Notification[] = [
  { id: "ntf_1", userId: "user_alice", type: "PREVIEW_READY", title: "Preview ready · PR #236", body: "payments-api-pr-236 is running", link: "/previews/prev_pa_236", metadata: null, readAt: null, createdAt: minutesAgo(4) },
  { id: "ntf_2", userId: "user_alice", type: "REVIEW_REQUESTED", title: "Review requested · PR #414", body: "marcusreed requested your review", link: "/previews/prev_sf_414", metadata: null, readAt: null, createdAt: minutesAgo(38) },
  { id: "ntf_3", userId: "user_alice", type: "BUILD_FAILED", title: "Build failed · PR #230", body: "migration 20260714_add_idempotency_keys failed", link: "/previews/prev_pa_230", metadata: null, readAt: null, createdAt: hoursAgo(18) },
  { id: "ntf_4", userId: "user_alice", type: "PREVIEW_STOPPED", title: "Preview auto-stopped · PR #233", body: "Idle for 60 minutes", link: "/previews/prev_pa_233", metadata: null, readAt: hoursAgo(19), createdAt: hoursAgo(20) },
  { id: "ntf_5", userId: "user_alice", type: "PREVIEW_READY", title: "Preview ready · PR #412", body: "storefront-pr-412 is running", link: "/previews/prev_sf_412", metadata: null, readAt: hoursAgo(20), createdAt: hoursAgo(26) },
];

export const AUDIT_LOGS: AuditLog[] = [
  { id: "aud_1", teamId: "team_acme", actorId: "user_alice", action: "preview.redeploy", targetType: "Preview", targetId: "prev_sf_412", metadata: { trigger: "manual" }, createdAt: minutesAgo(14) },
  { id: "aud_2", teamId: "team_acme", actorId: null, action: "preview.auto_stop", targetType: "Preview", targetId: "prev_pa_233", metadata: { idleMinutes: 60 }, createdAt: hoursAgo(20) },
  { id: "aud_3", teamId: "team_acme", actorId: "user_alice", action: "token.create", targetType: "ApiToken", targetId: "tok_ci", metadata: { name: "CI pipeline" }, createdAt: daysAgo(6) },
  { id: "aud_4", teamId: "team_acme", actorId: "user_alice", action: "env.update", targetType: "Project", targetId: "proj_payments", metadata: { key: "LOG_LEVEL" }, createdAt: daysAgo(8) },
  { id: "aud_5", teamId: "team_acme", actorId: null, action: "preview.destroy", targetType: "Preview", targetId: "prev_pa_226", metadata: { reason: "pr_closed" }, createdAt: daysAgo(6) },
];

export const API_TOKENS: ApiToken[] = [
  { id: "tok_ci", teamId: "team_acme", userId: "user_alice", name: "CI pipeline", prefix: "sy_live_7Kd2", scopes: ["previews:read", "previews:write", "deployments:read"], lastUsedAt: minutesAgo(9), expiresAt: null, createdAt: daysAgo(6) },
  { id: "tok_cli", teamId: "team_acme", userId: "user_alice", name: "alice@laptop (CLI)", prefix: "sy_live_Qm81", scopes: ["previews:read", "deployments:read", "logs:read"], lastUsedAt: hoursAgo(3), expiresAt: null, createdAt: daysAgo(21) },
  { id: "tok_grafana", teamId: "team_acme", userId: null, name: "Grafana scraper", prefix: "sy_live_Xp44", scopes: ["costs:read"], lastUsedAt: hoursAgo(1), expiresAt: daysAgo(-60), createdAt: daysAgo(45) },
];
