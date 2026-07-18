/**
 * The `deploy` worker: build + start a preview stack for a deployment.
 *
 * Processing is idempotent on retry (keyed by `deploymentId`): every status
 * write is guarded by the core `canTransition*` state machines, so re-running a
 * job that already advanced a row is a graceful no-op rather than an error. The
 * pipeline is:
 *
 *  1. Load Deployment + Preview + Project. Move Deployment QUEUED→BUILDING and
 *     Preview→BUILDING; ensure a RUNNING `Build` row.
 *  2. Plan the stack ({@link ComposePlanner}) and run `orchestrator.deploy`,
 *     streaming its log/status/progress hooks to {@link EventPublisher} and
 *     upserting `Service` rows from the reported runtimes.
 *  3. Apply the project's default {@link SeedTemplate} once a database service is
 *     healthy (in mock mode this is a realistic log line).
 *  4. On success: Build→SUCCEEDED, Deployment→SUCCEEDED, Preview→RUNNING with a
 *     resolved URL + a PREVIEW_READY notification. On failure: the FAILED
 *     equivalents + a BUILD_FAILED notification. A final log line is always
 *     emitted.
 *
 * The heavy lifting lives in the exported {@link processDeployJob} so it can be
 * unit-tested against a mocked Prisma + the real {@link MockOrchestrator}, with
 * {@link createDeployWorker} only wiring it onto a BullMQ {@link Worker}.
 *
 * @module
 */

import { Worker, type Job, type Queue } from "bullmq";

import {
  DEFAULT_JOB_OPTIONS,
  DeployJobSchema,
  DestroyJobSchema,
  QUEUE,
  deploymentFromsFor,
  destroyDedupId,
  previewFromsFor,
  type DeployJob,
} from "@shipyard/core";
import {
  ComposePlanner,
  type DeployResult,
  type Framework,
  type OrchestratorHooks,
  type PreviewOrchestrator,
  type PreviewPlan,
  type ProjectConfig,
  type ServiceRuntime,
} from "@shipyard/deploy-engine";

import { checkoutRepo, type Checkout } from "../checkout.js";
import { bullConnection, type WorkerConnection } from "../connection.js";
import { resolvePreviewEnv } from "../secrets.js";

import { logSourceForPhase, mapLogLevel } from "./log-mapping.js";
import {
  serviceStatusFromState,
  serviceTypeFromKind,
} from "./mappers.js";

import type { WorkerConfig } from "../config.js";
import type { EventPublisher } from "../events.js";
import type { GitHubApp } from "../github.js";
import type {
  DeploymentStatus,
  PrismaClient,
  PreviewStatus,
} from "@shipyard/db";
import type { Logger } from "pino";

/** Per-attempt context so the worker knows when it is on its final BullMQ try. */
export interface AttemptContext {
  /** How many attempts have been made INCLUDING this one (BullMQ `attemptsMade + 1`). */
  attempt: number;
  /** The configured max attempts for the job. */
  maxAttempts: number;
}

/** Dependencies injected into {@link processDeployJob} and the worker. */
export interface DeployWorkerDeps {
  /** Prisma client (the real singleton in prod; a mock in tests). */
  prisma: PrismaClient;
  /** The selected preview orchestrator. */
  orchestrator: PreviewOrchestrator;
  /** Log/status fan-out (durable rows + live pub/sub). */
  events: EventPublisher;
  /** Validated worker configuration. */
  config: WorkerConfig;
  /** Root logger; a child is derived per job. */
  logger: Logger;
  /**
   * The destroy queue — used by the final-failure finalizer to enqueue a
   * teardown of a preview whose deploy exhausted its retries (otherwise its
   * partially-started containers leak). Optional so unit tests can omit it.
   */
  destroyQueue?: Pick<Queue, "add">;
  /** GitHub App client for private-repo checkout + PR status. Optional. */
  githubApp?: GitHubApp | null;
}

/** Construct-time deps for {@link createDeployWorker} (adds the connection). */
export interface CreateDeployWorkerDeps extends DeployWorkerDeps {
  /** Shared BullMQ ioredis connection. */
  connection: WorkerConnection;
  /** Concurrency for this worker. Defaults to `config.WORKER_CONCURRENCY`. */
  concurrency?: number;
}

