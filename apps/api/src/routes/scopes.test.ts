/**
 * Tests for API-token scope enforcement (`lib/scopes.requireScope`).
 *
 * These drive the real HTTP stack so the preHandler wiring is covered end to
 * end. They prove the least-privilege contract:
 *  - a read-only token can read but not write/destroy the same resource;
 *  - a `<resource>:write` scope implies `<resource>:read`;
 *  - a token with no scopes is denied every scope-gated route;
 *  - a wildcard (`*`) token can do anything;
 *  - session cookies are never constrained by scopes (full user privileges).
 *
 * @module
 */

import { SignJWT } from "jose";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Prisma } from "@shipyard/db";

import { buildTestApp, TEST_CONFIG, type PrismaMock } from "../test/helpers.js";

import type { FastifyInstance } from "fastify";

const USER_ID = "user_alice";
const TEAM_ID = "team_bound";

/** Mint a session cookie for {@link USER_ID}. */
async function sessionCookie(userId = USER_ID): Promise<string> {
  const key = new TextEncoder().encode(TEST_CONFIG.SESSION_SECRET);
  const jwt = await new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(key);
  return `sy_session=${jwt}`;
}

/**
 * Build a test app whose bearer token resolves to one carrying `scopes`, merged
 * with any route-specific prisma mocks the test needs.
 */
async function tokenApp(
  scopes: string[],
  extraPrisma: PrismaMock = {},
): Promise<FastifyInstance> {
  const apiToken = {
    findUnique: vi.fn(async () => ({
      id: "tok_1",
      userId: USER_ID,
      teamId: TEAM_ID,
      scopes,
      revokedAt: null,
      expiresAt: null,
    })),
    update: vi.fn(async () => ({})),
  };
  return buildTestApp({ prisma: { apiToken, ...extraPrisma } });
}

/** A canned team row as Prisma would return it (for toTeamDto). */
function teamRow(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: "team_new",
    name: "New",
    slug: "new",
    avatarUrl: null,
    budgetUsdMonthly: new Prisma.Decimal("100.00"),
    createdAt: new Date("2026-06-14T12:00:00.000Z"),
    updatedAt: new Date("2026-06-14T12:00:00.000Z"),
    ...over,
  };
}

const AUTH = { authorization: "Bearer sk_test_rawtoken" };

describe("API-token scope enforcement", () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it("allows a previews:read token to GET /previews", async () => {
    const findMany = vi.fn(async () => []);
    app = await tokenApp(["previews:read"], { preview: { findMany } });

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/previews?limit=10",
      headers: AUTH,
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data).toEqual([]);
    expect(findMany).toHaveBeenCalled();
  });

  it("forbids a previews:read token from POST /previews (write scope)", async () => {
    app = await tokenApp(["previews:read"]);

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/previews",
      headers: AUTH,
      // A valid body so validation passes and the scope preHandler is reached.
      payload: { projectId: "proj_1", name: "Feature preview" },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe("FORBIDDEN");
  });

  it("forbids a previews:read token from destroying a preview", async () => {
    app = await tokenApp(["previews:read"]);

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/previews/prev_1/destroy",
      headers: AUTH,
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe("FORBIDDEN");
  });

  it("treats previews:write as implying previews:read", async () => {
    const findMany = vi.fn(async () => []);
    app = await tokenApp(["previews:write"], { preview: { findMany } });

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/previews?limit=10",
      headers: AUTH,
    });

    expect(res.statusCode).toBe(200);
    expect(findMany).toHaveBeenCalled();
  });

  it("denies a no-scope token every scope-gated route", async () => {
    app = await tokenApp([], { preview: { findMany: vi.fn(async () => []) } });

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/previews?limit=10",
      headers: AUTH,
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe("FORBIDDEN");
  });

  it("lets a wildcard (*) token perform a write (POST /teams)", async () => {
    const create = vi.fn(async () => teamRow());
    app = await tokenApp(["*"], {
      team: { create },
      auditLog: { create: vi.fn(async () => ({ id: "a" })) },
    });

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/teams",
      headers: AUTH,
      payload: { name: "New", slug: "new", budgetUsdMonthly: 100 },
    });

    expect(res.statusCode).toBe(201);
    expect(create).toHaveBeenCalled();
  });

  it("does not constrain session cookies (POST /teams write succeeds)", async () => {
    const create = vi.fn(async () => teamRow());
    app = await buildTestApp({
      prisma: {
        team: { create },
        auditLog: { create: vi.fn(async () => ({ id: "a" })) },
      },
    });

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/teams",
      headers: { cookie: await sessionCookie() },
      payload: { name: "New", slug: "new", budgetUsdMonthly: 100 },
    });

    expect(res.statusCode).toBe(201);
    expect(create).toHaveBeenCalled();
  });
});
