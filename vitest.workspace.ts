import { defineWorkspace } from 'vitest/config';

/**
 * Vitest workspace for the Shipyard monorepo.
 *
 * Each entry is a glob pointing at a project; Vitest discovers the nearest
 * `vitest.config.ts` / `vite.config.ts` (or the `test` field in a package's
 * config) for per-package settings such as environment and setup files.
 *
 * Run the entire suite from the repo root with `vitest run`, or scope to a
 * single project with `vitest run --project @shipyard/config`.
 */
export default defineWorkspace(['apps/*', 'packages/*']);
