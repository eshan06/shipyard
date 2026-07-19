# Shipyard — Build Progress & Backlog

**Status:** Phases 0–8 complete + the 2026-07-18/19 verification passes: clean
prod build (7/7), the full stack run and driven from built artifacts (`next
start` + `node dist`), live SSE status pipeline made truthful end-to-end, the
real-DB integration suite un-skipped locally AND in CI, and deploy-artifact/env
docs reconciled with the shipped code. Remaining items are
provisioning/credentials (the `(you)` list below).
**→ For the production roadmap and next steps, see [`docs/GO_LIVE.md`](docs/GO_LIVE.md)**
(and [`docs/RESUME_PROMPT.md`](docs/RESUME_PROMPT.md) to resume).
**Last updated:** 2026-07-19 (prod-build verification + SSE/reconciliation
hardening + CI integration coverage + infra truth pass).

## Build note (for resuming agents)
The working tree (`C:\Users\toesh\newGithub\shipyard`) now builds **natively on
Windows**: `pnpm install`, all gates (`pnpm typecheck|lint|build|test`), Docker
Desktop, and `pnpm infra:up` all work in-place — the old sandbox-virtiofs symlink
constraint no longer applies. Two Windows-specific notes:
- Prisma's **schema/migration engine** can't resolve `localhost` (it tries IPv6
  `::1`); use `127.0.0.1` in `DATABASE_URL` for `prisma migrate`/`studio`. The
  Prisma *query* engine (app + seed) handles `localhost` fine.
- Turbo doesn't pass `DATABASE_URL` through to test tasks, so the DB-gated API
  integration tests skip under `pnpm test`; run them directly with the env set.

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
- [x] Phase 8 — Production hardening (2026-07-17). Worked the agent-owned go-live
      track; **the docker deploy path was validated end-to-end for the first time**
      (real build→run→route→harden→destroy against a live daemon). Highlights:
      • **Container isolation (P0):** every preview container now runs with Memory/
        NanoCpus/PidsLimit caps, `CapDrop:[ALL]` + a minimal cap set, no-new-privileges,
        an nofile ulimit, and ports published on `127.0.0.1` only (never 0.0.0.0).
        Verified on a live container by the e2e.
      • **Reverse proxy (P0):** Traefik (`infra/docker/preview-proxy.yml`) + per-preview
        routing labels on the ingress service over a shared edge network so
        `<slug>.<domain>` routes to the right container.
      • **Real deploys (P0):** the deploy worker now checks the PR commit out (git,
        path-traversal-guarded; GitHub App token for private repos) and injects the
        project's decrypted `EnvVar`s — previously it tar'd the worker's own cwd and
        never injected env.
      • **Web prod fix (P0):** replaced the build-time API rewrite (baked
        `localhost:4000`) with a runtime proxy route handler — the dashboard now works
        in prod compose/k8s.
      • **Concurrency/failure hardening (P1):** atomic compare-and-swap status
        transitions (no more resurrecting a DESTROYED preview / forcing illegal
        transitions), deploy supersession guard, final-attempt failure finalizer +
        leaked-container teardown, cleanup reconciler for stranded previews, log/cost
        retention, BullMQ `deduplication` for destroys, `upsertJobScheduler`, cost-gap
        clamp, seq-allocator fix, exit-on-uncaughtException.
      • **API security (P1):** token **scopes are now enforced** (was a no-op),
        cross-team PR-list leak closed, Swagger prod-gated, strict global CSP (+relaxed
        `/docs`), env-gated `TRUST_PROXY`, `SESSION_SECRET` min 32.
      • **Observability:** Prometheus `/metrics` on api + worker (prom-client).
      • **GitHub App integration in code** (installation tokens + PR commit status).
      • **Ops/CI:** compose prod env-flow fixed + self-ordering migrate + resource
        limits/log rotation; CI runs migrations + a docker-build matrix; new
        `release.yml` builds/pushes the 3 images to GHCR on a tag; k8s placeholder
        Secret renamed to `*.example.yaml` (no clobber-on-apply); `SECURITY.md` authored.
      • Web UX: real logout menu, error boundaries, honest chrome (no fabricated
        status/version), self-hosted fonts, mobile layout, auth-guard 401-only redirect.
      • Gates: **typecheck 11/11 · lint 11/11 · build 7/7 · 218 unit tests +
        5 live integration + docker e2e**. Fixes committed in logical commits (no
        co-author trailer, per the standing convention).

## Blocked-on-user (provisioning / credentials — the only things left for prod)
- [x] **Pushed to https://github.com/eshan06/shipyard** (private) — co-author-clean.
- [!] **GitHub App** (App ID + private key + webhook secret) — now *implemented in
      code* (`apps/worker/src/github.ts`); set `GITHUB_APP_ID`/`GITHUB_APP_PRIVATE_KEY`
      + a real `GITHUB_WEBHOOK_SECRET` to activate private-repo checkout + PR status.
- [!] **GitHub OAuth app** (client id/secret) for dashboard login; keep `DEV_AUTH=false`.
- [!] **A Docker host for the worker** (`DEPLOY_DRIVER=docker` + `DOCKER_HOST`/socket)
      and the preview reverse proxy up (`infra/docker/preview-proxy.yml`,
      `PREVIEW_EDGE_NETWORK=shipyard-edge`).
- [!] **Registry + GHCR push creds** (the `release.yml` uses the built-in GITHUB_TOKEN),
      **domains + wildcard DNS** (`*.<PREVIEW_BASE_DOMAIN>`), a **cluster** (ingress-nginx +
      cert-manager), managed **Postgres + Redis**, and the real **k8s Secret**
      (see `infra/k8s/20-secret.example.yaml` + `infra/k8s/README.md`).
- [!] Fill `[[SECURITY_CONTACT_EMAIL]]` in `SECURITY.md`; counsel review of `legal/`
      (public launch only).

## Known follow-ups (non-blocking)
- Container image size (~1.8–2GB) — slim via `pnpm deploy` / Next standalone.
- Session revocation is not implemented (stateless 30-day JWT); add a
  per-user token-version claim before high-value production traffic.
