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
```

See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for the full design.

## Quickstart (local)

```bash
pnpm install
cp .env.example .env            # then fill in secrets
pnpm infra:up                   # postgres + redis via docker
pnpm db:generate && pnpm db:migrate && pnpm db:seed
pnpm dev                        # web + api + worker
```

Dashboard: http://localhost:3000 · API: http://localhost:4000

## Status

Under active construction — see [`PROGRESS.md`](./PROGRESS.md).
