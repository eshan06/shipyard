/**
 * Tests for the health/readiness routes.
 *
 * @module
 */

import { afterEach, describe, expect, it } from "vitest";

import { buildTestApp } from "../test/helpers.js";

import type { FastifyInstance } from "fastify";

describe("health routes", () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it("GET /healthz returns ok", async () => {
    app = await buildTestApp();
    const res = await app.inject({ method: "GET", url: "/healthz" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: "ok" });
  });

  it("GET /readyz returns 200 when db + redis are healthy", async () => {
    app = await buildTestApp({
      prisma: { $queryRaw: async () => [{ "?column?": 1 }] },
    });
    const res = await app.inject({ method: "GET", url: "/readyz" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: "ready", db: true, redis: true });
  });

  it("GET /readyz returns 503 when the db check fails", async () => {
    app = await buildTestApp({
      prisma: {
        $queryRaw: async () => {
          throw new Error("db down");
        },
      },
    });
    const res = await app.inject({ method: "GET", url: "/readyz" });
    expect(res.statusCode).toBe(503);
    const body = res.json();
    expect(body.status).toBe("not_ready");
    expect(body.db).toBe(false);
    expect(body.redis).toBe(true);
  });
});
