/**
 * Full-stack integration tests against the REAL database.
 *
 * These exercise the whole HTTP stack — `buildApp` with the real `@shipyard/db`
 * Prisma client, an in-memory fake Redis, and a recording stub for the queues —
 * against the seeded development dataset. They run ONLY when `DATABASE_URL` is
 * present (the seeded Postgres is up); otherwise the suite is skipped so the
 * unit-test run stays infra-free.
 *
 * Run with infra:
 *   set -a; . ./.env; set +a; pnpm --filter @shipyard/api test
 *
 * What they assert (all as the seeded owner alice@acme.dev):
 *  - `GET /previews` returns the seeded previews (>= 9, across several statuses);
 *  - `GET /previews/:id` returns a known preview's detail with its services;
 *  - `GET /deployments` returns the seeded deployments;
 *  - env masking: a secret env var returns `{ value: null, isSecret: true }`
 *    while a non-secret var exposes its plaintext;
 *  - an unauthenticated request to a protected route 401s.
 *
 * @module
 */

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { buildApp } from "../app.js";
import { loadConfig } from "../config.js";

import type { AppQueues } from "../types.js";
import type { FastifyInstance } from "fastify";
import type Redis from "ioredis";

/** Whether the real database is configured (gates the whole suite). */
const HAS_DB = Boolean(process.env.DATABASE_URL);

/** The seeded owner whose memberships scope every authenticated assertion. */
const SEED_OWNER_EMAIL = "alice@acme.dev";

/**
 * A minimal in-memory Redis double sufficient for the API's boot + readiness
 * plumbing (it never touches Redis on the endpoints under test). Injected so the
 * integration run needs only Postgres, not a live Redis.
 */
function fakeRedis(): Redis {
  return {
    ping: vi.fn(async () => "PONG"),
    on: vi.fn(),
    off: vi.fn(),
    setMaxListeners: vi.fn(),
    subscribe: vi.fn(async () => 1),
    unsubscribe: vi.fn(async () => 1),
    publish: vi.fn(async () => 0),
    duplicate: vi.fn(),
    quit: vi.fn(async () => "OK"),
    connect: vi.fn(async () => undefined),
  } as unknown as Redis;
}

/** A recorded enqueue call (for asserting side effects when relevant). */
interface RecordedEnqueue {
  kind: "deploy" | "destroy";
  payload: unknown;
}

/**
 * A queues stub that records every enqueue instead of touching BullMQ/Redis, so
 * write paths can be exercised without real infrastructure.
 */
function recordingQueues(sink: RecordedEnqueue[]): AppQueues {
  return {
    deploy: {} as AppQueues["deploy"],
    destroy: {} as AppQueues["destroy"],
    enqueueDeploy: vi.fn(async (payload) => {
      sink.push({ kind: "deploy", payload });
      return "job-deploy-int";
    }),
    enqueueDestroy: vi.fn(async (payload) => {
      sink.push({ kind: "destroy", payload });
      return "job-destroy-int";
    }),
  };
}

