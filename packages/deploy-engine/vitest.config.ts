import { defineConfig } from "vitest/config";

/**
 * Vitest configuration for `@shipyard/deploy-engine`.
 *
 * Tests run in a Node environment and must NOT require a live Docker daemon —
 * the planner is pure and the orchestrator under test is the in-memory mock.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    globals: false,
  },
});
