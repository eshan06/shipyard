/**
 * Shipyard control-plane API entrypoint.
 *
 * Loads + validates config, builds the Fastify app, starts listening, and wires
 * graceful shutdown on SIGINT/SIGTERM. Any failure to boot logs the cause and
 * exits non-zero so a supervisor can restart the process.
 *
 * @module
 */

import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";

/**
 * Boot the API server.
 *
 * @returns A promise that resolves once the server is listening.
 */
async function main(): Promise<void> {
  const config = loadConfig();
  const app = await buildApp({ config });

  await app.listen({ host: config.API_HOST, port: config.API_PORT });

  app.log.info(
    `Shipyard API listening on ${config.PUBLIC_API_URL} ` +
      `(bound ${config.API_HOST}:${config.API_PORT}) · docs at ${config.PUBLIC_API_URL}/docs`,
  );

  // Graceful shutdown: close the server (runs onClose hooks: prisma/redis/queues).
  let shuttingDown = false;
  const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    app.log.info(`received ${signal}, shutting down…`);
    try {
      await app.close();
      process.exit(0);
    } catch (err) {
      app.log.error({ err }, "error during shutdown");
      process.exit(1);
    }
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((err) => {
  // The logger may not exist yet (config/boot failure), so use console.
  console.error("Fatal: failed to start Shipyard API");
  console.error(err);
  process.exit(1);
});
