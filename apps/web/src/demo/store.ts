/**
 * The demo's in-memory backend state.
 *
 * Holds a mutable copy of the fixture dataset and implements the same state
 * transitions the real worker performs — including a scripted deploy
 * simulation that streams build/deploy log lines and status changes to
 * subscribers, so a redeploy in the demo behaves like a redeploy in
 * production (just without Docker).
 *
 * @module
 */

import { previewStatusDisplay } from "@shipyard/core/status";

import {
  API_TOKENS,
  AUDIT_LOGS,
  DEPLOYMENTS,
  ENV_VARS,
  ME,
  NOTIFICATIONS,
  PREVIEWS,
  PROJECTS,
  PULL_REQUESTS,
  REVIEWS,
  SEED_TEMPLATES,
  SERVICES,
  costRecordsFor,
  costSummary,
  minutesAgo,
} from "./data";

import type {
  ApiToken,
  Deployment,
  LogEvent,
  Preview,
  PreviewStatusEvent,
  Service,
} from "@/lib/api-types";
import type { PreviewStatus } from "@shipyard/core";

/** Deep-clone a fixture array so mutations never touch the source module. */
function clone<T>(rows: T[]): T[] {
  return rows.map((row) => structuredClone(row));
}

/** The mutable demo database. */
export const db = {
  me: structuredClone(ME),
  projects: clone(PROJECTS),
  pullRequests: clone(PULL_REQUESTS),
  previews: clone(PREVIEWS),
  services: clone(SERVICES),
  deployments: clone(DEPLOYMENTS),
  reviews: clone(REVIEWS),
  envVars: clone(ENV_VARS),
  seeds: clone(SEED_TEMPLATES),
  notifications: clone(NOTIFICATIONS),
  auditLogs: clone(AUDIT_LOGS),
  tokens: clone(API_TOKENS),
  costSummary: costSummary(),
};

// Keep every preview's display metadata consistent with the shared helper the
// real API uses, rather than hand-maintaining labels in the fixtures.
for (const preview of db.previews) {
  preview.statusDisplay = previewStatusDisplay(preview.status);
}

/** Look up a preview by id, or `undefined`. */
export function findPreview(id: string): Preview | undefined {
  return db.previews.find((p) => p.id === id);
}

/** Services belonging to a preview. */
export function servicesFor(previewId: string): Service[] {
  return db.services.filter((s) => s.previewId === previewId);
}

/** Deployments for a preview, newest first. */
export function deploymentsFor(previewId: string): Deployment[] {
  return db.deployments.filter((d) => d.previewId === previewId);
}

export { costRecordsFor };

// ─────────────────────────────────────────────────────────────────────────────
// Live event plumbing (consumed by the fake EventSource)
// ─────────────────────────────────────────────────────────────────────────────

type LogListener = (event: LogEvent) => void;
type StatusListener = (event: PreviewStatusEvent) => void;

/** Live log listeners per deployment id. */
const logListeners = new Map<string, Set<LogListener>>();
/** Live status listeners per preview id. */
const statusListeners = new Map<string, Set<StatusListener>>();
/** Persisted log history per deployment id (replayed as SSE backfill). */
const logHistory = new Map<string, LogEvent[]>();

/**
 * Subscribe to a deployment's logs. Existing history is replayed immediately
 * (matching the real API's backfill-then-tail behaviour); the returned function
 * unsubscribes.
 */
export function subscribeLogs(deploymentId: string, listener: LogListener): () => void {
  for (const event of logHistory.get(deploymentId) ?? []) listener(event);

  let set = logListeners.get(deploymentId);
  if (!set) {
    set = new Set();
    logListeners.set(deploymentId, set);
  }
  set.add(listener);
  return () => set!.delete(listener);
}

/**
 * Subscribe to a preview's status stream. The current status is delivered
 * immediately (the API's "prime" event), then transitions follow.
 */
export function subscribeStatus(previewId: string, listener: StatusListener): () => void {
  const preview = findPreview(previewId);
  if (preview) {
    listener({
      previewId,
      status: preview.status,
      url: preview.url,
      at: new Date().toISOString(),
    });
  }

  let set = statusListeners.get(previewId);
  if (!set) {
    set = new Set();
    statusListeners.set(previewId, set);
  }
  set.add(listener);
  return () => set!.delete(listener);
}