/** Project row fields the planner cares about. */
interface LoadedProject {
  id: string;
  teamId: string;
  framework: string | null;
  rootDirectory: string;
  config: unknown;
  provider: string;
  repoFullName: string;
  installationId: string | null;
}

/**
 * Process a single validated {@link DeployJob}.
 *
 * @param job - The validated deploy payload.
 * @param deps - Injected Prisma/orchestrator/events/config/logger.
 * @throws Re-throws orchestrator/infra errors after persisting FAILED state so
 *   BullMQ can retry; illegal/duplicate state transitions are swallowed.
 */
export async function processDeployJob(
  job: DeployJob,
  deps: DeployWorkerDeps,
  attempt: AttemptContext = { attempt: 1, maxAttempts: 1 },
): Promise<void> {
  const { prisma: db, orchestrator, events, config } = deps;
  const log = deps.logger.child({ job: "deploy", ...job });

  const deployment = await db.deployment.findUnique({
    where: { id: job.deploymentId },
  });
  if (!deployment) {
    log.warn("deployment row not found; dropping job");
    return;
  }
  const preview = await db.preview.findUnique({ where: { id: job.previewId } });
  if (!preview) {
    log.warn("preview row not found; dropping job");
    return;
  }
  const project = (await db.project.findUnique({
    where: { id: job.projectId },
    select: {
      id: true,
      teamId: true,
      framework: true,
      rootDirectory: true,
      config: true,
      provider: true,
      repoFullName: true,
      installationId: true,
    },
  })) as LoadedProject | null;
  if (!project) {
    log.warn("project row not found; dropping job");
    return;
  }

  // If the preview was torn down (PR closed/merged) while this deploy sat in the
  // queue, do NOT resurrect it — cancel the deployment and stop. The RUNNING
  // transition later is also CAS-guarded, but bailing here avoids wasted work.
  if (preview.status === "DESTROYED" || preview.status === "DESTROYING") {
    log.info({ status: preview.status }, "preview is being torn down; cancelling deploy");
    await cancelDeployment(db, deployment.id);
    return;
  }

  const startedAt = new Date();

  // ── 1. Enter BUILDING + ensure Build row ───────────────────────────────────
  await transitionDeployment(db, deployment.id, "BUILDING", { startedAt });
  const enteredBuilding = await transitionPreview(db, events, preview.id, "BUILDING", {
    projectId: project.id,
    teamId: project.teamId,
  });
  if (!enteredBuilding && (await previewIsTerminal(db, preview.id))) {
    log.info("preview reached a terminal state before build; cancelling deploy");
    await cancelDeployment(db, deployment.id);
    return;
  }
  await db.build.upsert({
    where: { deploymentId: deployment.id },
    create: {
      deploymentId: deployment.id,
      status: "RUNNING",
      startedAt,
    },
    update: { status: "RUNNING", startedAt },
  });
  await events.log({
    deploymentId: deployment.id,
    source: "BUILD",
    message: `Building preview ${preview.slug} @ ${job.commitSha.slice(0, 12)}`,
  });

  // Report PENDING status back onto the PR (best-effort; no-op without an app).
  await postCommitStatus(deps, project, job.commitSha, "pending", undefined, "Building preview…");

  // ── 2. Plan + deploy ───────────────────────────────────────────────────────
  // Real (docker) builds need the PR source and the project's decrypted env;
  // check the code out into an isolated scratch dir and resolve the build
  // context against it. Cleaned up in the finally regardless of outcome.
  let checkout: Checkout | undefined;
  let result: DeployResult;
  try {
    const env = await resolvePreviewEnv(
      db,
      { projectId: project.id, previewId: preview.id, encryptionKey: config.SECRETS_ENCRYPTION_KEY },
      log,
    );
    if (config.DEPLOY_DRIVER === "docker") {
      checkout = await checkoutRepo(
        {
          repoFullName: project.repoFullName,
          commitSha: job.commitSha,
          rootDirectory: project.rootDirectory,
          installationId: project.installationId,
          workspaceDir: config.WORKSPACE_DIR,
        },
        deps.githubApp ?? null,
        log,
      );
    }
    const plan = planFor(job, preview.slug, project, { env, contextDir: checkout?.contextDir });
    const hooks = makeHooks(db, events, deployment.id, preview.id);

    // The engine reports DEPLOYING-style progress via hooks; reflect it once the
    // network/containers are being created.
    await transitionDeployment(db, deployment.id, "DEPLOYING");
    await transitionPreview(db, events, preview.id, "DEPLOYING", {
      projectId: project.id,
      teamId: project.teamId,
    });
    result = await orchestrator.deploy(plan, hooks);
  } catch (error) {
    await failDeploy(deps, {
      deploymentId: deployment.id,
      previewId: preview.id,
      projectId: project.id,
      teamId: project.teamId,
      commitSha: job.commitSha,
      startedAt,
      error,
      attempt,
    });
    throw error;
  } finally {
    await checkout?.cleanup();
  }

  // Persist whatever services the engine reported, regardless of outcome.
  await persistServices(db, preview.id, result.services);

  if (result.status === "failed") {
    const summary = firstServiceError(result.services) ?? "deploy reported failed";
    await failDeploy(deps, {
      deploymentId: deployment.id,
      previewId: preview.id,
      projectId: project.id,
      teamId: project.teamId,
      commitSha: job.commitSha,
      startedAt,
      error: new Error(summary),
      durationMs: result.durationMs,
      attempt,
    });
    return;
  }

  // ── 3. Seed (after the database service is healthy) ─────────────────────────
  await applySeed(deps, deployment.id, project.id, result);

  // ── 4. Success ──────────────────────────────────────────────────────────────
  const finishedAt = new Date();
  const durationMs = result.durationMs;
  const url = `https://${preview.slug}.${config.PREVIEW_BASE_DOMAIN}`;

  await db.build.update({
    where: { deploymentId: deployment.id },
    data: {
      status: "SUCCEEDED",
      imageTag: imageTagFor(result.services),
      finishedAt,
      durationMs,
    },
  });
  await transitionDeployment(db, deployment.id, "SUCCEEDED", {
    finishedAt,
    durationMs,
  });

  // Supersession guard: if a newer deployment for this preview has since been
  // enqueued (rapid PR pushes), do NOT flip the preview to RUNNING on this
  // (older) commit — the newer deploy owns the preview's final state.
  if (!(await isLatestDeployment(db, preview.id, deployment.id))) {
    log.info("a newer deployment superseded this one; not claiming RUNNING");
    return;
  }

  const nowRunning = await transitionPreview(db, events, preview.id, "RUNNING", {
    url,
    lastActivityAt: finishedAt,
    projectId: project.id,
    teamId: project.teamId,
  });
  if (!nowRunning) {
    log.info("preview left the deploy path before RUNNING; not overwriting its state");
    return;
  }
  await postCommitStatus(deps, project, job.commitSha, "success", url, "Preview is live");

  await events.log({
    deploymentId: deployment.id,
    source: "DEPLOY",
    message: `Preview ready at ${url}`,
  });
  await notifyPreviewReady(db, deps.logger, preview.id, url);
  events.evictDeployment(deployment.id);
}

