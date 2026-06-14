# syntax=docker/dockerfile:1.7
# ──────────────────────────────────────────────────────────────────────────
# Shipyard API (apps/api) — Fastify control plane.
#
# Multi-stage build. Build context MUST be the repo root:
#   docker build -f apps/api/Dockerfile -t shipyard-api .
#
# Stages:
#   base    – node:22-slim + corepack pnpm + OS libs Prisma needs.
#   deps    – install the full workspace from the lockfile (cached on manifests).
#   build   – generate the Prisma client and compile core/db/deploy-engine + api.
#   runtime – slim image: prod node_modules + dist + Prisma generated client.
#
# tsup keeps runtime deps EXTERNAL, so the runtime image must carry node_modules.
# We use pnpm's hoisted linker (see .npmrc), so deps live in the root
# node_modules and the workspace packages' dist dirs are resolved from there.
# ──────────────────────────────────────────────────────────────────────────

FROM node:22-slim AS base
ENV PNPM_HOME="/pnpm" \
    PATH="/pnpm:$PATH" \
    CI=true
# openssl + ca-certificates are required by the Prisma query engine at runtime;
# they are present in build & runtime stages because both derive from `base`.
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
WORKDIR /app

# ── deps: install once, cached on the manifests + lockfile ──────────────────
FROM base AS deps
# Copy only files that affect dependency resolution so this layer is reused
# whenever application source (but not deps) changes.
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

# ── build: compile the packages this app needs ─────────────────────────────
FROM deps AS build
COPY tsconfig.base.json turbo.json ./
COPY packages packages
COPY apps/api apps/api
# Generate the Prisma client (lands in packages/db/generated), then build the
# library packages followed by the API. Deps are external in tsup output.
RUN pnpm --filter @shipyard/db generate \
 && pnpm --filter @shipyard/core --filter @shipyard/db --filter @shipyard/deploy-engine build \
 && pnpm --filter @shipyard/api build

# ── runtime: minimal image that runs `node apps/api/dist/index.js` ─────────
FROM base AS runtime
ENV NODE_ENV=production \
    API_HOST=0.0.0.0 \
    API_PORT=4000
WORKDIR /app

# Root (hoisted) production node_modules — carries every external runtime dep.
COPY --from=build /app/node_modules ./node_modules
# Manifests (workspace resolution + package metadata).
COPY --from=build /app/package.json /app/pnpm-workspace.yaml ./
# Compiled API + the library packages' dist and the generated Prisma client.
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/apps/api/dist        ./apps/api/dist
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
# deterministically here so `node` resolves `@shipyard/core` etc. at runtime
# (the originals are not reliably carried across the multi-stage COPY).
RUN mkdir -p node_modules/@shipyard \
 && ln -sfn ../../packages/core         node_modules/@shipyard/core \
 && ln -sfn ../../packages/db           node_modules/@shipyard/db \
 && ln -sfn ../../packages/deploy-engine node_modules/@shipyard/deploy-engine

# Run as the unprivileged `node` user shipped in the base image.
USER node
EXPOSE 4000

# Liveness/readiness are served by the app at /healthz and /readyz; this
# container-level check hits liveness so Docker/Swarm can restart a wedged proc.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.API_PORT||4000)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "apps/api/dist/index.js"]
