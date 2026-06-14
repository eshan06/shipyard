# Shipyard — Build Progress & Backlog

> Durable state for the autonomous build. Updated at the end of every work wave.
> If you are an agent resuming work: read this top-to-bottom, then read
> `docs/ENGINEERING.md` and the memory note `fast-fs-build-location`, and
> continue the next unchecked item.

**Last updated:** 2026-06-14 (wave 1 — Phase 1 verified green; app scaffolding)
**Current phase:** Phase 2 — Control-plane API

## CRITICAL build note

Build on the **fast overlay fs** `/home/agent/build`, NOT the OneDrive mount
(`/c/Users/.../shipyard`), which is ~300x slower for installs/builds. `cd
/home/agent/build` for everything. Deliver by rsyncing source back to OneDrive at
each checkpoint (see `fast-fs-build-location` memory). Run
`bash scripts/strip-write-artifacts.sh` after every write wave (an editor tool
intermittently appends a `</content>` line) before typecheck/build.

## Status legend

- [ ] todo  ·  [~] in progress  ·  [x] done  ·  [!] blocked (needs user)

## Blocked-on-user (return handoff)

- [!] GitHub App (App ID, private key, webhook secret) — real PR webhook flow.
- [!] GitHub OAuth app (login) client id/secret.
- [!] Production Docker host / k8s target for real preview deploys.
- [!] Reinstall deps on the user's machine (`pnpm install`) — node_modules is
      built only on the sandbox fast fs, not synced to OneDrive.

---

## Phase 0 — Repo foundation  [x]

- [x] monorepo scaffold, infra docker-compose, Prisma model, ARCHITECTURE.md

## Phase 1 — Foundation & shared packages  [x]  (GREEN: 118 tests pass)

- [x] `packages/config` — tsconfig/eslint/prettier presets (+ tests)
- [x] `packages/core` — zod schemas, DTOs, status machines, crypto, cost, ids,
      errors, Result, and `jobs.ts` (queue/channel contracts) (54 tests)
- [x] `packages/db` — Prisma client singleton, seed (rich demo data) (7 tests)
- [x] `packages/deploy-engine` — planner, docker driver, orchestrator, mock (44 tests)
- [x] Root tooling: eslint, prettier, vitest workspace, CI workflow
- [x] `.env.example`, `docs/ENGINEERING.md` (cross-cutting contracts)
- [x] App `package.json` + tsconfig/tsup/eslint/vitest scaffolding (api, worker)

## Phase 2 — Control-plane API (`apps/api`)  [~]

- [ ] Foundation: config (zod env), server factory, plugins (prisma, redis,
      queues, auth, rbac, rate-limit, swagger, sse), error handler, route
      registry + stubs, health route, auth routes, teams reference router
- [ ] Feature routers + services: projects, PRs, previews (+actions),
      deployments, builds, services, env vars/secrets, seeds, reviews, costs,
      audit, tokens, notifications, webhooks (GitHub), SSE log/status streams
- [ ] OpenAPI, integration tests, adversarial security review + fixes

## Phase 3 — Workers (`apps/worker`)

- [ ] BullMQ setup; deploy / destroy-cleanup / cost / log-relay workers
      (deploy-engine Mock + Docker drivers); tests; review

## Phase 4 — Dashboard (`apps/web`)

- [ ] Design system + shell; previews list/detail; deployments + live logs;
      failed builds; costs; env/secrets UI; projects/team settings; states/a11y

## Phase 5 — Integration, tests, hardening, demo data

- [ ] E2E mock flow (PR→preview→destroy) vs real Postgres+Redis; security pass;
      docs (README/CONTRIBUTING/runbook); CI green

## Phase 6 — Production readiness

- [ ] Dockerfiles, prod compose, k8s, observability, runbook, final review