/**
 * Create the BullMQ {@link Worker} for the `deploy` queue.
 *
 * @param deps - Injected deps plus the shared connection + concurrency.
 * @returns A started worker. Caller is responsible for `close()`.
 */
export function createDeployWorker(deps: CreateDeployWorkerDeps): Worker {
  const { connection, config } = deps;
  const worker = new Worker(
    QUEUE.deploy,
    async (job: Job) => {
      const payload = DeployJobSchema.parse(job.data);
      // Thread BullMQ's attempt bookkeeping so the failure path can tell a
      // retryable failure from the final one (finalize + notify only on the last).
      const maxAttempts = job.opts.attempts ?? 1;
      await processDeployJob(payload, deps, {
        attempt: job.attemptsMade + 1,
        maxAttempts,
      });
    },
    {
      connection: bullConnection(connection),
      concurrency: deps.concurrency ?? config.WORKER_CONCURRENCY,
    },
  );
  worker.on("failed", (job, err) => {
    deps.logger.error(
      { jobId: job?.id, err },
      "deploy job failed (will retry per attempts)",
    );
  });
  return worker;
}

// ─────────────────────────────────────────────────────────────────────────────
// Internals
// ─────────────────────────────────────────────────────────────────────────────

/** Known framework identifiers the planner understands. */
const KNOWN_FRAMEWORKS: readonly Framework[] = [
  "next",
  "vite",
  "remix",
  "astro",
  "node",
  "express",
  "fastify",
  "unknown",
];

