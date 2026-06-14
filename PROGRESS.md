# Shipyard — Build Progress & Backlog

**Status:** Phases 0–6 complete. Near production-ready. See `docs/RETURN_HANDOFF.md`.
**Last updated:** 2026-06-14 (final wave — review fixes + production hardening)

## Build note (for resuming agents)
Build on the fast overlay fs `/home/agent/build` (the OneDrive mount is ~300x
slower for IO). `cd /home/agent/build` for everything; deliver via
`bash scripts/sync-to-onedrive.sh`. Run `bash scripts/strip-write-artifacts.sh`
after write waves. See the `fast-fs-build-location` memory.

## Done
- [x] Phase 0 — repo/monorepo foundation, infra compose, Prisma model, docs
- [x] Phase 1 — packages: config, core (+jobs contract), db (+seed), deploy-engine
      (planner/docker/mock). 120 package tests green.
- [x] Phase 2 — apps/api (Fastify): config/app/plugins (prisma/redis/queues/auth/
      swagger), error handler, rbac, pagination, audit, serialize, SSE; routers:
      health, auth (dev-login + GitHub OAuth), me, teams, projects, previews
      (+actions), deployments+builds, env vars/secrets, seeds, tokens, services/
      reviews/costs, pull-requests/notifications/audit, GitHub webhooks, SSE
      streams. 20 tests incl. real-DB integration. Adversarial security review
      applied (token team-scoping fix, etc.).
- [x] Phase 3 — apps/worker (BullMQ): deploy/destroy workers, cleanup + cost
      schedulers, event publisher (LogChunk + redis pub/sub). 33 tests.
- [x] Phase 4 — apps/web (Next 15 + Tailwind + Radix): design system, shell,
      typed API client + SWR + SSE; pages: overview, previews(list/detail+live
      logs+actions), deployments(+detail), builds, costs(charts), projects(+env/
      secrets/seeds/settings), settings/team(members+tokens), login. 12 routes,
      lint/typecheck/build green.
- [x] Phase 5 — DB migrated + seeded; **end-to-end verified live** (PR webhook →
      RUNNING preview via mock orchestrator; scripts/e2e-webhook.mjs); full-stack
      run verified (web→API proxy + auth + data).
- [x] Phase 6 — Dockerfiles (api/worker/web, built+smoke-tested), prod compose,
      k8s manifests, DEPLOYMENT.md, RUNBOOK.md, README quickstart, CONTRIBUTING,
      final adversarial review wave + fixes. RETURN_HANDOFF.md for the user.

## Blocked-on-user (return handoff — see docs/RETURN_HANDOFF.md)
- [!] `pnpm install` on your machine (node_modules not synced).
- [!] GitHub App (App ID/private key/webhook secret) for real PR webhooks.
- [!] GitHub OAuth app (client id/secret) for dashboard login; set DEV_AUTH=false.
- [!] DEPLOY_DRIVER=docker + a Docker host for real (non-mock) preview deploys.
- [!] Fill k8s image refs/hostnames in infra/k8s/.

## Known follow-ups (non-blocking)
- Container image size (~1.8–2GB) — slim via `pnpm deploy` (docs/DEPLOYMENT.md).
- Bound `trustProxy` to the real proxy / deploy behind XFF-stripping proxy.
