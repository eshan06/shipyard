/**
 * Build the dashboard in **demo mode**.
 *
 * Demo builds bake `NEXT_PUBLIC_DEMO=true` into the bundle, which swaps the
 * network layer for an in-memory dataset (`src/demo/`). The result runs with
 * no API, database, Redis or Docker behind it — suitable for hosting the
 * public demo next to a marketing site.
 *
 * `NEXT_PUBLIC_*` values are inlined by `next build`, so they must be set
 * here (at build time) rather than in the runtime environment. This wrapper
 * exists so the same command works on Windows and POSIX shells.
 *
 * It also builds this app's workspace dependencies first, so the command is
 * self-sufficient no matter where it is invoked from — including a host like
 * Vercel whose Root Directory is `apps/web`. `@shipyard/core`'s package
 * exports resolve to a compiled `dist/`, so without this a fresh clone fails
 * with `Module not found: Can't resolve '@shipyard/core/status'`.
 */

import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Repo root, from `apps/web/scripts/`. */
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

// Build this app's workspace dependencies. `@shipyard/core...` is core plus
// its own dependencies; core is the only workspace package `apps/web` imports.
// Filtering on it (rather than on web) keeps the app itself out of the graph,
// which would otherwise run a second, discarded non-demo `next build`. If web
// gains another workspace dependency, the build fails loudly with a
// `Module not found` — it cannot silently ship a stale one.
const deps = spawnSync("pnpm", ["--filter", "@shipyard/core...", "build"], {
  stdio: "inherit",
  cwd: REPO_ROOT,
  shell: true,
});
if (deps.status !== 0) process.exit(deps.status ?? 1);

/** Build-time public config for the demo bundle. */
const env = {
  ...process.env,
  NEXT_PUBLIC_DEMO: "true",
  // `mock` makes the dashboard's "Open" button route to the in-app simulated
  // preview instead of an unreachable external URL.
  NEXT_PUBLIC_DEPLOY_DRIVER: "mock",
  // No real auth server exists in the demo; the fake backend authenticates
  // every request, so the dev-login form would be dead UI.
  NEXT_PUBLIC_DEV_AUTH: "false",
  // Nothing to send telemetry to.
  NEXT_PUBLIC_ANALYTICS_ENABLED: "false",
  // Unused in demo mode (all traffic is intercepted) but keeps the client's
  // base-URL resolution from falling back to a confusing default.
  NEXT_PUBLIC_API_URL: "http://localhost:4000",
};

const result = spawnSync("next", ["build"], {
  stdio: "inherit",
  env,
  shell: true,
});

process.exit(result.status ?? 1);
