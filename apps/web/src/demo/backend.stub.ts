/**
 * No-op stand-in for the demo backend, swapped in at build time.
 *
 * `next.config.mjs` aliases `@/demo/backend` to this file unless the build sets
 * `NEXT_PUBLIC_DEMO=true`. Without the swap, the static import chain
 * (`demo-mode.tsx` → `backend` → `store` → `data`) would pull the entire demo
 * dataset into the shared layout chunk of every page — the dead-code guard
 * removes the *call*, but the modules have top-level side effects, so a
 * bundler cannot drop them.
 *
 * @module
 */

/** Does nothing: production builds have a real backend. */
export function installDemoBackend(): void {
  /* no-op */
}
