/**
 * Tests for the canonical teams router: the CRUD happy path, the 401 when
 * unauthenticated, and the 403 when the caller lacks the required team role.
 *
 * Authentication is exercised end-to-end by minting a real session JWT (signed
 * with the test `SESSION_SECRET`) and presenting it as the `sy_session` cookie,
 * so the auth plugin's verification path is covered too.
 *
 * @module
 */

import { SignJWT } from "jose";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";


import { Prisma } from "@shipyard/db";

import { buildTestApp, TEST_CONFIG } from "../test/helpers.js";

import type { FastifyInstance } from "fastify";

/** A fixed user id used across the tests. */
const USER_ID = "user_alice";

/** Build a fresh Date for deterministic-ish DTO assertions. */
const NOW = new Date("2026-06-14T12:00:00.000Z");

/** Mint a session cookie value for {@link USER_ID}. */
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

/** A canned team row as Prisma would return it. */
function teamRow(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: "team_acme",
    name: "Acme",
    slug: "acme",
    avatarUrl: null,
    budgetUsdMonthly: new Prisma.Decimal("750.00"),
    createdAt: NOW,
    updatedAt: NOW,
    ...over,
  };
}

describe("teams routes", () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  describe("auth", () => {
    beforeEach(async () => {
      app = await buildTestApp({ prisma: { team: { findMany: vi.fn() } } });
    });

    it("returns 401 when unauthenticated", async () => {
      const res = await app!.inject({ method: "GET", url: "/api/v1/teams" });
      expect(res.statusCode).toBe(401);
      expect(res.json().error.code).toBe("UNAUTHENTICATED");
    });
  });

  describe("GET /teams", () => {
    it("lists teams the caller belongs to (paginated)", async () => {
      const findMany = vi.fn(async () => [teamRow()]);
      app = await buildTestApp({ prisma: { team: { findMany } } });

      const res = await app.inject({
        method: "GET",
        url: "/api/v1/teams?limit=10",
        headers: { cookie: await sessionCookie() },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.nextCursor).toBeNull();
      expect(body.data).toHaveLength(1);
      // Serializer convention: dates → ISO strings, Decimal → number.
      expect(body.data[0]).toMatchObject({
        id: "team_acme",
        slug: "acme",
        budgetUsdMonthly: 750,
        createdAt: NOW.toISOString(),
      });
      // where scopes to the caller's memberships.
      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { members: { some: { userId: USER_ID } } },
        }),
      );
    });
  });

  describe("POST /teams", () => {
    it("creates a team with the creator as OWNER and writes an audit log", async () => {
      const create = vi.fn(async () => teamRow({ id: "team_new", slug: "new" }));
      const auditCreate = vi.fn(async () => ({ id: "audit_1" }));
      app = await buildTestApp({
        prisma: {
          team: { create },
          auditLog: { create: auditCreate },
        },
      });

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/teams",
        headers: { cookie: await sessionCookie() },
        payload: { name: "New", slug: "new", budgetUsdMonthly: 100 },
      });

      expect(res.statusCode).toBe(201);
      expect(res.json().slug).toBe("new");
      // creator becomes OWNER
      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            members: { create: { userId: USER_ID, role: "OWNER" } },
          }),
        }),
      );
      expect(auditCreate).toHaveBeenCalled();
    });

    it("returns 422 on an invalid body", async () => {
      app = await buildTestApp({ prisma: { team: { create: vi.fn() } } });
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/teams",
        headers: { cookie: await sessionCookie() },
        payload: { name: "", slug: "Invalid Slug!" },
      });
      expect(res.statusCode).toBe(422);
      expect(res.json().error.code).toBe("VALIDATION");
    });
  });

  describe("token team-scoping", () => {
    it("confines GET /teams to a token's bound team (no cross-team leak)", async () => {
      const findMany = vi.fn(async () => [teamRow({ id: "team_bound" })]);
      // A team-scoped API token: auth looks it up by hash, then best-effort
      // updates lastUsedAt. RBAC must constrain the list to teamId="team_bound".
      const tokenFindUnique = vi.fn(async () => ({
        id: "tok_1",
        userId: USER_ID,
        teamId: "team_bound",
        scopes: [],
        revokedAt: null,
        expiresAt: null,
      }));
      app = await buildTestApp({
        prisma: {
          team: { findMany },
          apiToken: {
            findUnique: tokenFindUnique,
            update: vi.fn(async () => ({})),
          },
        },
      });

      const res = await app.inject({
        method: "GET",
        url: "/api/v1/teams?limit=10",
        headers: { authorization: "Bearer sk_test_rawtoken" },
      });

      expect(res.statusCode).toBe(200);
      // The where must be AND-ed with the bound team id, not just userId.
      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "team_bound", members: { some: { userId: USER_ID } } },
        }),
      );
    });
  });

  describe("RBAC", () => {
    it("returns 403 on PATCH when the caller is below ADMIN", async () => {
      const findUnique = vi.fn(async () => ({ role: "MEMBER" }));
      app = await buildTestApp({
        prisma: {
          membership: { findUnique },
          team: { update: vi.fn() },
          auditLog: { create: vi.fn() },
        },
      });

      const res = await app.inject({
        method: "PATCH",
        url: "/api/v1/teams/team_acme",
        headers: { cookie: await sessionCookie() },
        payload: { name: "Renamed" },
      });

      expect(res.statusCode).toBe(403);
      expect(res.json().error.code).toBe("FORBIDDEN");
    });

    it("allows PATCH when the caller is ADMIN", async () => {
      const findUnique = vi.fn(async () => ({ role: "ADMIN" }));
      const update = vi.fn(async () => teamRow({ name: "Renamed" }));
      app = await buildTestApp({
        prisma: {
          membership: { findUnique },
          team: { update },
          auditLog: { create: vi.fn(async () => ({ id: "a" })) },
        },
      });

      const res = await app.inject({
        method: "PATCH",
        url: "/api/v1/teams/team_acme",
        headers: { cookie: await sessionCookie() },
        payload: { name: "Renamed" },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().name).toBe("Renamed");
      expect(update).toHaveBeenCalled();
    });
  });
});
