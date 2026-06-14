import { defineConfig } from "vitest/config";

/**
 * Vitest configuration for `@shipyard/worker`.
 *
 * Tests run in a Node environment and must NOT require a live Docker daemon,
 * database, or redis — workers are tested against the deploy-engine
 * `MockOrchestrator` and mocked Prisma/queue clients.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    globals: false,
  },
});
