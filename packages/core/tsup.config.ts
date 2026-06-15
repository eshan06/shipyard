import { defineConfig } from "tsup";

/**
 * Build configuration for @shipyard/core.
 *
 * Emits ESM bundles plus type declarations to `dist/`, matching the package's
 * `exports` map (`import` + `types`). `zod` and `nanoid` are runtime
 * dependencies and are left external so consumers dedupe a single copy.
 *
 * `status.ts` is built as its OWN entry (`@shipyard/core/status`) because it is
 * dependency-free (status display maps + transition tables). The browser
 * dashboard imports the display maps from this subpath so it never pulls the
 * full barrel — which transitively drags `node:crypto`/`zod`/`nanoid` into the
 * client bundle (~140kB gz). Keep this entry free of runtime imports.
 */
export default defineConfig({
  entry: ["src/index.ts", "src/status.ts"],
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
