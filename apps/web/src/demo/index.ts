/**
 * Demo-mode flag.
 *
 * Demo mode turns the dashboard into a self-contained, backend-free build:
 * all `/api/v1` traffic and SSE streams are served from an in-memory dataset
 * (see `./backend`), so the app can be hosted with no API, database, Redis or
 * Docker behind it. Enabled at build time with `NEXT_PUBLIC_DEMO=true`.
 *
 * This module deliberately exports **only the flag** and re-exports nothing
 * from `./backend`: pulling the backend through here would make every importer
 * of `IS_DEMO` drag in the demo dataset. Import `installDemoBackend` straight
 * from `@/demo/backend`, which `next.config.mjs` swaps for a no-op stub in
 * non-demo builds.
 *
 * @module
 */

/**
 * Whether this bundle was built in demo mode.
 *
 * Read from a `NEXT_PUBLIC_*` variable so the value is inlined at build time.
 */
export const IS_DEMO = process.env.NEXT_PUBLIC_DEMO === "true";