/** Append a log line to history and fan it out to live listeners. */
function emitLog(
  deploymentId: string,
  level: LogEvent["level"],
  source: LogEvent["source"],
  message: string,
): void {
  const history = logHistory.get(deploymentId) ?? [];
  const event: LogEvent = {
    seq: history.length + 1,
    level,
    source,
    message,
    ts: new Date().toISOString(),
  };
  history.push(event);
  logHistory.set(deploymentId, history);
  for (const listener of logListeners.get(deploymentId) ?? []) listener(event);
}

/** Publish a preview status transition to live listeners. */
function emitStatus(preview: Preview): void {
  const event: PreviewStatusEvent = {
    previewId: preview.id,
    status: preview.status,
    url: preview.url,
    at: new Date().toISOString(),
  };
  for (const listener of statusListeners.get(preview.id) ?? []) listener(event);
}

/** Apply a status change + its display metadata, then publish it. */
function setPreviewStatus(preview: Preview, status: PreviewStatus, url?: string | null): void {
  preview.status = status;
  preview.statusDisplay = previewStatusDisplay(status);
  if (url !== undefined) preview.url = url;
  preview.updatedAt = new Date().toISOString();
  preview.lastActivityAt = preview.updatedAt;
  emitStatus(preview);
}

// ─────────────────────────────────────────────────────────────────────────────
// Historical log seeding
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build the log transcript a deployment would have left behind.
 *
 * For a still-running deployment only the build-phase lines are written: a
 * BUILDING preview must not already claim "is running" in its logs.
 */
function seedHistory(deployment: Deployment): void {
  const preview = findPreview(deployment.previewId);
  if (!preview) return;
  const inFlight = deployment.status === "BUILDING" || deployment.status === "DEPLOYING";
  const stack = servicesFor(preview.id);
  const lines: Array<[LogEvent["level"], LogEvent["source"], string]> = [
    ["INFO", "SYSTEM", `Planning preview ${preview.slug}`],
    ["INFO", "SYSTEM", `Ensuring network shipyard-${preview.slug}`],
  ];

  for (const svc of stack) {
    if (svc.type === "DATABASE" || svc.type === "CACHE") {
      lines.push(["INFO", "BUILD", `${svc.name}: Pulling ${svc.image}`]);
      lines.push(["INFO", "BUILD", `[${svc.name}] Pulled ${svc.image}`]);
    } else {
      lines.push(["INFO", "BUILD", `${svc.name}: Building ${svc.image}`]);
      lines.push(["INFO", "BUILD", `[${svc.name}] Step 1/3 : FROM node:20-alpine`]);
      lines.push(["INFO", "BUILD", `[${svc.name}] Step 2/3 : COPY . .`]);
      lines.push(["INFO", "BUILD", `[${svc.name}] Step 3/3 : CMD ["node", "server.js"]`]);
      lines.push(["INFO", "BUILD", `[${svc.name}] Successfully built ${svc.image}`]);
    }
  }
  if (inFlight) {
    // Stop at the build phase — the rest streams live once the simulation
    // resumes this deployment (see resumeInFlightDeploys).
    writeHistory(deployment, lines);
    return;
  }

  for (const svc of stack) {
    lines.push(["INFO", "DEPLOY", `${svc.name}: Creating ${svc.name}`]);
    lines.push(["INFO", "DEPLOY", `service ${svc.name} is starting`]);
  }
  lines.push(["INFO", "DEPLOY", "Applying seed template: default"]);

  if (deployment.status === "FAILED") {
    lines.push(["ERROR", "DEPLOY", deployment.errorSummary ?? "deploy failed"]);
    lines.push(["ERROR", "SYSTEM", `Preview ${preview.slug} failed`]);
  } else {
    for (const svc of stack) {
      lines.push(["INFO", "RUNTIME", `service ${svc.name} is healthy`]);
    }
    lines.push(["INFO", "SYSTEM", `Preview ${preview.slug} is running`]);
    if (preview.url) lines.push(["INFO", "SYSTEM", `URL: ${preview.url}`]);
  }

  writeHistory(deployment, lines);
}

