# Shipyard — Build Progress & Backlog

> Durable state for the autonomous build. Updated at the end of every work wave.
> If you are an agent resuming work: read this top-to-bottom, pick the next
> unchecked item in the lowest in-progress phase, and continue.

**Last updated:** 2026-06-14 (wave 0 — foundation)
**Current phase:** Phase 1 — Foundation & shared packages

## Status legend

- [ ] todo  ·  [~] in progress  ·  [x] done  ·  [!] blocked (needs user)

## Decisions log

- 2026-06-14: Monorepo = pnpm + turborepo. Stack per `ARCHITECTURE.md`.
- 2026-06-14: Domain model committed in `packages/db/prisma/schema.prisma`.

## Blocked-on-user (collect here for the return handoff)

- [!] GitHub App creation (App ID, private key, webhook secret) — needed for real
      PR webhook flow. Mock provider used until then.
- [!] GitHub OAuth app (login) client id/secret.
- [!] Production Docker host / Kubernetes target for real preview deploys.

---

## Phase 0 — Repo foundation  ✅

- [x] git init, monorepo scaffold (package.json, pnpm-workspace, turbo, tsconfig)
- [x] infra docker-compose (postgres + redis)
- [x] Prisma domain model
- [x] ARCHITECTURE.md, PROGRESS.md

## Phase 1 — Foundation & shared packages

- [ ] `packages/config` — shared tsconfig/eslint/prettier presets
- [ ] `packages/db` — client export, migrations, seed script, env crypto helpers
- [ ] `packages/core` — zod schemas, DTOs, domain types, status machines, errors
- [ ] `packages/deploy-engine` — dockerode wrapper, compose planner, teardown
- [ ] Root tooling: eslint, prettier, vitest config, CI workflow

## Phase 2 — Control-plane API (`apps/api`)

- [ ] Fastify bootstrap, config loader, pino logging, error handling
- [ ] Auth: session + GitHub OAuth, ApiToken auth, RBAC guards
- [ ] Resource routes: teams, projects, PRs, previews, deployments, builds,
      services, env vars/secrets, seeds, reviewers, costs, audit, tokens
- [ ] GitHub webhook ingestion (signature verify, idempotency, enqueue)
- [ ] Job enqueue integration (BullMQ producers)
- [ ] SSE/WS live logs + status streams
- [ ] OpenAPI spec + zod validation, healthcheck, metrics

## Phase 3 — Workers (`apps/worker`)

- [ ] BullMQ setup, queues, schedulers
- [ ] deploy worker (build → start stack → seed → health → RUNNING)
- [ ] cleanup worker (auto-stop idle, destroy closed-PR TTL)
- [ ] cost worker (sample stats → CostRecord → budget alerts)
- [ ] log relay (container logs → LogChunk + Redis pub/sub)

## Phase 4 — Dashboard (`apps/web`)

- [ ] App shell, auth, theming, design system (shadcn/ui)
- [ ] Previews list + detail (status, url, services, reviewers)
- [ ] Deployment status + live build/runtime logs viewer
- [ ] Failed builds view (error summaries, retry)
- [ ] Costs dashboard (per preview/project/team, budgets)
- [ ] Env vars & secrets management UI
- [ ] Projects & team settings, members, tokens
- [ ] Empty/loading/error states, responsive, a11y

## Phase 5 — Integration, tests, hardening

- [ ] End-to-end mock provider flow (PR → preview → destroy) working locally
- [ ] Unit + integration tests across packages (vitest)
- [ ] Seed/demo data for a believable dashboard
- [ ] Security pass (secret handling, authz, input validation, rate limits)
- [ ] Docs: README quickstart, CONTRIBUTING, API docs, runbook
- [ ] CI green (lint, typecheck, test, build)

## Phase 6 — Production readiness

- [ ] Dockerfiles for web/api/worker, prod compose, k8s manifests
- [ ] Observability (metrics, health, tracing hooks)
- [ ] Migration/runbook, backup notes, scaling notes
- [ ] Final adversarial review wave
