/**
 * Prisma plugin: decorates the Fastify instance with a `prisma` client.
 *
 * In production the shared `@shipyard/db` singleton is used; tests inject a
 * mock via the plugin options. The client is disconnected on server close.
 *
 * @module
 */

import fp from "fastify-plugin";

import { prisma as prismaSingleton } from "@shipyard/db";

import type { PrismaClient } from "@shipyard/db";
import type { FastifyInstance } from "fastify";

/** Options for the Prisma plugin. */
export interface PrismaPluginOptions {
  /** An injected Prisma client (tests); defaults to the shared singleton. */
  prisma?: PrismaClient;
}

/**
 * Register the Prisma plugin.
 *
 * @param app - The Fastify instance.
 * @param options - Optional injected client.
 */
async function prismaPlugin(
  app: FastifyInstance,
  options: PrismaPluginOptions,
): Promise<void> {
  const client = options.prisma ?? prismaSingleton;
  app.decorate("prisma", client);

  app.addHook("onClose", async () => {
    // Only disconnect the real singleton; injected mocks manage their own life.
    if (!options.prisma) {
      await client.$disconnect();
    }
  });
}

export default fp(prismaPlugin, { name: "prisma" });
