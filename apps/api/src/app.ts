/**
 * Application factory.
 *
 * `buildApp` constructs a fully-wired Fastify instance: the zod type provider,
 * security middleware (helmet, CORS, cookies, rate-limit), the platform plugins
 * (prisma, redis, queues, auth, swagger), the global error/not-found handlers,
 * and all routes. Real Prisma/Redis/queue clients are built by default, but any
 * of them may be injected for tests. It does NOT call `listen` — that is the
 * entrypoint's job (`index.ts`).
 *
 * @module
 */

import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import Fastify from "fastify";
import {
  serializerCompiler,
  validatorCompiler,
} from "fastify-type-provider-zod";


import { registerErrorHandlers } from "./errors.js";
import { buildLoggerOptions } from "./logger.js";
import authPlugin from "./plugins/auth.js";
import prismaPlugin from "./plugins/prisma.js";
import queuesPlugin from "./plugins/queues.js";
import redisPlugin from "./plugins/redis.js";
import swaggerPlugin from "./plugins/swagger.js";
import { registerRoutes } from "./routes/index.js";

import type { AppConfig } from "./config.js";
import type { AppQueues } from "./types.js";
import type { PrismaClient } from "@shipyard/db";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import type Redis from "ioredis";

/**
 * Options for {@link buildApp}. The injected dependencies let tests run the
 * full HTTP stack against mocks with no real database/redis/queues.
 */
export interface BuildAppOptions {
  /** The validated application configuration. */
  config: AppConfig;
  /** Injected Prisma client (defaults to the `@shipyard/db` singleton). */
  prisma?: PrismaClient;
  /** Injected primary Redis client. */
  redis?: Redis;
  /** Injected subscriber Redis client. */
  redisSub?: Redis;
  /** Injected queues implementation (defaults to real BullMQ queues). */
  queues?: AppQueues;
}

/**
 * Build and fully configure the API's Fastify instance.
 *
 * @param opts - Config plus any injected dependencies.
 * @returns The ready-to-`listen` Fastify instance.
 */
export async function buildApp(
  opts: BuildAppOptions,
): Promise<FastifyInstance> {
  const { config } = opts;

  const app = Fastify({
    logger: buildLoggerOptions(config),
    trustProxy: true,
    disableRequestLogging: config.NODE_ENV === "test",
  }).withTypeProvider<ZodTypeProvider>();

  // zod is the validator + serializer for all routes.
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  // Config is needed by every subsequent plugin, so decorate it first.
  app.decorate("config", config);

  // ── Security / transport middleware ───────────────────────────────────────
  await app.register(helmet, {
    // The Swagger UI needs inline styles/scripts; relax CSP so /docs renders.
    contentSecurityPolicy: false,
  });
  await app.register(cors, {
    origin: config.PUBLIC_APP_URL,
    credentials: true,
  });
  await app.register(cookie, { secret: config.SESSION_SECRET });

  // ── Platform plugins ──────────────────────────────────────────────────────
  // Register prisma/redis/queues/auth BEFORE the rate-limiter. The auth plugin
  // populates `request.auth` in an onRequest hook, and @fastify/rate-limit also
  // runs its check in an onRequest hook; hooks fire in registration order, so
  // auth must register first for the rate-limit keyGenerator to see the
  // resolved principal (otherwise per-token limiting silently degrades to
  // per-IP for every authenticated caller).
  await app.register(prismaPlugin, { prisma: opts.prisma });
  await app.register(redisPlugin, {
    redis: opts.redis,
    redisSub: opts.redisSub,
  });
  await app.register(queuesPlugin, { queues: opts.queues });
  await app.register(authPlugin);

  await app.register(rateLimit, {
    max: config.RATE_LIMIT_MAX,
    timeWindow: config.RATE_LIMIT_WINDOW,
    // Rate-limit per API token when present, otherwise per client IP. Relies on
    // the auth plugin (registered above) having already set `request.auth`.
    keyGenerator: (request) => request.auth?.tokenId ?? request.ip,
  });

  await app.register(swaggerPlugin);

  // ── Error handling + routes ───────────────────────────────────────────────
  registerErrorHandlers(app);
  await registerRoutes(app);

  await app.ready();
  return app;
}
