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
};

export default nextConfig;