/** Narrow a free-form `Project.framework` string to a planner {@link Framework}. */
function frameworkFrom(value: string | null): Framework | undefined {
  if (!value) return undefined;
  return (KNOWN_FRAMEWORKS as readonly string[]).includes(value)
    ? (value as Framework)
    : undefined;
}

/** Extra plan inputs resolved at deploy time (decrypted env + checkout dir). */
interface PlanOverrides {
  /** Decrypted project/preview env vars to inject into every app service. */
  env: Record<string, string>;
  /** Absolute build-context directory from the checkout (docker mode only). */
  contextDir?: string;
}

/** Build the {@link PreviewPlan} for a job from the project's stored config. */
function planFor(
  job: DeployJob,
  slug: string,
  project: LoadedProject,
  overrides: PlanOverrides,
): PreviewPlan {
  const planner = new ComposePlanner();
  return planner.plan({
    previewId: job.previewId,
    slug,
    projectId: project.id,
    config: projectConfigFrom(project, overrides.contextDir),
    framework: frameworkFrom(project.framework),
    env: overrides.env,
  });
}

/** Coerce a `Project.config` JSON blob into a planner {@link ProjectConfig}. */
function projectConfigFrom(project: LoadedProject, contextDir?: string): ProjectConfig {
  const raw =
    project.config && typeof project.config === "object"
      ? (project.config as Record<string, unknown>)
      : {};
  // With a real checkout, the build context is the absolute checkout path (+ the
  // project's rootDirectory, already resolved in contextDir). Without one (mock
  // driver) fall back to the stored rootDirectory.
  const config: ProjectConfig = { rootDirectory: contextDir ?? project.rootDirectory };
  // `composeFile` is expected to be inline compose YAML *content*. Project
  // configs commonly store a file *path* (e.g. "infra/docker-compose.yml")
  // instead — in that case (and whenever we have no checked-out repo to read,
  // as with the mock driver) we skip it and let the planner synthesize a
  // sensible default stack (web/api + postgres + redis) from the framework.
  if (
    typeof raw.composeFile === "string" &&
    /\n|services\s*:/.test(raw.composeFile)
  ) {
    config.composeFile = raw.composeFile;
  }
  if (typeof raw.webDockerfile === "string")
    config.webDockerfile = raw.webDockerfile;
  if (typeof raw.apiDockerfile === "string")
    config.apiDockerfile = raw.apiDockerfile;
  if (typeof raw.databaseImage === "string")
    config.databaseImage = raw.databaseImage;
  if (typeof raw.cacheImage === "string") config.cacheImage = raw.cacheImage;
  if (typeof raw.withDatabase === "boolean")
    config.withDatabase = raw.withDatabase;
  if (typeof raw.withCache === "boolean") config.withCache = raw.withCache;
  return config;
}

/**
 * Wire orchestrator lifecycle hooks to the event publisher + service upserts.
 */
function makeHooks(
  db: PrismaClient,
  events: EventPublisher,
  deploymentId: string,
  previewId: string,
): OrchestratorHooks {
  return {
    onLog: (line) => {
      void events.log({
        deploymentId,
        source: line.stream === "stderr" ? "BUILD" : "RUNTIME",
        level: line.stream === "stderr" ? "WARN" : "INFO",
        message: `[${line.service}] ${line.line}`,
        at: new Date(line.timestamp),
      });
    },
    onProgress: (event) => {
      void events.log({
        deploymentId,
        source: logSourceForPhase(event.phase),
        level: mapLogLevel(event.phase),
        message: event.service
          ? `${event.service}: ${event.message}`
          : event.message,
      });
    },
    onServiceStatus: (name, status, runtime) => {
      void upsertService(db, previewId, runtime).catch(() => {
        // Best-effort live upsert; the final persistServices pass is canonical.
      });
      void events.log({
        deploymentId,
        source: "DEPLOY",
        message: `service ${name} is ${status}`,
      });
    },
  };
}

