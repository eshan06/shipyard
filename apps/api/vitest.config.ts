import { defineConfig } from "vitest/config";

/**
 * Vitest configuration for `@shipyard/api`.
 *
 * Unit tests run in a Node environment with no live database/redis — services
 * are exercised against mocked Prisma clients and in-memory fakes. Integration
 * tests that require real infra are gated behind environment variables.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    globals: false,
  },
});
