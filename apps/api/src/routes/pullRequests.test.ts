/**
 * Tests for the pull-requests router's list confinement.
 *
 * The unfiltered `GET /pull-requests` branch must confine a team-scoped API
 * token to its bound team (mirroring the other list routes), so a token whose
 * owner belongs to several teams cannot read PR data across all of them. A
 * session caller is scoped only by membership (all their teams), as before.
 *
 * @module
 */

import { SignJWT } from "jose";
import { afterEach, describe, expect, it, vi } from "vitest";

import { buildTestApp, TEST_CONFIG } from "../test/helpers.js";

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

describe("GET /pull-requests confinement", () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it("confines a team-scoped token's PR list to its bound team", async () => {
    const findMany = vi.fn(async () => []);
    app = await buildTestApp({
      prisma: {
        pullRequest: { findMany },
        apiToken: {
          findUnique: vi.fn(async () => ({
            id: "tok_1",
            userId: USER_ID,
            teamId: TEAM_ID,
            scopes: ["previews:read"],
            revokedAt: null,
            expiresAt: null,
          })),
          update: vi.fn(async () => ({})),
        },
      },
    });

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/pull-requests?limit=10",
      headers: { authorization: "Bearer sk_test_rawtoken" },
    });

    expect(res.statusCode).toBe(200);
    // The where.project must be AND-ed with the token's bound team id.
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          project: {
            teamId: TEAM_ID,
            team: { members: { some: { userId: USER_ID } } },
          },
        },
      }),
    );
  });

  it("scopes a session caller to their memberships (no team confinement)", async () => {
    const findMany = vi.fn(async () => []);
    app = await buildTestApp({ prisma: { pullRequest: { findMany } } });

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/pull-requests?limit=10",
      headers: { cookie: await sessionCookie() },
    });

    expect(res.statusCode).toBe(200);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { project: { team: { members: { some: { userId: USER_ID } } } } },
      }),
    );
  });
});
