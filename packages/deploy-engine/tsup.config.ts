import { defineConfig } from "tsup";

/**
 * Build configuration for `@shipyard/deploy-engine`.
 *
 * Emits ESM JavaScript plus type declarations to `dist/`. The entry point is the
 * package barrel (`src/index.ts`); `dockerode` and `js-yaml` are kept external
 * so consumers resolve a single shared copy.
 */
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "es2022",
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  splitting: false,
  external: ["dockerode", "js-yaml", "@shipyard/core"],
});
