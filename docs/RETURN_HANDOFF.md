# Shipyard — Return Handoff (what to do on your machine)

Built autonomously on 2026-06-14. Everything below is verified working in the
build sandbox. This file is the short version; see `README.md` (local dev),
`docs/DEPLOYMENT.md` (containers/k8s), `docs/RUNBOOK.md` (operating it), and
`docs/ENGINEERING.md` (conventions/contracts).

## What's built & verified
- **Monorepo** (pnpm + turbo): `packages/{config,core,db,deploy-engine}` +
  `apps/{api,worker,web}`. All typecheck/lint/build green.
- **Tests:** core 54, deploy-engine 46, config 13, db 7, api 20 (incl. real-DB
  integration), worker 33 — **173 total passing**.
- **Verified end-to-end (live):** a signed GitHub `pull_request` webhook →
  API (HMAC verify + idempotent) → preview QUEUED → worker (mock orchestrator)
  → **RUNNING with URL in ~1s**; secret env masking, team-scoped RBAC, 401 on
  unauth, the cleanup auto-stop scheduler, and the dashboard serving all 12
  routes with real data through the web→API proxy.
- **Containers:** Dockerfiles for api/worker/web built + smoke-tested (health
  checks pass); `infra/docker/docker-compose.prod.yml`; `infra/k8s/` manifests.

## 1. First run on your machine (≈5 min)
> Node 22, pnpm 9, Docker required. **`node_modules` is NOT in the repo** (it was
> built in the sandbox and is gitignored), so you must install first.

```bash
pnpm install                       # ~12s on a normal disk
cp .env.example .env               # then fill the two secrets below
#   SECRETS_ENCRYPTION_KEY:  openssl rand -base64 32
#   SESSION_SECRET:          openssl rand -hex 32
#   (leave DEV_AUTH=true and DEPLOY_DRIVER=mock for the demo)
pnpm infra:up                      # postgres + redis (docker)
pnpm db:migrate                    # apply migrations
pnpm db:seed                       # rich demo data (team Acme, 9 previews, etc.)
# three terminals (or use a process manager):
pnpm --filter @shipyard/api dev
pnpm --filter @shipyard/worker dev
pnpm --filter @shipyard/web dev
```
Open http://localhost:3000 → **dev-login as `alice@acme.dev`** (owner). Other
seeded users: bob@acme.dev (admin), carol/dave (member), erin (viewer).

### See the core loop live
```bash
# with api + worker running:
node scripts/e2e-webhook.mjs 1001   # fires a signed PR webhook → preview RUNNING
```

## 2. To use it for real (beyond the mock demo) — needs YOU
These can't be done from the sandbox; they need your accounts/secrets:

1. **GitHub App** (real PR webhooks + repo access): create one, set
   `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_WEBHOOK_SECRET`; point its
   webhook at `https://<your-api-host>/api/v1/webhooks/github`.
2. **GitHub OAuth app** (dashboard login instead of dev-login): set
   `GITHUB_OAUTH_CLIENT_ID` / `GITHUB_OAUTH_CLIENT_SECRET`; set `DEV_AUTH=false`
   in production.
3. **Real preview deploys:** set `DEPLOY_DRIVER=docker` and run the worker on a
   host with a Docker daemon (`DOCKER_HOST` if remote). The `deploy-engine`
   `DockerOrchestrator` builds + runs each preview's stack. (Mock driver needs
   no Docker and is great for the dashboard demo.)
4. **Kubernetes:** fill the `ghcr.io/OWNER/shipyard-*` image refs and hostnames
   in `infra/k8s/` (see `docs/DEPLOYMENT.md`).

## 3. Honest note on the "90% usage monitor" you asked for
There is no tool/API that exposes your account/plan usage percentage to me, and
if usage is exhausted the session simply pauses (nothing can poll). So I could
not implement that monitor without faking it. Instead I checkpointed every wave
to git **and** synced source to your OneDrive repo, so a pause/limit loses
nothing and the work resumes cleanly.

## 4. Known follow-ups (non-blocking)
- Container images are ~1.8–2 GB (full hoisted node_modules incl. dev deps;
  `pnpm prune --prod` breaks workspace symlinks under the hoisted linker). A
  `pnpm deploy`-based slim runtime is a worthwhile optimization — see
  `docs/DEPLOYMENT.md`.
- API uses `trustProxy: true`; deploy behind a proxy that strips/overwrites
  `X-Forwarded-For` (documented in `docs/RUNBOOK.md`) or make it env-bounded.
- `.env` was NOT synced to OneDrive (dev secrets kept local) — recreate it from
  `.env.example`.
