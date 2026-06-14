import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

/**
 * Vitest configuration for `@shipyard/web`.
 *
 * Unit tests target the pure, framework-agnostic logic (analytics buffering,
 * onboarding step derivation, …) in a Node environment — no DOM or running API
 * required, so the suite stays fast and runs in CI alongside typecheck + build.
 * The `@/…` alias mirrors the tsconfig path mapping so tests import modules the
 * same way app code does.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
    globals: false,
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
