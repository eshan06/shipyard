# Shipyard — Build Progress & Backlog

**Status:** Phases 0–7 complete. Near production-ready. See `docs/RETURN_HANDOFF.md`.
**Last updated:** 2026-06-15 (polish track — legal pack, analytics seam, onboarding)

## Build note (for resuming agents)
Moving off OneDrive did NOT fix the filesystem: the working tree
(`C:\Users\toesh\newGithub\shipyard`) is a **virtiofs bind mount** that rejects
symlinks (pnpm's default linker fails with `ERR_PNPM_EPERM symlink`) and is slow
for IO. Keep `.git` + source here and **commit here**, but build/verify on the
fast `overlay` FS mirror at `/home/agent/build/shipyard`:
- `bash /home/agent/sync.sh`  — rsync canonical → mirror (preserves node_modules/dist/.next/.turbo/generated)
- `bash /home/agent/gate.sh [typecheck|build|test|all]`  — run gates on the mirror
- one-time mirror setup: `pnpm install --store-dir /home/agent/.pnpm-store` then `pnpm --filter @shipyard/db generate`

The committed `.npmrc` is intentionally clean (default symlinked linker) — correct
for real environments (Windows native, CI, Docker); the symlink issue is
sandbox-virtiofs-only. The old write-glitch (`</content>` trailing artifact) is
gone. See the `build-on-fast-fs-mirror` memory.

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
- [x] Phase 7 — Polish track (2026-06-15):
      • Counsel-ready legal pack in `legal/` (ToS, Privacy, DPA, AUP, Subprocessors,
        Cookie, DMCA + README + COUNSEL_REVIEW_CHECKLIST) — tailored to Shipyard,
        flagged DRAFT/[[placeholders]]/⚠️ COUNSEL. **Lawyer review required before use.**
      • Product analytics: the `trackEvent` seam (web) → `POST /api/v1/telemetry`
        (auth-required, server-stamped identity) → pluggable `app.analytics` sink
        (`ANALYTICS_DRIVER=log|http|posthog`, default `log` = durable structured events).
        Instrumented login/logout, page views, preview actions, token create/revoke.
      • First-run onboarding checklist on the Overview page (derives steps from live
        data; dismissible; emits onboarding events) + `docs/ONBOARDING.md`.
      • Added the web test suite (vitest config + 11 tests) — fixes the previously-red
        web `test` gate. History rewritten to drop the Claude co-author trailer.

## Blocked-on-user (return handoff — see docs/RETURN_HANDOFF.md)
- [x] **Pushed to https://github.com/eshan06/shipyard** (private, 2026-06-15) —
      co-author-clean history; only `main` pushed (backup tag kept local).
- [!] `pnpm install` on your machine (node_modules not synced).
- [!] GitHub App (App ID/private key/webhook secret) for real PR webhooks.
- [!] GitHub OAuth app (client id/secret) for dashboard login; set DEV_AUTH=false.
- [!] DEPLOY_DRIVER=docker + a Docker host for real (non-mock) preview deploys.
- [!] Fill k8s image refs/hostnames in infra/k8s/.

## Known follow-ups (non-blocking)
- Container image size (~1.8–2GB) — slim via `pnpm deploy` (docs/DEPLOYMENT.md).
- Bound `trustProxy` to the real proxy / deploy behind XFF-stripping proxy.
