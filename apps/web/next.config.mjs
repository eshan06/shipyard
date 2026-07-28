/**
 * Next.js configuration for the Shipyard dashboard.
 *
 * - `transpilePackages` lets us consume the workspace `@shipyard/core` package
 *   (shipped as TS/ESM) directly without a separate build step.
 *
 * The browser talks to the API **same-origin** via a catch-all Route Handler at
 * `src/app/api/v1/[...path]/route.ts` — NOT a `rewrites()` here. `next build`
 * freezes rewrite destinations into the routes manifest, so a rewrite would
 * read `NEXT_PUBLIC_API_URL` at BUILD time and the runtime env in prod would
 * have no effect. The Route Handler reads `process.env.API_URL` on every
 * request (RUNTIME), and preserves the same-origin cookie/SSE behaviour the
 * proxy exists for.
 *
 * @type {import('next').NextConfig}
 */

import path from "node:path";
import { fileURLToPath } from "node:url";

/** This file's directory (ESM has no `__dirname`). */
const DIR = path.dirname(fileURLToPath(import.meta.url));

/**
 * Whether this is a demo build (`pnpm demo:build`), which swaps the network
 * layer for an in-memory dataset. No other build may pay for it.
 */
const IS_DEMO = process.env.NEXT_PUBLIC_DEMO === "true";

const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@shipyard/core"],
  experimental: {
    // Rewrite `lucide-react` barrel imports (used across ~27 files) into
    // per-icon imports so the dev compiler and prod bundler only process the
    // handful of icons each route actually uses — meaningfully faster cold dev
    // compiles with no behavioural change.
    optimizePackageImports: ["lucide-react"],
  },
  // Lint runs as its own gate (`pnpm --filter @shipyard/web lint` / CI), not as
  // part of `next build`, so a stylistic lint nit never blocks a deploy build.
  // Type errors still fail the build (typescript.ignoreBuildErrors stays false).
  eslint: { ignoreDuringBuilds: true },

  /**
   * Turbopack equivalent of the webpack replacement below.
   *
   * `next dev` runs Turbopack and `next build --turbopack` is opt-in — neither
   * executes the `webpack()` callback, so without this the demo dataset would
   * quietly reappear in a Turbopack-built bundle.
   */
  ...(IS_DEMO
    ? {}
    : {
        turbopack: {
          resolveAlias: { "@/demo/backend": "./src/demo/backend.stub.ts" },
        },
      }),

  /**
   * Keep the demo backend out of every non-demo bundle.
   *
   * `demo-mode.tsx` guards its call with the build-time constant `IS_DEMO`,
   * which dead-codes the *call* — but `backend` → `store` → `data` all run
   * top-level side effects, so a bundler must keep the modules, and ~32 kB of
   * fixture data lands in the shared layout chunk of every page. Replacing the
   * module at resolve time is what actually excludes it.
   */
  webpack: (config, { webpack }) => {
    // Webpack's filesystem cache is not keyed on this callback, so switching
    // between `build` and `demo:build` in one working tree could otherwise
    // reuse modules compiled under the opposite setting — and ship the demo
    // dataset in a production bundle. Fold the mode into the cache version so
    // the two builds can never share entries.
    if (config.cache && typeof config.cache === "object") {
      config.cache.version = `${config.cache.version ?? ""}|demo=${IS_DEMO}`;
    }
    if (!IS_DEMO) {
      // Matches on the RESOLVED file path rather than the import request:
      // `@/*` is mapped by Next's tsconfig-paths resolver, which takes
      // precedence over `resolve.alias`, so an alias keyed on the request
      // string silently does nothing here.
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(
          /[\\/]src[\\/]demo[\\/]backend\.ts$/,
          path.resolve(DIR, "src/demo/backend.stub.ts"),
        ),
      );
    }
    return config;
  },
};

export default nextConfig;
