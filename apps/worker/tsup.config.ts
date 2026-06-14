import { defineConfig } from "tsup";

/**
 * Build configuration for `@shipyard/worker`.
 *
 * Bundles the worker entrypoint to ESM for `node dist/index.js`. Dependencies
 * (and workspace packages) stay external and resolve from node_modules at
 * runtime; only first-party `src` is bundled.
 */
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node22",
  platform: "node",
  sourcemap: true,
  clean: true,
  dts: false,
  splitting: false,
  skipNodeModulesBundle: true,
});
