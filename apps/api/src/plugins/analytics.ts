/**
 * Analytics plugin: decorates `app.analytics` with the configured
 * {@link AnalyticsSink} so route handlers and other plugins can record product
 * events. The sink is built from {@link AppConfig.ANALYTICS_DRIVER} (or injected
 * for tests) and drained on server shutdown.
 *
 * @module
 */

import fp from "fastify-plugin";

import { createAnalyticsSink } from "../lib/analytics.js";

import type { AnalyticsSink } from "../lib/analytics.js";
import type { FastifyInstance } from "fastify";

/** Options for the analytics plugin. */
export interface AnalyticsPluginOptions {
  /** An injected sink (tests); otherwise the driver-configured sink is built. */
  analytics?: AnalyticsSink;
}

/**
 * Register the analytics plugin.
 *
 * @param app - The Fastify instance (already decorated with `config`/`log`).
 * @param options - Optional injected sink.
 */
async function analyticsPlugin(
  app: FastifyInstance,
  options: AnalyticsPluginOptions,
): Promise<void> {
  const sink = options.analytics ?? createAnalyticsSink(app.config, app.log);
  app.decorate("analytics", sink);
  app.addHook("onClose", async () => {
    await sink.close();
  });
}

export default fp(analyticsPlugin, { name: "analytics" });