/** Persist all reported services for a preview (canonical post-deploy pass). */
async function persistServices(
  db: PrismaClient,
  previewId: string,
  services: ServiceRuntime[],
): Promise<void> {
  for (const runtime of services) {
    await upsertService(db, previewId, runtime);
  }
}

/** Upsert a single `Service` row from an engine {@link ServiceRuntime}. */
async function upsertService(
  db: PrismaClient,
  previewId: string,
  runtime: ServiceRuntime,
): Promise<void> {
  const data = {
    type: serviceTypeFromKind(runtime.kind),
    image: runtime.image ?? null,
    internalHost: runtime.host,
    ports: Object.keys(runtime.publishedPorts).map((p) => Number.parseInt(p, 10)),
    status: serviceStatusFromState(runtime.status),
    containerId: runtime.containerId ?? null,
  };
  await db.service.upsert({
    where: { previewId_name: { previewId, name: runtime.name } },
    create: { previewId, name: runtime.name, ...data },
    update: data,
  });
}

/** Pick a representative built image tag for the Build row. */
function imageTagFor(services: ServiceRuntime[]): string | null {
  const web = services.find((s) => s.kind === "web") ?? services[0];
  return web?.image ?? null;
}

/** Return the first failed service's error message, if any. */
function firstServiceError(services: ServiceRuntime[]): string | undefined {
  return services.find((s) => s.error)?.error;
}

/**
 * Apply the project's default seed template once a database service is healthy.
 * In mock mode (or with no DB service) this is a single realistic log line; with
 * a real DB service the same line is emitted (actual SQL application is the
 * orchestrator/driver's concern and out of scope for the worker contract here).
 */
async function applySeed(
  deps: DeployWorkerDeps,
  deploymentId: string,
  projectId: string,
  result: DeployResult,
): Promise<void> {
  const dbService = result.services.find(
    (s) => s.kind === "database" && s.status === "healthy",
  );
  if (!dbService) return;

  const template = await deps.prisma.seedTemplate.findFirst({
    where: { projectId, isDefault: true },
    select: { id: true, name: true, kind: true },
  });
  if (!template) return;

  await deps.events.log({
    deploymentId,
    source: "DEPLOY",
    message: `Seeding ${dbService.name} with template "${template.name}" (${template.kind})…`,
  });
  await deps.events.log({
    deploymentId,
    source: "DEPLOY",
    message: `Seed "${template.name}" applied`,
  });
}

/** Shared inputs for the failure path. */
interface FailDeployInput {
  deploymentId: string;
  previewId: string;
  projectId: string;
  teamId: string;
  commitSha: string;
  startedAt: Date;
  error: unknown;
  durationMs?: number;
  attempt: AttemptContext;
}

/**
 * Persist FAILED state across Build/Deployment/Preview. Notifications, PR status
 * and the leaked-container teardown only fire on the FINAL attempt so retries
 * don't spam the PR author or prematurely tear down a preview that may yet
 * succeed on a later try.
 */
