/**
 * Test harness for route tests.
 *
 * `buildTestApp` constructs the real Fastify app via `buildApp`, but injects a
 * hand-written partial Prisma mock plus in-memory fakes for Redis and the
 * queues, so route tests exercise the full HTTP stack (validation, auth, RBAC,
 * error handling) with zero external infrastructure.
 *
 * @module
 */

import { vi } from "vitest";

import { buildApp } from "../app.js";

import type { AppConfig } from "../config.js";
import type { AppQueues } from "../types.js";
import type { PrismaClient } from "@shipyard/db";
import type Redis from "ioredis";

/** A minimal, valid {@link AppConfig} for tests (no real infra is touched). */
export const TEST_CONFIG: AppConfig = Object.freeze({
  NODE_ENV: "test",
  LOG_LEVEL: "silent",
  DATABASE_URL: "postgresql://test:test@localhost:5432/test",
  REDIS_URL: "redis://localhost:6379",
  // A valid base64 32-byte key (32 zero bytes) so config validation passes.
  SECRETS_ENCRYPTION_KEY: Buffer.alloc(32).toString("base64"),
  API_HOST: "127.0.0.1",
  API_PORT: 4000,
  PUBLIC_APP_URL: "http://localhost:3000",
  PUBLIC_API_URL: "http://localhost:4000",
  PREVIEW_BASE_DOMAIN: "preview.localhost",
  SESSION_SECRET: "test-session-secret-at-least-16",
  DEV_AUTH: true,
  GITHUB_OAUTH_CLIENT_ID: undefined,
  GITHUB_OAUTH_CLIENT_SECRET: undefined,
  GITHUB_WEBHOOK_SECRET: undefined,
  RATE_LIMIT_MAX: 1000,
  RATE_LIMIT_WINDOW: "1 minute",
} satisfies AppConfig);

/** A deeply-partial Prisma mock; individual tests fill in the methods they use. */
export type PrismaMock = {
  [K in keyof PrismaClient]?: unknown;
};

/** An in-memory fake Redis sufficient for readiness + SSE plumbing in tests. */
function fakeRedis(): Redis {
  return {
    ping: vi.fn(async () => "PONG"),
    on: vi.fn(),
    off: vi.fn(),
    setMaxListeners: vi.fn(),
    subscribe: vi.fn(async () => 1),
    unsubscribe: vi.fn(async () => 1),
    duplicate: vi.fn(),
    quit: vi.fn(async () => "OK"),
    connect: vi.fn(async () => undefined),
  } as unknown as Redis;
}

/** No-op queues that record calls; route tests assert on these as needed. */
export function fakeQueues(): AppQueues {
  return {
    deploy: {} as AppQueues["deploy"],
    destroy: {} as AppQueues["destroy"],
    enqueueDeploy: vi.fn(async () => "job-deploy-1"),
    enqueueDestroy: vi.fn(async () => "job-destroy-1"),
  };
}

/** Options for {@link buildTestApp}. */
export interface BuildTestAppOptions {
  /** The Prisma mock to inject (defaults to an empty object). */
  prisma?: PrismaMock;
  /** Config overrides merged over {@link TEST_CONFIG}. */
  config?: Partial<AppConfig>;
}

/**
 * Build a fully-wired test app against mocks.
 *
 * @param options - Optional Prisma mock and config overrides.
 * @returns The ready Fastify instance (call `.inject(...)` / `.close()`).
 */
export async function buildTestApp(options: BuildTestAppOptions = {}) {
  const config = Object.freeze({
    ...TEST_CONFIG,
    ...options.config,
  }) as AppConfig;

  const prisma = (options.prisma ?? {}) as unknown as PrismaClient;
  const redis = fakeRedis();
  const redisSub = fakeRedis();

  return buildApp({
    config,
    prisma,
    redis,
    redisSub,
    queues: fakeQueues(),
  });
}