/** Persist a transcript, spreading timestamps across the deployment's run. */
function writeHistory(
  deployment: Deployment,
  lines: Array<[LogEvent["level"], LogEvent["source"], string]>,
): void {
  const history: LogEvent[] = lines.map(([level, source, message], index) => ({
    seq: index + 1,
    level,
    source,
    message,
    // Spread the transcript across the deployment's duration so timestamps
    // look like a real run rather than all landing on the same instant.
    ts: minutesAgo(
      Math.max(0, (Date.now() - new Date(deployment.queuedAt).getTime()) / 60_000) -
        (index / Math.max(1, lines.length)) * ((deployment.durationMs ?? 60_000) / 60_000),
    ),
  }));
  logHistory.set(deployment.id, history);
}

// Seed transcripts for every already-finished deployment so opening any
// preview shows real logs instead of an empty panel.
for (const deployment of db.deployments) {
  if (deployment.status !== "QUEUED") seedHistory(deployment);
}

/**
 * Drive the dataset's in-flight deployment to completion shortly after load.
 *
 * The seeded snapshot contains one preview mid-build. Left alone it would sit
 * at BUILDING forever, which reads as a hung demo; instead it finishes a few
 * seconds in, so a visitor who lands on the dashboard sees a real build go
 * green on its own. Called once, from {@link installDemoBackend}.
 */