async function failDeploy(
  deps: DeployWorkerDeps,
  input: FailDeployInput,
): Promise<void> {
  const { prisma: db, events } = deps;
  const finishedAt = new Date();
  const durationMs =
    input.durationMs ?? finishedAt.getTime() - input.startedAt.getTime();
  const summary = input.error instanceof Error ? input.error.message : String(input.error);
  const isFinal = input.attempt.attempt >= input.attempt.maxAttempts;

  await db.build.updateMany({
    where: { deploymentId: input.deploymentId },
    data: { status: "FAILED", exitCode: 1, errorSummary: summary, finishedAt, durationMs },
  });
  await transitionDeployment(db, input.deploymentId, "FAILED", {
    finishedAt,
    durationMs,
    errorSummary: summary,
  });

  await events.log({
    deploymentId: input.deploymentId,
    source: "BUILD",
    level: "ERROR",
    message: `Deploy failed${isFinal ? "" : ` (attempt ${input.attempt.attempt}/${input.attempt.maxAttempts}, will retry)`}: ${summary}`,
  });

  if (!isFinal) return;

  // Final attempt: mark the preview FAILED, notify once, report to the PR, and
  // tear down any containers the failed deploy left running (leak prevention).
  await transitionPreview(db, events, input.previewId, "FAILED", {
    projectId: input.projectId,
    teamId: input.teamId,
  });
  await notifyBuildFailed(db, deps.logger, input.previewId, summary);
  // Reap any containers the failed deploy left running. "failed" reaps docker
  // resources but keeps the preview FAILED (redeployable) — "idle" would be a
  // no-op here (its eligibility gate only stops RUNNING/DEGRADED previews).
  await enqueueDestroy(deps, input.previewId, "failed");
  const project = await loadProjectForStatus(db, input.projectId);
  if (project) {
    await postCommitStatus(deps, project, input.commitSha, "failure", undefined, summary);
  }
  events.evictDeployment(input.deploymentId);
}

/**
 * Enqueue a destroy job (best-effort). Used by the final-failure finalizer to
 * reap containers a failed deploy left running. Deduplicated via BullMQ so a
 * concurrent teardown is not double-scheduled.
 */
async function enqueueDestroy(
  deps: DeployWorkerDeps,
  previewId: string,
  reason: "idle" | "manual" | "failed",
): Promise<void> {
  if (!deps.destroyQueue) return;
  try {
    const payload = DestroyJobSchema.parse({ previewId, reason });
    await deps.destroyQueue.add(QUEUE.destroy, payload, {
      ...DEFAULT_JOB_OPTIONS,
      deduplication: { id: destroyDedupId(previewId, reason) },
    });
  } catch (err) {
    deps.logger.warn({ err, previewId }, "failed to enqueue cleanup destroy");
  }
}

/** Options accepted by {@link transitionDeployment}. */
interface DeploymentUpdate {
  startedAt?: Date;
  finishedAt?: Date;
  durationMs?: number;
  errorSummary?: string;
}

/**
 * Atomic Deployment status transition. Compare-and-swap: the write only lands
 * when the row is in a state that can legally reach `to` (checked in the
 * `WHERE`, not against a stale caller-supplied `from`). Returns whether it
 * applied.
 */
async function transitionDeployment(
  db: PrismaClient,
  deploymentId: string,
  to: DeploymentStatus,
  extra: DeploymentUpdate = {},
): Promise<boolean> {
  const res = await db.deployment.updateMany({
    where: { id: deploymentId, status: { in: deploymentFromsFor(to) } },
    data: {
      status: to,
      ...(extra.startedAt ? { startedAt: extra.startedAt } : {}),
      ...(extra.finishedAt ? { finishedAt: extra.finishedAt } : {}),
      ...(extra.durationMs !== undefined ? { durationMs: extra.durationMs } : {}),
      ...(extra.errorSummary ? { errorSummary: extra.errorSummary } : {}),
    },
  });
  return res.count > 0;
}

/** Move a deployment to CANCELLED (best-effort, CAS-guarded). */
async function cancelDeployment(db: PrismaClient, deploymentId: string): Promise<void> {
  await transitionDeployment(db, deploymentId, "CANCELLED", { finishedAt: new Date() });
}

/** Options accepted by {@link transitionPreview}. */
interface PreviewUpdate {
  url?: string;
  lastActivityAt?: Date;
  projectId?: string;
  teamId?: string;
}

/**
 * Atomic Preview status transition + status pub/sub. Compare-and-swap keyed on
 * the row's current status, so a preview that moved underneath us (e.g. was
 * DESTROYED by a racing teardown) is NOT silently resurrected. Publishes the
 * actual current status afterwards so the dashboard stays live either way.
 * Returns whether the transition applied.
 */
