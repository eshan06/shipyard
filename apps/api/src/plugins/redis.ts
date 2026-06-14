/**
 * Redis plugin: decorates `redis` (commands) and `redisSub` (subscriber mode).
 *
 * Two connections are required because a connection in Redis subscribe mode can
 * only run (un)subscribe commands; the API needs a separate one for `PING`,
 * `PUBLISH`, etc. Connections are lazy so the server still boots when Redis is
 * down (a warning is logged and `/readyz` will report it); both are quit on
 * close.
 *
 * @module
 */

import fp from "fastify-plugin";
import { Redis } from "ioredis";

import type { FastifyInstance } from "fastify";

/** Options for the Redis plugin. */
export interface RedisPluginOptions {
  /** An injected primary Redis client (tests). */
  redis?: Redis;
  /** An injected subscriber Redis client (tests). */
  redisSub?: Redis;
}

/**
 * Construct a lazily-connecting ioredis client from a URL.
 *
 * `lazyConnect` defers the TCP connect until the first command, and
 * `maxRetriesPerRequest: null` is required for BullMQ-adjacent usage and avoids
 * commands throwing while a reconnect is in flight.
 *
 * @param url - The Redis connection URL.
 * @returns A configured {@link Redis} client (not yet connected).
 */
function createRedis(url: string): Redis {
  return new Redis(url, {
    lazyConnect: true,
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
  });
}

/**
 * Register the Redis plugin.
 *
 * @param app - The Fastify instance.
 * @param options - Optional injected clients.
 */
async function redisPlugin(
  app: FastifyInstance,
  options: RedisPluginOptions,
): Promise<void> {
  const injected = Boolean(options.redis || options.redisSub);
  const redis = options.redis ?? createRedis(app.config.REDIS_URL);
  const redisSub = options.redisSub ?? redis.duplicate();

  redis.on("error", (err: Error) => {
    app.log.warn({ err }, "redis connection error");
  });
  redisSub.on("error", (err: Error) => {
    app.log.warn({ err }, "redis subscriber connection error");
  });

  // Best-effort eager connect so readiness reflects reality quickly, but never
  // crash the boot if Redis is unavailable.
  if (!injected) {
    try {
      await redis.connect();
      await redisSub.connect();
    } catch (err) {
      app.log.warn({ err }, "redis unavailable at boot; continuing");
    }
  }

  app.decorate("redis", redis);
  app.decorate("redisSub", redisSub);

  app.addHook("onClose", async () => {
    if (injected) return;
    await Promise.allSettled([redis.quit(), redisSub.quit()]);
  });
}

export default fp(redisPlugin, { name: "redis" });
