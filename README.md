# ⚓ Shipyard

**Preview environments manager for full-stack teams.**

Every time a developer opens a pull request, Shipyard spins up a temporary, live
version of the app — deployed branch, seeded database, backend services,
protected secrets — and tears it down automatically when it is no longer needed.
Teammates click a preview link and test the *actual product change* in the
browser, not just read the diff.

Think Vercel preview deployments, but built for teams that need databases,
backend services, seeded data, and cleanup automation.

## Features

- 🚀 **Automatic previews** — a live environment per PR, updated on every push
- 🗄️ **Full stack** — web + API + database + cache + workers, not just a frontend
- 🌱 **Seeded test data** — believable data in every preview via seed templates
- 🔐 **Protected secrets** — env vars encrypted at rest, injected just-in-time
- 🧹 **Cleanup automation** — auto-stop idle previews, destroy on PR close
- 📊 **Dashboard** — active previews, deploy status, live logs, costs, reviewers,
  and failed builds at a glance
- 💸 **Cost tracking** — per-preview usage rolled up to dollars, with budgets

## Monorepo layout

```
apps/web        Next.js dashboard
apps/api        Fastify control-plane API (REST + webhooks + SSE)
apps/worker     BullMQ workers (deploy / cleanup / cost)
packages/db     Prisma schema, client, migrations, seed
packages/core   Shared zod schemas, types, crypto, status machines
packages/deploy-engine  Docker orchestration for preview stacks
packages/config Shared tsconfig / eslint / prettier
infra/docker    Local + production Docker Compose
infra/k8s       Kubernetes manifests
docs/           Engineering, deployment, and operations docs
```

See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for the full design.

## Quickstart (local development)

### Prerequisites

- **Node 22** (the repo pins `pnpm@9` via Corepack)
- **pnpm 9** — `corepack enable && corepack prepare pnpm@9.15.9 --activate`
- **Docker** (for local Postgres + Redis)

### 1. Install & start infra

```bash
pnpm install
pnpm infra:up                   # postgres + redis via docker compose
```

### 2. Configure environment

```bash
cp .env.example .env
```

Generate the two required secrets and put them in `.env`:

```bash
openssl rand -base64 32         # → SECRETS_ENCRYPTION_KEY (32-byte base64)
openssl rand -hex 32            # → SESSION_SECRET (≥ 32 chars)
```

Keep the dev-friendly defaults: `DEV_AUTH=true` (enables password-less login),
`DEPLOY_DRIVER=mock` (no Docker daemon needed for previews), and a
`GITHUB_WEBHOOK_SECRET` for the demo below. The `DATABASE_URL` / `REDIS_URL`
defaults already match `pnpm infra:up`.

### 3. Migrate & seed the database

```bash
pnpm db:generate                # generate the Prisma client
pnpm db:migrate                 # apply migrations
pnpm db:seed                    # rich demo data (team, projects, PRs, previews…)
```

### 4. Run the apps

```bash
pnpm dev                        # web + api + worker together (turbo)
```

…or run them individually in separate terminals:

```bash
pnpm --filter @shipyard/api dev       # http://localhost:4000  (OpenAPI at /docs)
pnpm --filter @shipyard/worker dev
pnpm --filter @shipyard/web dev       # http://localhost:3000
```

Dashboard: <http://localhost:3000> · API: <http://localhost:4000> ·
API docs: <http://localhost:4000/docs>

### 5. Log in

With `DEV_AUTH=true`, log in as the seeded user **`alice@acme.dev`** via the
dashboard's dev-login (or `POST /api/v1/auth/dev-login` with
`{"email":"alice@acme.dev"}`).

### 6. Demo: PR → live preview

With the api + worker running and `GITHUB_WEBHOOK_SECRET` set, fire a signed
GitHub `pull_request` webhook and watch the worker drive the new preview to
`RUNNING` (mock driver):

```bash
GITHUB_WEBHOOK_SECRET=<your value> node scripts/e2e-webhook.mjs
```

It dev-logs-in, POSTs a signed `opened` webhook, then polls the previews API
until the preview reports `RUNNING` with a URL. You'll see the same preview
appear (and stream logs) live in the dashboard.

## Health & API

- `GET /healthz` — liveness (api)
- `GET /readyz` — readiness; checks Postgres + Redis
- `GET /docs` — OpenAPI / Swagger UI

## Testing & checks

```bash
pnpm typecheck      # tsc --noEmit across the workspace
pnpm lint           # eslint / next lint
pnpm test           # vitest (unit + integration; needs postgres + redis up)
pnpm build          # turbo build of all packages/apps
```

CI runs all of these on every push/PR — see
[`.github/workflows/ci.yml`](./.github/workflows/ci.yml).

## Production

To build container images and deploy with Docker Compose or Kubernetes, see
[`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md). For operating the running system
(health, scaling, backups, failure modes, secret rotation) see
[`docs/RUNBOOK.md`](./docs/RUNBOOK.md). Contributors: see
[`CONTRIBUTING.md`](./CONTRIBUTING.md).

## Status

Feature-complete and production-hardened. The full stack runs locally today
(mock mode out of the box; the real Docker deploy path is implemented, hardened,
and end-to-end verified). What remains before a real launch is provisioning —
a Docker host / cluster, GitHub App + OAuth credentials, domains + DNS, a
registry, and managed Postgres/Redis. See [`docs/GO_LIVE.md`](./docs/GO_LIVE.md)
for the prioritized go-live checklist and [`PROGRESS.md`](./PROGRESS.md) for the
build log.
