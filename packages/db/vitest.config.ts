import { defineConfig } from "vitest/config";

/**
 * Vitest configuration for `@shipyard/db`.
 *
 * Tests run in a Node environment and never touch a real database — the
 * generated Prisma client is mocked, so no `prisma generate` or running
 * Postgres is required to exercise the unit suite.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    globals: false,
  },
});
