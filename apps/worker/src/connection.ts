/**
 * Shared ioredis connection factory for the worker's BullMQ + pub/sub clients.
 *
 * BullMQ requires the underlying ioredis connection to set
 * `maxRetriesPerRequest: null` (otherwise blocking commands like `BRPOPLPUSH`
 * throw mid-reconnect). All workers and the queues we register share one such
 * connection; the events module additionally needs an ordinary connection for
 * `PUBLISH`, which can safely reuse it (publishing does not put a connection
 * into subscribe mode).
 *
 * @module
 */

import type { ConnectionOptions } from "bullmq";
import { Redis } from "ioredis";
import type { WorkerConfig } from "./config.js";

/**
 * The shared ioredis client reused across all queues/workers (keeps the
 * connection count bounded) and the events pub/sub publisher.
 */
export type WorkerConnection = Redis;

/**
 * Adapt a shared {@link WorkerConnection} for BullMQ's `connection` field.
 *
 * BullMQ bundles its own copy of `ioredis`, so the top-level `Redis` instance is
 * structurally — but not nominally — assignable to BullMQ's `ConnectionOptions`.
 * This narrow, single-site cast bridges the two identical-at-runtime types so the
 * whole worker can share one real connection.
 *
 * @param connection - The shared ioredis client.
 * @returns The same instance typed as a BullMQ {@link ConnectionOptions}.
 */
export function bullConnection(connection: WorkerConnection): ConnectionOptions {
  return connection as unknown as ConnectionOptions;
}

/**
 * Construct a BullMQ-compatible ioredis client from the worker configuration.
 *
 * `maxRetriesPerRequest: null` is mandatory for BullMQ. `enableReadyCheck`
 * surfaces auth/permission problems early rather than on first command.
 *
 * @param config - The validated worker configuration.
 * @returns A configured {@link Redis} client.
 */
export function createConnection(config: WorkerConfig): WorkerConnection {
  return new Redis(config.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
  });
}

/**
 * Close a shared connection, swallowing errors (best-effort shutdown).
 *
 * @param connection - The connection to close.
 */
export async function closeConnection(
  connection: WorkerConnection,
): Promise<void> {
  await connection.quit().catch(() => {
    // Forcibly disconnect if a graceful QUIT fails (e.g. already closing).
    connection.disconnect();
  });
}
