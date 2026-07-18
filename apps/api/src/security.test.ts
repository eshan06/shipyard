/**
 * Tests for the transport-security posture wired in `app.ts` / `plugins/swagger`:
 *  - a strict, API-appropriate Content-Security-Policy applies to every
 *    response by default;
 *  - the OpenAPI spec + Swagger UI are served in development/test but NOT in
 *    production (they publish the whole API surface to anonymous callers).
 *
 * @module
 */

import { afterEach, describe, expect, it } from "vitest";

import { buildTestApp } from "./test/helpers.js";

import type { FastifyInstance } from "fastify";

describe("security posture", () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it("sends a strict default-src 'none' CSP on API responses", async () => {
    app = await buildTestApp();
    const res = await app.inject({ method: "GET", url: "/healthz" });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-security-policy"]).toContain(
      "default-src 'none'",
    );
    expect(res.headers["content-security-policy"]).toContain(
      "frame-ancestors 'none'",
    );
  });

  it("serves the OpenAPI spec + Swagger UI in development/test", async () => {
    app = await buildTestApp(); // NODE_ENV=test
    const spec = await app.inject({ method: "GET", url: "/openapi.json" });
    expect(spec.statusCode).toBe(200);
    expect(spec.json().info.title).toBe("Shipyard API");

    const docs = await app.inject({ method: "GET", url: "/docs" });
    // Swagger UI serves (200) or redirects to /docs/ (3xx); never a 404.
    expect(docs.statusCode).toBeLessThan(400);
  });

  it("does NOT expose the spec or docs in production", async () => {
    app = await buildTestApp({ config: { NODE_ENV: "production" } });

    const spec = await app.inject({ method: "GET", url: "/openapi.json" });
    expect(spec.statusCode).toBe(404);

    const docs = await app.inject({ method: "GET", url: "/docs" });
    expect(docs.statusCode).toBe(404);

    // The strict CSP still applies everywhere in production.
    const health = await app.inject({ method: "GET", url: "/healthz" });
    expect(health.headers["content-security-policy"]).toContain(
      "default-src 'none'",
    );
  });
});
