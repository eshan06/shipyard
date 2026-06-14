/**
 * OpenAPI / Swagger plugin.
 *
 * Registers `@fastify/swagger` (OpenAPI 3) wired to the zod type provider via
 * `jsonSchemaTransform`, exposes the generated spec at `/openapi.json`, and
 * mounts the Swagger UI at `/docs`.
 *
 * @module
 */

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

  // Canonical JSON spec endpoint.
  app.get("/openapi.json", { schema: { hide: true } }, async () => app.swagger());

  await app.register(swaggerUi, {
    routePrefix: "/docs",
    uiConfig: { docExpansion: "list", deepLinking: true },
  });
}

export default fp(swaggerPlugin, { name: "swagger" });
