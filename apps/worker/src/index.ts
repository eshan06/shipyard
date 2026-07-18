/**
 * Worker entrypoint.
 *
 * Boots the Shipyard background workers: it loads + validates configuration,
 * builds the logger, opens a single shared BullMQ Redis connection, selects an
 * orchestrator, then starts the `deploy` and `destroy` consumers plus the
 * repeatable `cleanup` and `cost` schedulers (registering their repeat jobs on
 * their queues). A SIGINT/SIGTERM handler tears everything down gracefully:
 * workers, queues, and the Redis connection are closed before the process exits.
 *
 * @module
 */

import { Queue, type Worker } from "bullmq";

import { QUEUE } from "@shipyard/core";
import { prisma } from "@shipyard/db";

import { loadConfig } from "./config.js";
import { bullConnection, closeConnection, createConnection } from "./connection.js";
import { createEventPublisher } from "./events.js";
import { GitHubApp } from "./github.js";
import { createLogger } from "./logger.js";
import { createWorkerMetrics, startMetricsServer } from "./metrics.js";
import { createOrchestrator } from "./orchestrator.js";
import { createCleanupWorker } from "./schedulers/cleanup.js";
import { createCostWorker } from "./schedulers/cost.js";
import { createDeployWorker } from "./workers/deploy.js";
import { createDestroyWorker } from "./workers/destroy.js";

/** Boot the worker process. Resolves once everything is started. */
async function main(): Promise<void> {
  const config = loadConfig();
  const logger = createLogger(config);
  logger.info(
    { driver: config.DEPLOY_DRIVER, concurrency: config.WORKER_CONCURRENCY },
    "starting shipyard worker",
  );

  const connection = createConnection(config);
  const orchestrator = createOrchestrator(config, logger);
  const events = createEventPublisher({ connection, logger });
  const githubApp = GitHubApp.fromConfig(config, logger);
  if (githubApp) logger.info("GitHub App configured (private-repo checkout + PR status enabled)");

  // Producer-side queues the workers/schedulers enqueue onto.
  const bull = bullConnection(connection);
  const destroyQueue = new Queue(QUEUE.destroy, { connection: bull });
  const cleanupQueue = new Queue(QUEUE.cleanup, { connection: bull });
  const costQueue = new Queue(QUEUE.cost, { connection: bull });

  // Consumers.
  const deployWorker = createDeployWorker({
    prisma,
    orchestrator,
    events,
    config,
    logger,
    connection,
    destroyQueue,
    githubApp,
  });
  const destroyWorker = createDestroyWorker({
    prisma,
    orchestrator,
    events,
    config,
    logger,
    connection,
  });
  const cleanupWorker = createCleanupWorker({
    prisma,
    destroyQueue,
    config,
    logger,
    connection,
  });
  const costWorker = createCostWorker({
    prisma,
    orchestrator,
    config,
    logger,
    connection,
  });

  // ── Metrics ────────────────────────────────────────────────────────────────
  const metrics = createWorkerMetrics();
  const metricsServer = startMetricsServer(metrics, config, logger);
  const trackOutcomes = (worker: Worker, queue: string): void => {
    worker.on("completed", (job) => {
      metrics.recordJob(queue, "completed");
      if (job?.processedOn && job.finishedOn) {
        metrics.observeDuration(queue, (job.finishedOn - job.processedOn) / 1000);
      }
    });
    worker.on("failed", () => metrics.recordJob(queue, "failed"));
  };
  trackOutcomes(deployWorker, QUEUE.deploy);
  trackOutcomes(destroyWorker, QUEUE.destroy);
  trackOutcomes(cleanupWorker, QUEUE.cleanup);
  trackOutcomes(costWorker, QUEUE.cost);

  // Register the repeatable scheduler jobs via the job-scheduler API, which is
  // keyed by a stable scheduler id and REPLACES the schedule on re-register.
  // (The legacy `add(..., { repeat })` API keys the repeat on the interval, so
  // changing CLEANUP_INTERVAL_MS/COST_INTERVAL_MS would leave the old schedule
  // ticking forever alongside the new one.)
  await cleanupQueue.upsertJobScheduler(
    "cleanup-repeat",
    { every: config.CLEANUP_INTERVAL_MS },
    { name: QUEUE.cleanup, opts: { removeOnComplete: true, removeOnFail: true } },
  );
  await costQueue.upsertJobScheduler(
    "cost-repeat",
    { every: config.COST_INTERVAL_MS },
    { name: QUEUE.cost, opts: { removeOnComplete: true, removeOnFail: true } },
  );

  logger.info(
    {
      queues: [QUEUE.deploy, QUEUE.destroy, QUEUE.cleanup, QUEUE.cost],
      cleanupEveryMs: config.CLEANUP_INTERVAL_MS,
      costEveryMs: config.COST_INTERVAL_MS,
    },
    "shipyard worker ready",
  );

  // Safety net: a floating promise rejection (or a truly uncaught error)
  // anywhere in the pipeline must not silently crash the worker and drop every
  // in-flight job. Log it; durable writes are already best-effort (see events.ts).
  process.on("unhandledRejection", (reason) => {
    logger.error({ err: reason }, "unhandled promise rejection");
  });
  // An uncaught exception may have fired mid-await inside a job processor or
  // ioredis/BullMQ internals, leaving locks / the shared connection / Prisma in
  // an undefined state. Resuming is unsafe (BullMQ would keep renewing locks on
  // effectively-dead jobs, so stalled-job recovery never requeues them). Log,
  // shut down cleanly, and exit non-zero so the supervisor restarts us and
  // BullMQ requeues the in-flight work.
  process.on("uncaughtException", (err) => {
    logger.fatal({ err }, "uncaught exception; shutting down");
    // Exit NON-ZERO so a supervisor with an on-failure restart policy restarts
    // us and BullMQ requeues the in-flight work (a signal-driven shutdown exits 0).
    void shutdown("uncaughtException", 1);
  });

  /** Force-exit budget so a hung close() cannot wedge the process forever. */
  const SHUTDOWN_TIMEOUT_MS = 30_000;

  let shuttingDown = false;
  const shutdown = async (signal: string, exitCode = 0): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, "shutting down shipyard worker");

    const sequence = (async () => {
      metricsServer?.close();
      await Promise.allSettled([
        deployWorker.close(),
        destroyWorker.close(),
        cleanupWorker.close(),
        costWorker.close(),
      ]);
      await Promise.allSettled([
        destroyQueue.close(),
        cleanupQueue.close(),
        costQueue.close(),
      ]);
      await prisma.$disconnect().catch(() => undefined);
      await closeConnection(connection);
    })();

    // Race the orderly shutdown against a hard timeout: if a worker.close()
    // blocks on an in-flight job that never settles, force-exit rather than
    // hang until SIGKILL.
    const timedOut = await Promise.race([
      sequence.then(() => false),
      new Promise<boolean>((resolve) =>
        setTimeout(() => resolve(true), SHUTDOWN_TIMEOUT_MS).unref(),
      ),
    ]);

    if (timedOut) {
      logger.warn({ timeoutMs: SHUTDOWN_TIMEOUT_MS }, "shutdown timed out; forcing exit");
      process.exit(1);
    }
    logger.info("shutdown complete");
    process.exit(exitCode);
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((error: unknown) => {
  // No logger is guaranteed at this point (config may have failed); use console.
  console.error("worker failed to start:", error);
  process.exit(1);
});
