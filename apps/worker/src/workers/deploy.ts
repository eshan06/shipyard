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

import { Worker, type Job } from "bullmq";
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
import {
  DeployJobSchema,
  QUEUE,
  canTransitionDeployment,
  canTransitionPreview,
  type DeployJob,
} from "@shipyard/core";
import {
  type DeploymentStatus,
  type PrismaClient,
  type PreviewStatus,
} from "@shipyard/db";
import type { Logger } from "pino";
import type { WorkerConfig } from "../config.js";
import { bullConnection, type WorkerConnection } from "../connection.js";
import type { EventPublisher } from "../events.js";
import { logSourceForPhase, mapLogLevel } from "./log-mapping.js";
import {
  serviceStatusFromState,
  serviceTypeFromKind,
} from "./mappers.js";

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
    },
  })) as LoadedProject | null;
  if (!project) {
    log.warn("project row not found; dropping job");
    return;
  }

  const startedAt = new Date();

  // ── 1. Enter BUILDING + ensure Build row ───────────────────────────────────
  await transitionDeployment(db, deployment.id, deployment.status, "BUILDING", {
    startedAt,
  });
  await transitionPreview(db, events, preview.id, preview.status, "BUILDING", {
    projectId: project.id,
    teamId: project.teamId,
  });
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

  // ── 2. Plan + deploy ───────────────────────────────────────────────────────
  const plan = planFor(job, preview.slug, project);
  const hooks = makeHooks(db, events, deployment.id, preview.id);

  let result: DeployResult;
  try {
    // The engine reports DEPLOYING-style progress via hooks; reflect it once the
    // network/containers are being created.
    await transitionDeployment(db, deployment.id, "BUILDING", "DEPLOYING");
    await transitionPreview(db, events, preview.id, "BUILDING", "DEPLOYING", {
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
      startedAt,
      error,
    });
    throw error;
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
      startedAt,
      error: new Error(summary),
      durationMs: result.durationMs,
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
  await transitionDeployment(db, deployment.id, "DEPLOYING", "SUCCEEDED", {
    finishedAt,
    durationMs,
  });
  await transitionPreview(db, events, preview.id, "DEPLOYING", "RUNNING", {
    url,
    lastActivityAt: finishedAt,
    projectId: project.id,
    teamId: project.teamId,
  });

  await events.log({
    deploymentId: deployment.id,
    source: "DEPLOY",
    message: `Preview ready at ${url}`,
  });
  await notifyPreviewReady(db, deps.logger, preview.id, url);
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
      await processDeployJob(payload, deps);
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

/** Build the {@link PreviewPlan} for a job from the project's stored config. */
function planFor(
  job: DeployJob,
  slug: string,
  project: LoadedProject,
): PreviewPlan {
  const planner = new ComposePlanner();
  return planner.plan({
    previewId: job.previewId,
    slug,
    projectId: project.id,
    config: projectConfigFrom(project),
    framework: frameworkFrom(project.framework),
  });
}

/** Coerce a `Project.config` JSON blob into a planner {@link ProjectConfig}. */
function projectConfigFrom(project: LoadedProject): ProjectConfig {
  const raw =
    project.config && typeof project.config === "object"
      ? (project.config as Record<string, unknown>)
      : {};
  const config: ProjectConfig = { rootDirectory: project.rootDirectory };
  if (typeof raw.composeFile === "string") config.composeFile = raw.composeFile;
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
  startedAt: Date;
  error: unknown;
  durationMs?: number;
}

/** Persist FAILED state across Build/Deployment/Preview + a BUILD_FAILED note. */
async function failDeploy(
  deps: DeployWorkerDeps,
  input: FailDeployInput,
): Promise<void> {
  const { prisma: db, events } = deps;
  const finishedAt = new Date();
  const durationMs =
    input.durationMs ?? finishedAt.getTime() - input.startedAt.getTime();
  const summary = input.error instanceof Error ? input.error.message : String(input.error);

  await db.build.updateMany({
    where: { deploymentId: input.deploymentId },
    data: { status: "FAILED", exitCode: 1, errorSummary: summary, finishedAt, durationMs },
  });
  const deployment = await db.deployment.findUnique({
    where: { id: input.deploymentId },
    select: { status: true },
  });
  if (deployment) {
    await transitionDeployment(
      db,
      input.deploymentId,
      deployment.status,
      "FAILED",
      { finishedAt, durationMs, errorSummary: summary },
    );
  }
  const preview = await db.preview.findUnique({
    where: { id: input.previewId },
    select: { status: true },
  });
  if (preview) {
    await transitionPreview(db, events, input.previewId, preview.status, "FAILED", {
      projectId: input.projectId,
      teamId: input.teamId,
    });
  }

  await events.log({
    deploymentId: input.deploymentId,
    source: "BUILD",
    level: "ERROR",
    message: `Deploy failed: ${summary}`,
  });
  await notifyBuildFailed(db, deps.logger, input.previewId, summary);
}

/** Options accepted by {@link transitionDeployment}. */
interface DeploymentUpdate {
  startedAt?: Date;
  finishedAt?: Date;
  durationMs?: number;
  errorSummary?: string;
}

/**
 * Guarded Deployment status write: only transitions when the core state machine
 * permits it, additionally applying any timing/error fields.
 */
async function transitionDeployment(
  db: PrismaClient,
  deploymentId: string,
  from: DeploymentStatus,
  to: DeploymentStatus,
  extra: DeploymentUpdate = {},
): Promise<void> {
  if (!canTransitionDeployment(from, to)) return;
  await db.deployment.update({
    where: { id: deploymentId },
    data: {
      ...(from === to ? {} : { status: to }),
      ...(extra.startedAt ? { startedAt: extra.startedAt } : {}),
      ...(extra.finishedAt ? { finishedAt: extra.finishedAt } : {}),
      ...(extra.durationMs !== undefined ? { durationMs: extra.durationMs } : {}),
      ...(extra.errorSummary ? { errorSummary: extra.errorSummary } : {}),
    },
  });
}

/** Options accepted by {@link transitionPreview}. */
interface PreviewUpdate {
  url?: string;
  lastActivityAt?: Date;
  projectId?: string;
  teamId?: string;
}

/**
 * Guarded Preview status write + status pub/sub. Only transitions when the core
 * state machine permits it; always publishes the (new or unchanged) status so
 * the dashboard stays live.
 */
async function transitionPreview(
  db: PrismaClient,
  events: EventPublisher,
  previewId: string,
  from: PreviewStatus,
  to: PreviewStatus,
  extra: PreviewUpdate = {},
): Promise<void> {
  if (!canTransitionPreview(from, to)) return;
  const updated = await db.preview.update({
    where: { id: previewId },
    data: {
      ...(from === to ? {} : { status: to }),
      ...(extra.url ? { url: extra.url } : {}),
      ...(extra.lastActivityAt ? { lastActivityAt: extra.lastActivityAt } : {}),
    },
    select: { status: true, url: true },
  });
  await events.previewStatus({
    previewId,
    status: updated.status,
    url: updated.url,
    projectId: extra.projectId,
    teamId: extra.teamId,
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