describe.skipIf(!HAS_DB)("API integration (real DB)", () => {
  let app: FastifyInstance;
  let sessionCookie: string;
  const enqueued: RecordedEnqueue[] = [];

  beforeAll(async () => {
    // Real config from the environment (`.env` sourced by the runner). Force the
    // test logger/posture but keep the real DATABASE_URL/SECRETS key so Prisma
    // and secret decryption work against the seeded data.
    const config = {
      ...loadConfig(process.env),
      NODE_ENV: "test" as const,
      LOG_LEVEL: "silent" as const,
      DEV_AUTH: true,
    };

    // Real Prisma singleton; fake Redis; recording queues.
    const { prisma } = await import("@shipyard/db");
    app = await buildApp({
      config,
      prisma,
      redis: fakeRedis(),
      redisSub: fakeRedis(),
      queues: recordingQueues(enqueued),
    });

    // Dev-login as the seeded owner and capture the session cookie.
    const login = await app.inject({
      method: "POST",
      url: "/api/v1/auth/dev-login",
      payload: { email: SEED_OWNER_EMAIL },
    });
    expect(login.statusCode).toBe(200);
    expect(login.json().email).toBe(SEED_OWNER_EMAIL);

    const setCookie = login.headers["set-cookie"];
    const raw = Array.isArray(setCookie) ? setCookie[0] : setCookie;
    expect(raw, "dev-login must set a session cookie").toBeTruthy();
    // Keep just the `name=value` portion for the request `cookie` header.
    sessionCookie = String(raw).split(";")[0]!;
  });

  afterAll(async () => {
    await app?.close();
  });

  it("401s an unauthenticated request to a protected route", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/previews" });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe("UNAUTHENTICATED");
  });

  it("GET /previews returns the seeded previews (>=9 across statuses)", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/previews?limit=100",
      headers: { cookie: sessionCookie },
    });
    expect(res.statusCode).toBe(200);

    const body = res.json();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThanOrEqual(9);

    // The seed produces previews in several distinct statuses. Asserted loosely
    // (>= 2, not the exact seeded spread) because the local dev DB drifts: a
    // running worker's idle reaper / user actions legitimately move statuses.
    // CI runs against a fresh seed where the full spread exists.
    const statuses = new Set<string>(body.data.map((p: { status: string }) => p.status));
    expect(statuses.size).toBeGreaterThanOrEqual(2);

    // Serializer convention: dates are ISO strings, not Date objects.
    const sample = body.data[0];
    expect(typeof sample.createdAt).toBe("string");
    expect(sample.createdAt).toMatch(/\d{4}-\d{2}-\d{2}T/);
    // Each row carries the dashboard display metadata + a project projection.
    expect(sample.statusDisplay).toMatchObject({
      label: expect.any(String),
      isActive: expect.any(Boolean),
    });
    expect(sample.project).toMatchObject({ id: expect.any(String), teamId: expect.any(String) });
  });

  it("GET /previews/:id returns a known preview's detail with services", async () => {
    // Resolve a preview that HAS services rather than hard-coding a seed id or
    // requiring a RUNNING one: on a drifted local dev DB the idle reaper (or a
    // user) may have stopped every RUNNING preview, but seeded previews keep
    // their Service rows. CI's fresh seed always satisfies this immediately.
    const list = await app.inject({
      method: "GET",
      url: "/api/v1/previews?limit=100",
      headers: { cookie: sessionCookie },
    });
    expect(list.statusCode).toBe(200);
    const candidates = list.json().data as Array<{ id: string; slug: string }>;
    expect(candidates.length).toBeGreaterThanOrEqual(1);

    let detail: {
      id: string;
      slug: string;
      services: Array<{ createdAt: string }>;
      reviewerCount: number;
    } | null = null;
    for (const candidate of candidates) {
      const res = await app.inject({
        method: "GET",
        url: `/api/v1/previews/${candidate.id}`,
        headers: { cookie: sessionCookie },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      if (Array.isArray(body.services) && body.services.length >= 1) {
        expect(body.id).toBe(candidate.id);
        expect(body.slug).toBe(candidate.slug);
        detail = body;
        break;
      }
    }

    expect(detail, "at least one preview should have Service rows").toBeTruthy();
    expect(detail!.services.length).toBeGreaterThanOrEqual(1);
    expect(typeof detail!.reviewerCount).toBe("number");
    // Service DTO dates are serialized to strings.
    expect(typeof detail!.services[0]!.createdAt).toBe("string");
  });

  it("GET /deployments returns the seeded deployments", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/deployments?limit=100",
      headers: { cookie: sessionCookie },
    });
    expect(res.statusCode).toBe(200);

    const body = res.json();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThanOrEqual(9);

    const sample = body.data[0];
    expect(sample).toMatchObject({
      id: expect.any(String),
      previewId: expect.any(String),
      commitSha: expect.any(String),
    });
    expect(typeof sample.queuedAt).toBe("string");
  });

  it("masks secret env vars (value:null, isSecret:true) but exposes non-secrets", async () => {
    // Find a project the owner can see, then list its env vars (the seed gives
    // every project both secret and non-secret vars).
    const previews = await app.inject({
      method: "GET",
      url: "/api/v1/previews?limit=100",
      headers: { cookie: sessionCookie },
    });
    const projectId = (previews.json().data as Array<{ project: { id: string } }>)
      .map((p) => p.project.id)
      .find(Boolean);
    expect(projectId, "expected at least one project from previews").toBeTruthy();

    const res = await app.inject({
      method: "GET",
      url: `/api/v1/projects/${projectId}/env?limit=100`,
      headers: { cookie: sessionCookie },
    });
    expect(res.statusCode).toBe(200);

    const vars = res.json().data as Array<{
      key: string;
      isSecret: boolean;
      value: string | null;
    }>;
    expect(vars.length).toBeGreaterThanOrEqual(1);

    const secret = vars.find((v) => v.isSecret);
    expect(secret, "seed should include a secret env var").toBeTruthy();
    expect(secret!.value).toBeNull();
    expect(secret!.isSecret).toBe(true);

    const plain = vars.find((v) => !v.isSecret);
    expect(plain, "seed should include a non-secret env var").toBeTruthy();
    // Non-secret values are decrypted and returned in plaintext.
    expect(typeof plain!.value).toBe("string");
    expect(plain!.value).not.toBeNull();
  });
});