export function resumeInFlightDeploys(): void {
  for (const preview of db.previews) {
    if (preview.status !== "BUILDING" && preview.status !== "DEPLOYING") continue;
    const deployment = deploymentsFor(preview.id)[0];
    if (!deployment) continue;
    // A short head start so the page has painted before anything moves.
    schedule(preview.id, 3500, () => finishDeploy(preview.id, deployment));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Deploy simulation
// ─────────────────────────────────────────────────────────────────────────────

/** Timers for in-flight simulations, so a re-trigger can cancel the old one. */
const running = new Map<string, ReturnType<typeof setTimeout>[]>();

/**
 * Cancel any in-flight simulation for a preview.
 *
 * Also closes the deployment it was driving: clearing the timers alone would
 * strand that row at BUILDING/DEPLOYING forever, leaving a permanently
 * "Building" entry in the deployments list (and a status stream that never
 * settles) whenever a deploy is superseded or stopped mid-flight.
 */
function cancelSimulation(previewId: string): void {
  const timers = running.get(previewId);
  if (!timers) return;
  for (const timer of timers) clearTimeout(timer);
  running.delete(previewId);

  const inFlight = deploymentsFor(previewId).find(
    (d) => d.status === "BUILDING" || d.status === "DEPLOYING" || d.status === "QUEUED",
  );
  if (!inFlight) return;
  inFlight.status = "CANCELLED";
  inFlight.finishedAt = new Date().toISOString();
  inFlight.durationMs = Date.now() - new Date(inFlight.queuedAt).getTime();
  if (inFlight.build) inFlight.build.status = "CANCELLED";

  const preview = findPreview(previewId);
  if (preview?.latestDeployment?.id === inFlight.id) {
    preview.latestDeployment.status = "CANCELLED";
    preview.latestDeploymentStatus = "CANCELLED";
  }
}

/** Schedule `fn` at `delayMs`, tracked so it can be cancelled. */
function schedule(previewId: string, delayMs: number, fn: () => void): void {
  const timers = running.get(previewId) ?? [];
  timers.push(setTimeout(fn, delayMs));
  running.set(previewId, timers);
}

/** Generate the next id in a family (e.g. `dep_sf_412_4`). */
let idCounter = 0;
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}_d${idCounter}${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Run a full deploy for a preview: create a deployment row, move the preview
 * BUILDING → DEPLOYING → RUNNING, and stream a realistic log transcript along
 * the way. Returns the new deployment.
 *
 * Timings are compressed (~9s end to end) so a visitor sees the whole
 * lifecycle without waiting, while still reading as a real build.
 */
export function startDeploy(
  previewId: string,
  trigger: Deployment["trigger"] = "REDEPLOY",
): Deployment | undefined {
  const preview = findPreview(previewId);
  if (!preview) return undefined;
  cancelSimulation(previewId);

  const stack = servicesFor(previewId);
  const now = new Date().toISOString();
  const deploymentId = nextId(`dep_${previewId}`);

  const deployment: Deployment = {
    id: deploymentId,
    previewId,
    commitSha: preview.commitSha ?? "0000000",
    trigger,
    status: "BUILDING",
    createdById: "user_alice",
    queuedAt: now,
    startedAt: now,
    finishedAt: null,
    durationMs: null,
    errorSummary: null,
    build: {
      id: `bld_${deploymentId}`,
      deploymentId,
      status: "RUNNING",
      imageTag: null,
      cacheHit: trigger === "PR_SYNC",
      exitCode: null,
      errorSummary: null,
      startedAt: now,
      finishedAt: null,
      durationMs: null,
    },
    preview: { id: preview.id, slug: preview.slug, name: preview.name },
  };
  db.deployments.unshift(deployment);
  logHistory.set(deploymentId, []);

  preview.latestDeployment = {
    id: deployment.id,
    status: deployment.status,
    trigger: deployment.trigger,
    createdAt: deployment.queuedAt,
  };
  preview.latestDeploymentStatus = "BUILDING";
  setPreviewStatus(preview, "BUILDING", null);

  // Every service restarts from pending.
  for (const svc of stack) {
    svc.status = "PENDING";
    svc.updatedAt = now;
  }

  // ── Build phase ───────────────────────────────────────────────────────────
  emitLog(deploymentId, "INFO", "SYSTEM", `Planning preview ${preview.slug}`);
  emitLog(deploymentId, "INFO", "SYSTEM", `Ensuring network shipyard-${preview.slug}`);

  let t = 400;
  const step = 260;
  for (const svc of stack) {
    const image = svc.image ?? svc.name;
    if (svc.type === "DATABASE" || svc.type === "CACHE") {
      schedule(previewId, t, () => emitLog(deploymentId, "INFO", "BUILD", `${svc.name}: Pulling ${image}`));
      t += step;
      schedule(previewId, t, () => emitLog(deploymentId, "INFO", "BUILD", `[${svc.name}] Pulled ${image}`));
      t += step;
    } else {
      for (const line of [
        `${svc.name}: Building ${image}`,
        `[${svc.name}] Step 1/3 : FROM node:20-alpine`,
        `[${svc.name}] Step 2/3 : COPY . .`,
        `[${svc.name}] Step 3/3 : CMD ["node", "server.js"]`,
        `[${svc.name}] Successfully built ${image}`,
      ]) {
        schedule(previewId, t, () => emitLog(deploymentId, "INFO", "BUILD", line));
        t += step;
      }
    }
  }

  finishDeploy(previewId, deployment, t);
  return deployment;
}

/**
 * Schedule the deploy phase of an existing deployment: services start and turn
 * healthy one by one, then the preview goes RUNNING with a URL.
 *
 * Shared by {@link startDeploy} (after its build phase) and
 * {@link resumeInFlightDeploys} (for the seeded mid-build preview).
 *
 * @param previewId - Preview being deployed.
 * @param deployment - The deployment row to drive to SUCCEEDED.
 * @param startAtMs - Offset to begin scheduling at.
 */
function finishDeploy(previewId: string, deployment: Deployment, startAtMs = 0): void {
  const preview = findPreview(previewId);
  if (!preview) return;
  const stack = servicesFor(previewId);
  const deploymentId = deployment.id;
  const step = 260;
  let t = startAtMs;

  schedule(previewId, t, () => {
    deployment.status = "DEPLOYING";
    preview.latestDeploymentStatus = "DEPLOYING";
    if (preview.latestDeployment) preview.latestDeployment.status = "DEPLOYING";
    if (deployment.build) {
      deployment.build.status = "SUCCEEDED";
      deployment.build.imageTag = `shipyard/${preview.slug}-web:latest`;
      deployment.build.exitCode = 0;
      deployment.build.finishedAt = new Date().toISOString();
    }
    setPreviewStatus(preview, "DEPLOYING", null);
    emitLog(deploymentId, "INFO", "DEPLOY", "Build complete; starting services");
  });
  t += step;

  for (const svc of stack) {
    schedule(previewId, t, () => {
      svc.status = "STARTING";
      svc.updatedAt = new Date().toISOString();
      emitLog(deploymentId, "INFO", "DEPLOY", `${svc.name}: Creating ${svc.name}`);
    });
    t += step;
    schedule(previewId, t, () => {
      svc.status = "HEALTHY";
      svc.updatedAt = new Date().toISOString();
      emitLog(deploymentId, "INFO", "RUNTIME", `service ${svc.name} is healthy`);
    });
    t += step;
  }

  schedule(previewId, t, () =>
    emitLog(deploymentId, "INFO", "DEPLOY", "Applying seed template: default"),
  );
  t += step;

  schedule(previewId, t, () => {
    const url = `https://${preview.slug}.preview.acme.dev`;
    const finishedAt = new Date().toISOString();
    deployment.status = "SUCCEEDED";
    deployment.finishedAt = finishedAt;
    deployment.durationMs = Date.now() - new Date(deployment.queuedAt).getTime();
    if (deployment.build) {
      deployment.build.durationMs = deployment.durationMs;
      deployment.build.finishedAt = finishedAt;
    }
    preview.latestDeploymentStatus = "SUCCEEDED";
    if (preview.latestDeployment) preview.latestDeployment.status = "SUCCEEDED";
    preview.serviceCount = stack.length;
    setPreviewStatus(preview, "RUNNING", url);
    emitLog(deploymentId, "INFO", "SYSTEM", `Preview ${preview.slug} is running`);
    emitLog(deploymentId, "INFO", "SYSTEM", `URL: ${url}`);
    running.delete(previewId);
  });
}

/** Stop a preview: services down, URL cleared, status STOPPED. */
export function stopPreview(previewId: string): Preview | undefined {
  const preview = findPreview(previewId);
  if (!preview) return undefined;
  cancelSimulation(previewId);
  for (const svc of servicesFor(previewId)) {
    svc.status = "STOPPED";
    svc.updatedAt = new Date().toISOString();
  }
  setPreviewStatus(preview, "STOPPED", null);
  return preview;
}

/** Destroy a preview: tear down through DESTROYING to DESTROYED. */
export function destroyPreview(previewId: string): Preview | undefined {
  const preview = findPreview(previewId);
  if (!preview) return undefined;
  cancelSimulation(previewId);
  setPreviewStatus(preview, "DESTROYING", null);
  schedule(previewId, 1400, () => {
    // A destroyed preview's containers are gone, so its Service rows go too —
    // leaving them would contradict the serviceCount badge and the real API,
    // which prunes them on teardown.
    db.services = db.services.filter((s) => s.previewId !== previewId);
    preview.destroyedAt = new Date().toISOString();
    preview.serviceCount = 0;
    setPreviewStatus(preview, "DESTROYED", null);
    running.delete(previewId);
  });
  return preview;
}

/** Toggle the pinned flag. */
export function pinPreview(previewId: string, pinned: boolean): Preview | undefined {
  const preview = findPreview(previewId);
  if (!preview) return undefined;
  preview.isPinned = pinned;
  preview.updatedAt = new Date().toISOString();
  return preview;
}

/** Cancel an in-flight deployment. */
export function cancelDeployment(deploymentId: string): Deployment | undefined {
  const deployment = db.deployments.find((d) => d.id === deploymentId);
  if (!deployment) return undefined;
  if (deployment.status === "SUCCEEDED" || deployment.status === "FAILED") return deployment;
  cancelSimulation(deployment.previewId);
  deployment.status = "CANCELLED";
  deployment.finishedAt = new Date().toISOString();
  if (deployment.build) deployment.build.status = "CANCELLED";
  const preview = findPreview(deployment.previewId);
  if (preview) {
    preview.latestDeploymentStatus = "CANCELLED";
    setPreviewStatus(preview, "STOPPED", null);
  }
  return deployment;
}

/** Mint a demo API token (the raw value is shown once, as in the real API). */
export function createToken(
  teamId: string,
  name: string,
  scopes: string[],
): { token: string; apiToken: ApiToken } {
  const suffix = Math.random().toString(36).slice(2, 6);
  const apiToken: ApiToken = {
    id: nextId("tok"),
    teamId,
    userId: "user_alice",
    name,
    prefix: `sy_live_${suffix.toUpperCase()}`,
    scopes,
    lastUsedAt: null,
    expiresAt: null,
    createdAt: new Date().toISOString(),
  };
  db.tokens.unshift(apiToken);
  return {
    token: `${apiToken.prefix}_${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`,
    apiToken,
  };
}

/** Revoke a token by id. */
export function revokeToken(tokenId: string): void {
  db.tokens = db.tokens.filter((t) => t.id !== tokenId);
}
