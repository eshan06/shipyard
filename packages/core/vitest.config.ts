import { defineConfig } from "vitest/config";

/**
 * Vitest configuration for @shipyard/core.
 *
 * Tests live alongside source under `src/**` with a `.test.ts` suffix and run
 * in a Node environment (the package targets the server runtime).
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    globals: false,
  },
});
