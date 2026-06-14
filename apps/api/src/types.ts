/**
 * Shared API types and Fastify module augmentation.
 *
 * Decorators added by the platform plugins (config, prisma, redis, queues,
 * auth) are declared here so every route handler sees a fully-typed
 * `FastifyInstance` / `FastifyRequest` without per-file casts. Keep this in
 * lockstep with what the plugins in `src/plugins/*` actually decorate.
 *
 * @module
 */

import type { AppConfig } from "./config.js";
import type { DeployJob, DestroyJob } from "@shipyard/core";
import type { PrismaClient } from "@shipyard/db";
import type { Queue } from "bullmq";
import type { preHandlerHookHandler } from "fastify";
import type Redis from "ioredis";

/**
 * An authenticated caller resolved by the auth plugin from either a session
 * cookie or an API bearer token. `null` on `request.auth` means anonymous.
 */
export interface AuthPrincipal {
  /** The authenticated `User.id`. */
  readonly userId: string;
  /** Which credential scheme authenticated this request. */
  readonly kind: "session" | "token";
  /** The `ApiToken.id` when `kind === "token"`. */
  readonly tokenId?: string;
}

/**
 * The BullMQ queues the API produces onto, plus validated enqueue helpers. The
 * helpers validate payloads against the shared `@shipyard/core` job schemas
 * before adding, so the API and worker never disagree on the wire shape.
 */
export interface AppQueues {
  /** The `deploy` queue (build + start a preview stack). */
  readonly deploy: Queue;
  /** The `destroy` queue (tear down a preview's resources). */
  readonly destroy: Queue;
  /**
   * Validate and enqueue a deploy job.
   * @param payload - The deploy job payload (validated with `DeployJobSchema`).
   * @returns The created job's id.
   */
  enqueueDeploy(payload: DeployJob): Promise<string>;
  /**
   * Validate and enqueue a destroy job.
   * @param payload - The destroy job payload (validated with `DestroyJobSchema`).
   * @returns The created job's id.
   */
  enqueueDestroy(payload: DestroyJob): Promise<string>;
}

declare module "fastify" {
  interface FastifyInstance {
    /** Validated application configuration. */
    readonly config: AppConfig;
    /** Shared Prisma client. */
    readonly prisma: PrismaClient;
    /** Redis client for general commands (PING, publish, etc.). */
    readonly redis: Redis;
    /** A dedicated Redis connection in subscriber mode (for SSE fan-out). */
    readonly redisSub: Redis;
    /** Producer queues + validated enqueue helpers. */
    readonly queues: AppQueues;
    /**
     * Sign a session JWT for a user (used by auth routes after login).
     * @param userId - The `User.id` to embed in the session.
     * @returns A signed, compact HS256 JWT.
     */
    signSession(userId: string): Promise<string>;
    /**
     * preHandler that rejects unauthenticated requests with a 401. Attach to
     * routes/route-groups that require an authenticated principal.
     */
    readonly requireAuth: preHandlerHookHandler;
  }

  interface FastifyRequest {
    /** The authenticated principal, or `null` for anonymous requests. */
    auth: AuthPrincipal | null;
  }
}
