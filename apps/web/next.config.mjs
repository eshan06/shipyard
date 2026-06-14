/**
 * Next.js configuration for the Shipyard dashboard.
 *
 * - `transpilePackages` lets us consume the workspace `@shipyard/core` package
 *   (shipped as TS/ESM) directly without a separate build step.
 * - `rewrites` proxy `/api/v1/*` to the API service so that, in the browser,
 *   the dashboard can talk to the API same-origin. This avoids CORS friction
 *   and — crucially — lets `EventSource` (SSE) send the `sy_session` cookie,
 *   which it can only do for same-origin requests. The client therefore points
 *   all fetch/SSE traffic at the same origin (`/api/v1/...`).
 *
 * @type {import('next').NextConfig}
 */
const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@shipyard/core"],
  // Lint runs as its own gate (`pnpm --filter @shipyard/web lint` / CI), not as
  // part of `next build`, so a stylistic lint nit never blocks a deploy build.
  // Type errors still fail the build (typescript.ignoreBuildErrors stays false).
  eslint: { ignoreDuringBuilds: true },
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${apiUrl}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
