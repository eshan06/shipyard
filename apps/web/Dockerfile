# syntax=docker/dockerfile:1.7
# ──────────────────────────────────────────────────────────────────────────
# Shipyard web (apps/web) — Next.js 15 dashboard (App Router), run with
# `next start`. Build context MUST be the repo root:
#   docker build -f apps/web/Dockerfile -t shipyard-web .
#
# The dashboard talks to the API *same-origin* via a Next rewrite whose
# destination is NEXT_PUBLIC_API_URL, read at RUNTIME in next.config.mjs. So the
# API URL is configured by env at container start, NOT baked at build time —
# point it at the in-cluster/service API (e.g. http://api:4000).
#
# Stages: base → deps → build (next build → .next) → runtime (next start).
# ──────────────────────────────────────────────────────────────────────────

FROM node:22-slim AS base
ENV PNPM_HOME="/pnpm" \
    PATH="/pnpm:$PATH" \
    CI=true
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
WORKDIR /app

# ── deps ───────────────────────────────────────────────────────────────────
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml .npmrc package.json ./
COPY apps/api/package.json            apps/api/package.json
COPY apps/worker/package.json         apps/worker/package.json
COPY apps/web/package.json            apps/web/package.json
COPY packages/config/package.json     packages/config/package.json
COPY packages/core/package.json       packages/core/package.json
COPY packages/db/package.json         packages/db/package.json
COPY packages/deploy-engine/package.json packages/deploy-engine/package.json
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile

# ── build: build @shipyard/core (consumed via transpilePackages) then web ───
FROM deps AS build
ENV NEXT_TELEMETRY_DISABLED=1
COPY tsconfig.base.json turbo.json ./
COPY packages/core packages/core
COPY apps/web apps/web
RUN pnpm --filter @shipyard/core build \
 && pnpm --filter @shipyard/web build

# ── runtime: `next start` serving the built .next output ────────────────────
FROM base AS runtime
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
WORKDIR /app

# Hoisted node_modules (carries `next`, react, and the transpiled core dep).
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json /app/pnpm-workspace.yaml ./
# The Next.js config is read at runtime (rewrites destination, transpilePackages).
COPY --from=build /app/apps/web/package.json   ./apps/web/package.json
COPY --from=build /app/apps/web/next.config.mjs ./apps/web/next.config.mjs
COPY --from=build /app/apps/web/.next          ./apps/web/.next
# Workspace core dep resolved by the Next server at runtime.
COPY --from=build /app/packages/core/package.json ./packages/core/package.json
COPY --from=build /app/packages/core/dist         ./packages/core/dist

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# `next start -p 3000` via the workspace script; binds 0.0.0.0 by default.
CMD ["pnpm", "--filter", "@shipyard/web", "start"]
