/**
 * OpenAPI / Swagger plugin.
 *
 * Registers `@fastify/swagger` (OpenAPI 3) wired to the zod type provider via
 * `jsonSchemaTransform` so `app.swagger()` can generate the spec for internal
 * use. In **non-production** it also exposes the generated spec at
 * `/openapi.json` and mounts the Swagger UI at `/docs`.
 *
 * ## SECURITY (do not regress)
 *
 * The raw spec and the Swagger UI publish the entire API surface (every route,
 * schema, and auth scheme) to anonymous callers. That is a developer
 * convenience, not something to serve in production, so in production we
 * register neither the `/openapi.json` route nor the `/docs` UI — only the
 * in-process spec generator. The global helmet CSP (see `app.ts`) is strict;
 * because the Swagger UI needs inline styles/scripts, this plugin registers a
 * relaxed CSP scoped to the `/docs` subtree only, and that relaxed scope never
 * exists in production.
 *
 * @module
 */

import helmet from "@fastify/helmet";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import fp from "fastify-plugin";
import { jsonSchemaTransform } from "fastify-type-provider-zod";

import type { FastifyInstance } from "fastify";

/**
 * Register the Swagger/OpenAPI plugin.
 *
 * @param app - The Fastify instance.
 */
async function swaggerPlugin(app: FastifyInstance): Promise<void> {
  // Always register the generator: this alone exposes NO HTTP route, it just
  // makes `app.swagger()` available for internal/spec-generation use.
  await app.register(swagger, {
    openapi: {
      openapi: "3.1.0",
      info: {
        title: "Shipyard API",
        description:
          "Shipyard control-plane API: previews, deployments, builds, " +
          "teams, auth, webhooks, and live SSE streams.",
        version: "0.1.0",
      },
      servers: [{ url: app.config.PUBLIC_API_URL }],
      components: {
        securitySchemes: {
          bearerToken: {
            type: "http",
            scheme: "bearer",
            description: "API token: `Authorization: Bearer shipyard_…`",
          },
          sessionCookie: {
            type: "apiKey",
            in: "cookie",
            name: "sy_session",
            description: "Browser session cookie (signed JWT).",
          },
        },
      },
    },
    transform: jsonSchemaTransform,
  });

  // SECURITY: never publish the spec or the interactive docs in production.
  if (app.config.NODE_ENV === "production") return;

  // Canonical JSON spec endpoint (dev/test only).
  app.get("/openapi.json", { schema: { hide: true } }, async () => app.swagger());

  // Mount the Swagger UI inside an encapsulated scope that relaxes the CSP just
  // for the /docs subtree (swagger-ui needs inline styles/scripts). The global
  // strict CSP from app.ts still applies to every other route.
  await app.register(async (docs) => {
    await docs.register(helmet, {
      contentSecurityPolicy: {
        useDefaults: false,
        directives: {
          "default-src": ["'self'"],
          "base-uri": ["'self'"],
          "style-src": ["'self'", "'unsafe-inline'"],
          "script-src": ["'self'", "'unsafe-inline'"],
          "img-src": ["'self'", "data:"],
          "frame-ancestors": ["'none'"],
        },
      },
    });
    await docs.register(swaggerUi, {
      routePrefix: "/docs",
      uiConfig: { docExpansion: "list", deepLinking: true },
    });
  });
}

export default fp(swaggerPlugin, { name: "swagger" });
