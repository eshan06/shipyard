/**
 * Worker observability: a minimal Prometheus metrics endpoint.
 *
 * The worker is a headless background process with no HTTP surface of its own,
 * so it stands up a tiny dedicated `/metrics` HTTP server (default `:9090`)
 * exposing Node.js default process/GC/event-loop metrics plus job outcome
 * counters and a job-duration histogram the deploy/destroy workers feed via
 * their BullMQ `completed`/`failed` events.
 *
 * @module
 */

import { createServer, type Server } from "node:http";

import { Counter, Histogram, Registry, collectDefaultMetrics } from "prom-client";

import type { WorkerConfig } from "./config.js";
import type { Logger } from "pino";

/** Job-outcome + duration metrics shared across the worker's queues. */
export interface WorkerMetrics {
  /** Increment the outcome counter for a finished job. */
  recordJob(queue: string, outcome: "completed" | "failed"): void;
  /** Observe a job's processing duration (seconds). */
  observeDuration(queue: string, seconds: number): void;
  /** The registry (exposed for tests). */
  registry: Registry;
}

/** Build the worker metric collectors on a fresh registry. */
export function createWorkerMetrics(): WorkerMetrics {
  const registry = new Registry();
  registry.setDefaultLabels({ service: "shipyard-worker" });
  collectDefaultMetrics({ register: registry });

  const jobsTotal = new Counter({
    name: "shipyard_worker_jobs_total",
    help: "Total worker jobs processed, by queue and outcome",
    labelNames: ["queue", "outcome"],
    registers: [registry],
  });
  const jobDuration = new Histogram({
    name: "shipyard_worker_job_duration_seconds",
    help: "Worker job processing duration in seconds, by queue",
    labelNames: ["queue"],
    buckets: [0.1, 0.5, 1, 2.5, 5, 10, 30, 60, 120, 300],
    registers: [registry],
  });

  return {
    recordJob: (queue, outcome) => jobsTotal.inc({ queue, outcome }),
    observeDuration: (queue, seconds) => jobDuration.observe({ queue }, seconds),
    registry,
  };
}

/**
 * Start the `/metrics` HTTP server. Returns the server (call `close()` on
 * shutdown), or `null` when metrics are disabled.
 */
export function startMetricsServer(
  metrics: WorkerMetrics,
  config: WorkerConfig,
  logger: Logger,
): Server | null {
  if (!config.METRICS_ENABLED) return null;

  const server = createServer((req, res) => {
    if (req.url === "/metrics") {
      void metrics.registry
        .metrics()
        .then((body) => {
          res.writeHead(200, { "Content-Type": metrics.registry.contentType });
          res.end(body);
        })
        .catch(() => {
          res.writeHead(500);
          res.end("metrics error");
        });
      return;
    }
    if (req.url === "/healthz") {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("ok");
      return;
    }
    res.writeHead(404);
    res.end();
  });

  server.on("error", (err) => logger.error({ err }, "metrics server error"));
  server.listen(config.METRICS_PORT, () =>
    logger.info({ port: config.METRICS_PORT }, "worker metrics listening on /metrics"),
  );
  return server;
}
