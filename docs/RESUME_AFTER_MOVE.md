# Shipyard — Resume Handoff (after moving the repo out of OneDrive)

> Read this FIRST when resuming. Written 2026-06-14 at the end of the build
> session, right before the repo is moved from OneDrive to a fast local disk.
> Companion docs: `PROGRESS.md`, `docs/ENGINEERING.md`, `docs/RETURN_HANDOFF.md`,
> `docs/DEPLOYMENT.md`, `docs/RUNBOOK.md`.

## 0) Why this file exists
The repo used to live on a OneDrive-backed mount that made `pnpm install` take
>1h and fail (EACCES on renames; no symlinks). Workaround that session: build on
a fast sandbox FS (`/home/agent/build`) and rsync source back to OneDrive. Now
the repo has been moved to a normal local path, so that workaround is GONE and we
build directly in the working tree. Claude's auto-memory was keyed to the old
OneDrive path and will NOT auto-load at the new path — THIS in-repo doc is the
source of truth.

## 1) What we did this session (Phases 0–6, all green)
Built **Shipyard**, a preview-environments manager (Vercel-preview-style but
full-stack), as a pnpm + turbo monorepo. Feature-complete & near production-ready.
- `packages/core` (zod DTOs, status machines, AES-256-GCM crypto, cost calc,
  BullMQ job/redis-channel contracts), `packages/db` (Prisma + 3 migrations +
  rich seed), `packages/deploy-engine` (compose planner, Docker driver, Mock
  orchestrator), `packages/config`.
- `apps/api` — Fastify 5: REST `/api/v1`, GitHub webhooks (HMAC + idempotent),
  cookie + API-token auth, team-scoped RBAC, AES-GCM secret masking, BullMQ
  producers, SSE log/status streams, OpenAPI `/docs`.
- `apps/worker` — BullMQ deploy/destroy/cleanup/cost workers + schedulers.
- `apps/web` — Next 15 + React 19 + Tailwind + Radix dashboard, 12 routes
  (overview, previews list/detail+live logs+actions, deployments+detail, builds,
  costs charts, projects+env/secrets/seeds/settings, team settings, login).
- Verified: `turbo typecheck` 11/11, `turbo build` 7/7, **173 tests**. Live e2e:
  signed PR webhook → preview RUNNING in ~1s (`scripts/e2e-webhook.mjs`). Docker
  images built+smoke-tested; prod compose + k8s + docs. Adversarial security
  review (one token-scoping fix applied). Git: ~9 commits on `main`, HEAD was
  `53306db` at move time.

## 2) FIRST THINGS TO RUN now that it's on a fast local disk
From the repo root (confirm path with `pwd`; expected something like
`/c/Users/toesh/GitHub/shipyard`):
1. `pnpm install`  — should now take ~10–20s (not 1h). No EACCES.
2. Recreate `.env` (it was NOT synced — dev secrets kept local):
   `cp .env.example .env` then set
   `SECRETS_ENCRYPTION_KEY=$(openssl rand -base64 32)` and
   `SESSION_SECRET=$(openssl rand -hex 32)`; keep `DEV_AUTH=true`,
   `DEPLOY_DRIVER=mock` for local.
3. `pnpm infra:up` (postgres+redis), `pnpm db:migrate`, `pnpm db:seed`.
4. Sanity: `pnpm typecheck` (11/11), `pnpm test` per package, and the demo:
   run api+worker (`pnpm --filter @shipyard/api dev`, `... worker dev`) then
   `node scripts/e2e-webhook.mjs 1001` → expect preview RUNNING.

## 3) CLEANUP / changes to make post-move (do these early)
- **Revert `.npmrc` FS workarounds.** It currently forces the slow copy linker
  for the symlink-less OneDrive mount:
  ```
  node-linker=hoisted
  shamefully-hoist=true
  ```
  On a normal disk, delete BOTH lines (keep `auto-install-peers=true`,
  `strict-peer-dependencies=false`) so pnpm uses its faster default symlinked
  layout, then re-run `pnpm install` and re-verify `turbo build`. Commit.
- **Obsolete sandbox/OneDrive-only scripts** (safe to delete, were workarounds):
  `scripts/sync-to-onedrive.sh`, `scripts/robust-install.sh`. Keep
  `scripts/e2e-webhook.mjs` (real asset). `scripts/strip-write-artifacts.sh` was
  for an editor `</content>` write-glitch on the mount — test if it still occurs;
  likely droppable now.
- **Build directly in the working tree** — do NOT recreate the `/home/agent/build`
  fast-FS shuffle; it was only for the OneDrive problem.
- The old sandbox's `node_modules`, `/home/agent/build`, and its postgres/redis
  containers are gone with that sandbox — nothing to clean on the host beyond the
  moved folder itself.

## 4) What still needs doing (forward backlog, roughly prioritized)
- [ ] Post-move: revert `.npmrc`, prune obsolete scripts (above), re-verify green, commit.
- [ ] Slim Docker images (~1.8GB → use `pnpm deploy --legacy` for a prod-only
      node_modules; current images work but are heavy). See `docs/DEPLOYMENT.md`.
- [ ] Bound/ env-gate Fastify `trustProxy` (currently `true`) — deploy behind an
      XFF-stripping proxy or make it configurable (low-sev review finding).
- [ ] Web app has NO unit tests (only typecheck+build) — add component/integration
      tests (vitest + RTL, and/or Playwright e2e against the running stack).
- [ ] Real Docker-driver e2e: with a Docker host, exercise DEPLOY_DRIVER=docker
      (actual container preview), not just the mock.
- [ ] Product features worth adding: post the preview URL back to the PR (GitHub
      check/comment), GitHub status checks, a small CLI using API tokens,
      `/metrics` endpoint for Prometheus, email/Slack notifications.
- [ ] User setup (can't be done without their accounts): GitHub App (webhooks),
      GitHub OAuth app (login, set DEV_AUTH=false), k8s image refs/hostnames.
      See `docs/RETURN_HANDOFF.md`.

## 5) What I need YOU (the user) to do
- Move done ✔ (that's why you're reading this here).
- Recreate the sandbox pointed at the NEW local path so I build there directly.
- Provide GitHub App + OAuth credentials when you want real (non-mock) previews.
- Note: there is still no way for me to read your account usage %; I checkpoint to
  git instead so a pause never loses work.

## 6) Conventions reminder (so a resumed session stays coherent)
ESM with `.js` import suffixes; TSDoc on exports; zod validation; AppError
hierarchy from `@shipyard/core`; API routers follow `apps/api/src/routes/teams.ts`
as the canonical pattern; never return decrypted secrets; checkpoint each wave
with a git commit. Full contracts in `docs/ENGINEERING.md`.
