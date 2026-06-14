import { defineConfig } from "tsup";

/**
 * Build configuration for `@shipyard/db`.
 *
 * The package ships a single ESM entrypoint that re-exports the singleton
 * Prisma client together with the generated model/enum types. The generated
 * Prisma client (under `../generated/client`) is treated as an external runtime
 * dependency so we don't bundle the (large) query engine wiring into `dist`.
 */
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "es2022",
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  // Keep Prisma's generated client + runtime external — it is resolved at
  // runtime from the generated output and `@prisma/client`.
  external: ["@prisma/client", /^\.\.\/generated\//],
});
