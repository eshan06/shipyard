/**
 * Tests for the telemetry ingestion route: it requires auth, stamps the
 * authenticated principal onto each event (identity can't be spoofed by the
 * client), forwards the batch to the injected sink, and rejects invalid bodies.
 *
 * @module
 */

import { SignJWT } from "jose";
import { afterEach, describe, expect, it } from "vitest";

import { buildTestApp, TEST_CONFIG } from "../test/helpers.js";

import type { AnalyticsEvent, AnalyticsSink } from "../lib/analytics.js";
import type { FastifyInstance } from "fastify";

const USER_ID = "user_alice";

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

/** A sink that records every event it receives. */
function recordingSink(): AnalyticsSink & { events: AnalyticsEvent[] } {
  const events: AnalyticsEvent[] = [];
  return {
    events,
    track(event) {
      events.push(event);
    },
    async close() {},
  };
}

describe("telemetry routes", () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it("returns 401 when unauthenticated", async () => {
    app = await buildTestApp({ analytics: recordingSink() });
    const res = await app!.inject({
      method: "POST",
      url: "/api/v1/telemetry",
      payload: { events: [{ name: "page_viewed" }] },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe("UNAUTHENTICATED");
  });

  it("accepts a batch and stamps the authenticated user onto every event", async () => {
    const sink = recordingSink();
    app = await buildTestApp({ analytics: sink });

    const res = await app!.inject({
      method: "POST",
      url: "/api/v1/telemetry",
      headers: { cookie: await sessionCookie() },
      payload: {
        events: [
          { name: "page_viewed", properties: { path: "/" } },
          // A spoofed distinctId in properties must NOT become the identity.
          { name: "preview_redeployed", properties: { distinctId: "user_attacker", id: "p1" } },
        ],
      },
    });

    expect(res.statusCode).toBe(202);
    expect(res.json()).toEqual({ accepted: 2 });

    expect(sink.events).toHaveLength(2);
    expect(sink.events.every((e) => e.distinctId === USER_ID)).toBe(true);
    expect(sink.events[0]).toMatchObject({ name: "page_viewed", source: "web" });
    // The client-supplied properties are preserved verbatim, but identity is
    // taken from the session, not from the body.
    expect(sink.events[1]!.properties).toMatchObject({ id: "p1" });
  });

  it("returns 422 on an empty batch", async () => {
    app = await buildTestApp({ analytics: recordingSink() });
    const res = await app!.inject({
      method: "POST",
      url: "/api/v1/telemetry",
      headers: { cookie: await sessionCookie() },
      payload: { events: [] },
    });
    expect(res.statusCode).toBe(422);
    expect(res.json().error.code).toBe("VALIDATION");
  });

  it("returns 422 when an event is missing its name", async () => {
    app = await buildTestApp({ analytics: recordingSink() });
    const res = await app!.inject({
      method: "POST",
      url: "/api/v1/telemetry",
      headers: { cookie: await sessionCookie() },
      payload: { events: [{ properties: { a: 1 } }] },
    });
    expect(res.statusCode).toBe(422);
  });
});