async function transitionPreview(
  db: PrismaClient,
  events: EventPublisher,
  previewId: string,
  to: PreviewStatus,
  extra: PreviewUpdate = {},
): Promise<boolean> {
  const res = await db.preview.updateMany({
    where: { id: previewId, status: { in: previewFromsFor(to) } },
    data: {
      status: to,
      ...(extra.url ? { url: extra.url } : {}),
      ...(extra.lastActivityAt ? { lastActivityAt: extra.lastActivityAt } : {}),
    },
  });
  const applied = res.count > 0;
  const current = await db.preview.findUnique({
    where: { id: previewId },
    select: { status: true, url: true },
  });
  if (current) {
    await events.previewStatus({
      previewId,
      status: current.status,
      url: current.url,
      projectId: extra.projectId,
      teamId: extra.teamId,
    });
  }
  return applied;
}

/** Whether the preview is in a terminal (DESTROYED) or teardown state. */
async function previewIsTerminal(db: PrismaClient, previewId: string): Promise<boolean> {
  const p = await db.preview.findUnique({
    where: { id: previewId },
    select: { status: true },
  });
  return p?.status === "DESTROYED" || p?.status === "DESTROYING";
}

/** Whether `deploymentId` is the most recent deployment for the preview. */
async function isLatestDeployment(
  db: PrismaClient,
  previewId: string,
  deploymentId: string,
): Promise<boolean> {
  const latest = await db.deployment.findFirst({
    where: { previewId },
    orderBy: { queuedAt: "desc" },
    select: { id: true },
  });
  // If we cannot determine the latest (e.g. the fake store lacks ordering),
  // fail open — the CAS transition still protects terminal states.
  return latest == null || latest.id === deploymentId;
}

/** Load the minimal project fields needed to report a commit status. */
async function loadProjectForStatus(
  db: PrismaClient,
  projectId: string,
): Promise<LoadedProject | null> {
  return (await db.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      teamId: true,
      framework: true,
      rootDirectory: true,
      config: true,
      provider: true,
      repoFullName: true,
      installationId: true,
    },
  })) as LoadedProject | null;
}

/** Post a commit status back to the PR head SHA when a GitHub App is configured. */
async function postCommitStatus(
  deps: DeployWorkerDeps,
  project: LoadedProject,
  sha: string,
  state: "pending" | "success" | "failure" | "error",
  targetUrl?: string,
  description?: string,
): Promise<void> {
  if (!deps.githubApp || project.provider !== "GITHUB" || !project.installationId) return;
  await deps.githubApp.postCommitStatus({
    repoFullName: project.repoFullName,
    installationId: project.installationId,
    sha,
    state,
    targetUrl,
    description,
  });
}

/** Create a PREVIEW_READY notification for the PR author, if resolvable. */
async function notifyPreviewReady(
  db: PrismaClient,
  logger: Logger,
  previewId: string,
  url: string,
): Promise<void> {
  const user = await prAuthorUser(db, previewId);
  if (!user) return;
  await db.notification
    .create({
      data: {
        userId: user.id,
        type: "PREVIEW_READY",
        title: "Preview ready",
        body: `Your preview is live at ${url}`,
        link: url,
        metadata: { previewId },
      },
    })
    .catch((err: unknown) => logger.warn({ err }, "PREVIEW_READY notify failed"));
}

/** Create a BUILD_FAILED notification for the PR author, if resolvable. */
async function notifyBuildFailed(
  db: PrismaClient,
  logger: Logger,
  previewId: string,
  summary: string,
): Promise<void> {
  const user = await prAuthorUser(db, previewId);
  if (!user) return;
  await db.notification
    .create({
      data: {
        userId: user.id,
        type: "BUILD_FAILED",
        title: "Build failed",
        body: summary,
        metadata: { previewId },
      },
    })
    .catch((err: unknown) => logger.warn({ err }, "BUILD_FAILED notify failed"));
}

/** Resolve the `User` who authored the preview's pull request, if any. */
async function prAuthorUser(
  db: PrismaClient,
  previewId: string,
): Promise<{ id: string } | null> {
  const preview = await db.preview.findUnique({
    where: { id: previewId },
    select: { pullRequest: { select: { authorLogin: true } } },
  });
  const login = preview?.pullRequest?.authorLogin;
  if (!login) return null;
  return db.user.findFirst({
    where: { githubLogin: login },
    select: { id: true },
  });
}
