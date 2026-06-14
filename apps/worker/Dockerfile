# syntax=docker/dockerfile:1.7
# ──────────────────────────────────────────────────────────────────────────
# Shipyard worker (apps/worker) — BullMQ deploy / destroy / cleanup / cost jobs.
#
# Multi-stage build. Build context MUST be the repo root:
#   docker build -f apps/worker/Dockerfile -t shipyard-worker .
#
# Stages mirror the API image (base → deps → build → runtime). The worker uses
# the deploy-engine (dockerode) to orchestrate per-PR preview stacks; when
# DEPLOY_DRIVER=docker it talks to a Docker daemon via DOCKER_HOST (or the
# mounted /var/run/docker.sock). tsup keeps deps external, so the runtime image
# carries node_modules + dist + the generated Prisma client.
# ──────────────────────────────────────────────────────────────────────────

FROM node:22-slim AS base
ENV PNPM_HOME="/pnpm" \
    PATH="/pnpm:$PATH" \
    CI=true
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
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

# ── build ────────────────────────────────────────────────────────────────
FROM deps AS build
COPY tsconfig.base.json turbo.json ./
COPY packages packages
COPY apps/worker apps/worker
RUN pnpm --filter @shipyard/db generate \
 && pnpm --filter @shipyard/core --filter @shipyard/db --filter @shipyard/deploy-engine build \
 && pnpm --filter @shipyard/worker build

# ── runtime ────────────────────────────────────────────────────────────────
FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /app

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json /app/pnpm-workspace.yaml ./
COPY --from=build /app/apps/worker/package.json ./apps/worker/package.json
COPY --from=build /app/apps/worker/dist         ./apps/worker/dist
COPY --from=build /app/packages/core/package.json        ./packages/core/package.json
COPY --from=build /app/packages/core/dist                ./packages/core/dist
COPY --from=build /app/packages/db/package.json          ./packages/db/package.json
COPY --from=build /app/packages/db/dist                  ./packages/db/dist
COPY --from=build /app/packages/db/prisma                ./packages/db/prisma
COPY --from=build /app/packages/db/generated             ./packages/db/generated
COPY --from=build /app/packages/deploy-engine/package.json ./packages/deploy-engine/package.json
COPY --from=build /app/packages/deploy-engine/dist        ./packages/deploy-engine/dist

# Wire the workspace packages into node_modules. With pnpm's hoisted linker the
# `@shipyard/*` entries are plain symlinks into ../../packages/*; recreate them
# deterministically so `node` resolves `@shipyard/core` etc. at runtime (the
# originals are not reliably carried across the multi-stage COPY).
RUN mkdir -p node_modules/@shipyard \
 && ln -sfn ../../packages/core         node_modules/@shipyard/core \
 && ln -sfn ../../packages/db           node_modules/@shipyard/db \
 && ln -sfn ../../packages/deploy-engine node_modules/@shipyard/deploy-engine

# The worker is a headless background process — no HTTP port, no HEALTHCHECK.
# Liveness is observed via BullMQ job throughput and structured pino logs; see
# docs/RUNBOOK.md. It exits non-zero on a fatal boot/config error so the
# supervisor restarts it.
USER node

CMD ["node", "apps/worker/dist/index.js"]
