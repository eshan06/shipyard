/**
 * Prometheus metrics plugin.
 *
 * Exposes `GET /metrics` in the Prometheus text exposition format: Node.js
 * default process/GC/event-loop metrics plus a per-request HTTP histogram
 * (labelled by method, route template, and status class — NOT the raw path, to
 * bound label cardinality). The endpoint is unauthenticated by design (scraped
 * by Prometheus over the internal network, like `/healthz`), rate-limit exempt,
 * and hidden from the OpenAPI docs.
 *
 * @module
 */

import fp from "fastify-plugin";
import { Counter, Histogram, Registry, collectDefaultMetrics } from "prom-client";

import type { FastifyInstance } from "fastify";

/** Route template used when Fastify cannot resolve one (404s, etc.). */
const UNMATCHED_ROUTE = "unmatched";

async function metricsPlugin(app: FastifyInstance): Promise<void> {
  const registry = new Registry();
  registry.setDefaultLabels({ service: "shipyard-api" });
  collectDefaultMetrics({ register: registry });

  const httpDuration = new Histogram({
    name: "http_request_duration_seconds",
    help: "HTTP request duration in seconds",
    labelNames: ["method", "route", "status"],
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    registers: [registry],
  });
  const httpTotal = new Counter({
    name: "http_requests_total",
    help: "Total HTTP requests",
    labelNames: ["method", "route", "status"],
    registers: [registry],
  });

  app.addHook("onResponse", async (request, reply) => {
    // Prefer the matched route template (`/api/v1/previews/:id`) over the raw
    // URL so per-id paths don't explode the metric's label cardinality.
    const route =
      (request.routeOptions?.url as string | undefined) ?? request.url.split("?")[0] ?? UNMATCHED_ROUTE;
    if (route === "/metrics") return; // don't measure the scrape itself
    const labels = {
      method: request.method,
      route,
      status: String(reply.statusCode),
    };
    httpTotal.inc(labels);
    // Fastify tracks elapsed ms on the reply; fall back to 0 if unavailable.
    const ms = typeof reply.elapsedTime === "number" ? reply.elapsedTime : 0;
    httpDuration.observe(labels, ms / 1000);
  });

  app.get(
    "/metrics",
    { schema: { hide: true }, config: { rateLimit: false } },
    async (_request, reply) => {
      reply.header("Content-Type", registry.contentType);
      return registry.metrics();
    },
  );
}

export default fp(metricsPlugin, { name: "metrics" });
