import { defineConfig } from "tsup";

/**
 * Build configuration for @shipyard/core.
 *
 * Emits a single ESM bundle plus type declarations to `dist/`, matching the
 * package's `exports` map (`import` + `types`). `zod` and `nanoid` are runtime
 * dependencies and are left external so consumers dedupe a single copy.
 */
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "es2022",
  platform: "node",
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  splitting: false,
  external: ["zod", "nanoid"],
});
