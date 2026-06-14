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

import { Queue } from "bullmq";

import { QUEUE } from "@shipyard/core";
import { prisma } from "@shipyard/db";

import { loadConfig } from "./config.js";
import { bullConnection, closeConnection, createConnection } from "./connection.js";
import { createEventPublisher } from "./events.js";
import { createLogger } from "./logger.js";
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

  // Register the repeatable scheduler jobs (idempotent on a fixed jobId).
  await cleanupQueue.add(
    QUEUE.cleanup,
    {},
    {
      jobId: "cleanup-repeat",
      repeat: { every: config.CLEANUP_INTERVAL_MS },
      removeOnComplete: true,
      removeOnFail: true,
    },
  );
  await costQueue.add(
    QUEUE.cost,
    {},
    {
      jobId: "cost-repeat",
      repeat: { every: config.COST_INTERVAL_MS },
      removeOnComplete: true,
      removeOnFail: true,
    },
  );

  logger.info(
    {
      queues: [QUEUE.deploy, QUEUE.destroy, QUEUE.cleanup, QUEUE.cost],
      cleanupEveryMs: config.CLEANUP_INTERVAL_MS,
      costEveryMs: config.COST_INTERVAL_MS,
    },
    "shipyard worker ready",
  );

  let shuttingDown = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, "shutting down shipyard worker");

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

    logger.info("shutdown complete");
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((error: unknown) => {
  // No logger is guaranteed at this point (config may have failed); use console.
  console.error("worker failed to start:", error);
  process.exit(1);
});
