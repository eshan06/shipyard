# Shipyard — Go-Live Handoff

**Audience:** the next engineer (likely me, Claude, in a future session) picking this back up.
**Last updated:** 2026-07-17, end of the "production-hardening" session.
**Repo state:** `main`, pushed to `github.com/eshan06/shipyard` (private), co-author-clean.
All gates green: **lint 11/11 · typecheck 11/11 · build 7/7 · 218 unit tests +
5 live integration tests + a real docker-driver e2e**.

> **What changed 2026-07-17:** the entire *agent-owned* go-live track in §4 below
> is now done, and the docker deploy path was validated end-to-end for the first
> time. The one critical risk (§3) is resolved. What's left is the **`(you)`
> provisioning track** (accounts, host/cluster, domains, secrets). See
> `PROGRESS.md` Phase 8 for the full list of what landed. The §4 items keep their
> original text with a **✅ DONE** / **⏳ (you)** marker prepended.

> Read this with [[memory]]: `build-on-fast-fs-mirror`, `dashboard-redesign`,
> `web-perf-barrel-and-dev`, `no-claude-coauthor`, `github-remote`,
> `shipyard-run-readiness-2026-06-15`. Companion docs: `PROGRESS.md`,
> `docs/RETURN_HANDOFF.md`, `docs/DEPLOYMENT.md`, `docs/RUNBOOK.md`, `legal/README.md`.

---

## 0. How to work in this repo (read first)

- The working tree (`C:\Users\toesh\newGithub\shipyard`) is a **symlink-hostile virtiofs mount** —
  `pnpm install` fails here. **Edit + commit here**, but **build/verify on the fast-FS mirror**:
  `bash /home/agent/sync.sh` (canonical→mirror; excludes `.env`, so `cp` it after) then
  `pnpm --filter … lint|typecheck|build` / `pnpm test` in `/home/agent/build/shipyard`.
- To pull a mirror-only change (e.g. `eslint --fix`, lockfile) back: copy the specific files
  mirror→canonical, verify with `git diff`. **Never run `pnpm build` while the Turbopack `pnpm dev`
  server is up** — it clobbers `.next` and the dev server 500s until restarted.
- **Commits: NO `Co-Authored-By: Claude` trailer** (the user's standing convention). Push `main`
  only — never the `pre-coauthor-strip-backup` tag. The sandbox proxy handles GitHub auth.
- Postgres + Redis are already up in the sandbox (`shipyard-infra-*` containers); **`docker` is
  available** — so a real docker-driver e2e can actually be run here.

---

## 1. What this session did

Started from "the app won't run locally" and ended with a runnable, fast, redesigned, verified app.

**Run-readiness (the documented quickstart was broken):**
- Root `.env` never loaded → added `dotenv-cli` to db/api/worker scripts.
- `loadConfig` (api + worker) treats blank env vars as unset (empty `.env.example` placeholders no
  longer fail zod `.url()` and crash boot).
- `turbo dev` now `dependsOn: ["^build"]` (apps no longer run stale package `dist`).
- Tailwind config: `require()` → ESM import (was crashing the dev CSS JIT — the `/previews` crash).
- Dev `GITHUB_WEBHOOK_SECRET` default so the PR→preview demo works.

**Dead "Open" preview link:** in mock mode preview URLs aren't real, so "Open" now routes to an
in-app **simulated preview** (`/preview/[id]`) gated by `NEXT_PUBLIC_DEPLOY_DRIVER` (docker → real URL).

**Performance:** `@shipyard/core/status` subpath (browser stopped importing the barrel →
crypto-browserify+zod+nanoid, ~140kB off 5 routes; ~310→165kB). Removed `recharts` (hand-built SVG;
`/costs` 236→129kB). `next dev --turbopack` + route-group `loading.tsx` + `optimizePackageImports`.
`RoutePrewarm` (dev-only) compiles routes in the background so first tab clicks drop ~1s→~50–120ms.
SWR `revalidateOnFocus:false`.

**Correctness/lint:** fixed pre-existing RED lint (stray `packages/core/.eslintrc.cjs`, seed coercion,
deploy-engine type-imports, missing `apps/web/eslint.config.mjs`). `POST /deployments/:id/cancel`
returns a non-stale build status. Deployments list API now includes a `preview {id,slug,name}` ref.

**Redesign:** ported the "engineering terminal" design system (`apps/web/src/app/shipyard.css`),
Space Grotesk + JetBrains Mono, forced dark, new shell (sidebar/topbar/⌘K palette), shared
primitives (`components/sy.tsx`), all 7 pages rewritten to the design wired to real data.
Screenshot-verified against the handoff with 0 console errors.

**Verification harness used:** multi-agent workflows for adversarial API/mutation verification,
the page rewrites, and the production audit; a headless-Chrome screenshot harness on the mirror.

---

## 2. Where it stands

- **Works today:** the full dashboard + API + worker in **mock mode** (`DEPLOY_DRIVER=mock`) — real
  data, real auth (dev-login), real webhook→preview lifecycle driven by the *simulated* orchestrator.
- **The gap to production is mostly wiring + validation + ops, not missing features.** The docker
  driver is *complete code* but **has never run against a real daemon**, and the surrounding
  production concerns (auth, secrets, images, infra, isolation) are config/templates.

---

## 3. ✅ The one critical risk — RESOLVED (2026-07-17)

Previews used to run arbitrary customer code with **zero** container isolation.
`createAndStart`/`hostConfigFor` now set `Memory`+`MemorySwap`, `NanoCpus`,
`PidsLimit`, `CapDrop:[ALL]` + a minimal cap set, `SecurityOpt:[no-new-privileges]`,
and an `nofile` ulimit; ports publish on `127.0.0.1` only (never 0.0.0.0), and
the reverse proxy fronts previews over a shared Docker network. Verified on a
live container by the docker-driver e2e (build→run→route→inspect→destroy).

**Residual hardening still worth doing** (defense-in-depth, not blocking a
first internal launch): the worker still talks to the **host Docker socket**, so
for a genuinely multi-tenant / public deployment move off the host socket →
rootless Docker / Kata / Firecracker or a constrained per-tenant node, add
seccomp/AppArmor profiles, and network-egress policy. `ReadonlyRootfs` was left
off by default because most app/db images need a writable root.

---

## 4. Go-live roadmap (prioritized, with owner)

Legend: **[P0]** blocks any real deploy · **[P1]** before real traffic · **[P2]** hardening.
**(you)** = needs an external account/credential/decision · **(agent)** = code/config I can do next session.

### A. Make real previews actually work — the core product
- **[P0] (agent) Harden the docker orchestrator for untrusted code** — `HostConfig`: `Memory`/
  `MemorySwap`, `NanoCpus`/`CpuQuota`, `PidsLimit`, `CapDrop:[ALL]`, `SecurityOpt:[no-new-privileges]`,
  `ReadonlyRootfs` where feasible, restricted egress. `docker.ts:219-267`. **(critical, see §3)**
- **[P0] (agent) Per-preview reverse proxy + wildcard routing** — ship Traefik/Caddy in
  `infra/docker` + routing labels so `<slug>.<PREVIEW_BASE_DOMAIN>` reaches the right container.
  Without it every RUNNING preview URL is dead. `docker.ts`, `deploy.ts:212`.
- **[P0] (agent) Real docker-driver e2e** — run `DEPLOY_DRIVER=docker` against the sandbox's Docker
  daemon end-to-end (build → run → route → destroy). Only the mock + pure functions are tested today
  (`engine.test.ts`). **This de-risks the biggest unknown and will likely surface real bugs.**
- **[P0] (you) Provision a Docker host** for the worker (`DOCKER_HOST` or socket mount). No per-PR
  runtime exists in k8s today.
- **[P1] (agent) Registry auth (base-image pulls), concurrency/disk caps, real seed execution,
  URL-reachability check before marking RUNNING.** `docker.ts:125-211`, `deploy.ts:426-459`.

### B. Real authentication & secrets — (mostly you)
- **[P0] (you) GitHub OAuth app** (dashboard login). Callback URL **exactly**
  `<PUBLIC_API_URL>/api/v1/auth/github/callback` (`auth.ts:170`). Set `GITHUB_OAUTH_CLIENT_ID/SECRET`.
- **[P0] (you) `DEV_AUTH=false` in every deployed env** — `.env.example` ships `DEV_AUTH=true`;
  while truthy, `POST /auth/dev-login` logs in any seeded user with no password (`auth.ts:84-119`).
- **[P0] (you) Generate + store `SESSION_SECRET` (`openssl rand -hex 32`) and
  `SECRETS_ENCRYPTION_KEY` (`openssl rand -base64 32`, must decode to 32 bytes)** in a secret manager,
  separate from DB backups (losing the key = all stored env-var ciphertext is unrecoverable).
- **[P0] (you) Replace the dev `GITHUB_WEBHOOK_SECRET=dev-webhook-secret`** default in any deployed env.
- **[P0/P1] (you) GitHub App** (App ID, private key, webhook secret) — subscribe to `pull_request`
  (opened/synchronize/reopened/closed); permissions Contents:Read + Pull requests:Read/Write (status).
- **[P1] (agent) Implement the GitHub App integration in code** — it's **documentation-only today**
  (`GITHUB_APP_*` are in `.env.example`/docs but read in **zero** source files; no `octokit` dep).
  Needed for private-repo cloning + posting preview URLs/status back to PRs.

### C. Build & ship images + deploy pipeline
- **[P0] (agent) Release CI workflow** — `ci.yml` only lints/tests/builds; **nothing builds/pushes
  images**, so every manifest references `ghcr.io/OWNER/shipyard-*:latest` that doesn't exist. Add
  `.github/workflows/release.yml` (build + push the 3 images on tag).
- **[P0] (you) Provision a registry + namespace (OWNER)** and grant CI push creds.
- **[P0] (agent) Fill k8s placeholders** — image `OWNER`+tag in `infra/k8s/{30,40,50,60}` (pin a real
  tag, not `:latest`); domains in `10-configmap.yaml` + `70-ingress.yaml` (currently `example.com`).
- **[P0] (you) Domains + DNS** for app, api, and `*.preview.<domain>` (wildcard).
- **[P0] (you) Real k8s Secret** (don't apply the `20-secret.yaml` template — it's `REPLACE_ME`).
- **[P0] (you) Cluster + ingress-nginx + cert-manager** (`letsencrypt-prod` issuer → `shipyard-tls`),
  and **Postgres + Redis** (managed or in-cluster — there are no DB/Redis manifests).
- **[P1] (agent) Wildcard-preview ingress/TLS routing**, **slim images** (~1.8–2GB via `pnpm deploy`/
  Next standalone), **release-safe migrate Job** (fixed-name Job is immutable on re-apply), **extend
  release pipeline to run migrations + roll out**.
- **[P2] (agent) Pin base images by digest + Trivy/Grype scan; HPA + PDB for api/web; CI manifest
  dry-run gate.**

### D. Security hardening — (agent)
- **[P1] Env-gate `trustProxy`** (hard-coded `true` in `app.ts:75` → IP/rate-limit spoofing behind a
  non-XFF-stripping proxy). **[P1] Scope helmet CSP** (globally disabled for Swagger — re-enable a
  restrictive CSP, exempt only `/docs`). **[P1] Author `SECURITY.md`** (the legal pack references one
  30× and it doesn't exist). **[P2] Automated `SECRETS_ENCRYPTION_KEY` rotation CLI.**

### E. Ops & observability
- **[P1] (agent)** Add `/metrics` (Prometheus) + OpenTelemetry tracing + error tracking (Sentry) —
  monitoring is log/health-probe-only today. **[P1] (agent)** DB connection pooling / PgBouncer
  guidance. **[P1] (you)** Decide the analytics sink (`log` default is fine). **[P2] (you)** Redis TLS
  (`rediss://`), backup/restore + key-rotation rehearsal. **[P2] (agent)** Add `PRISMA_LOG` to config + `.env.example`.

### F. Legal / compliance — blocks PUBLIC launch only (not internal/single-team)
- **[P0] (you)** Counsel review of the whole `legal/` pack (297 unfilled `[[placeholders]]`, the
  `COUNSEL_REVIEW_CHECKLIST.md`). **[P0] (you)** Register the DMCA designated agent (public only).
- **[P1] (you)** Decide on `security.md` (top counsel decision; 30 dead refs) → **(agent)** can draft a
  `SECURITY.md` from verified facts. **[P1] (agent)** Reconcile `cookie-policy.md` with the
  now-forced dark theme + onboarding-checklist storage. **[P1] (you)** Verify the legal pack's product
  claims (AES-256-GCM, isolation boundaries, telemetry, TLS, retention) against the live system.

### G. Docs refresh — (agent)
- **[P1]** `PROGRESS.md`, `docs/SESSION_*`, `docs/RETURN_HANDOFF.md`, `README` predate this session's
  redesign + run-readiness commits — refresh them (dotenv flow, `NEXT_PUBLIC_DEPLOY_DRIVER`, the
  `/preview` route, recharts removal, Turbopack dev).

---

## 5. What's done vs. what's left

**✅ Done this session (the whole agent-owned track from §4):** docker
orchestrator hardening (A/§3), per-preview reverse proxy (A) + a real
docker-driver e2e (A), repo checkout + env injection + registry auth (A/B),
GitHub App integration in code (B), release CI + docker-build gate + migrations
in CI (C), k8s placeholder fixes + secret-file rename (C), security hardening —
env-gated trustProxy, strict CSP, `SECURITY.md`, token-scope enforcement (D),
`/metrics` observability + PRISMA_LOG (E), the P0 web prod-proxy fix + web UX
(logout, error boundaries, honest chrome, fonts, mobile), and this docs refresh
(G). See `PROGRESS.md` Phase 8.

**⏳ Left — the `(you)` provisioning track (needs accounts/credentials/decisions):**
1. A **Docker host** for the worker (`DEPLOY_DRIVER=docker` + socket/`DOCKER_HOST`)
   and the preview proxy running (`infra/docker/preview-proxy.yml`,
   `PREVIEW_EDGE_NETWORK=shipyard-edge`, wildcard DNS `*.<domain>`).
2. **GitHub OAuth app** + **GitHub App** (App id, private key, webhook secret) →
   set the `GITHUB_*` envs; keep `DEV_AUTH=false`.
3. **Registry + GHCR push** (release.yml uses the built-in GITHUB_TOKEN),
   **domains + DNS**, **cluster** (ingress-nginx + cert-manager), managed
   **Postgres + Redis**, and the **real k8s Secret** (`20-secret.example.yaml`).
4. Generate + vault `SESSION_SECRET` / `SECRETS_ENCRYPTION_KEY`; replace the dev
   webhook secret. Fill `[[SECURITY_CONTACT_EMAIL]]`; counsel review of `legal/`
   (public launch only).

**Remaining agent-doable hardening (non-blocking, defense-in-depth):** slim the
container images; session revocation (per-user token-version claim); move the
worker off the host Docker socket → rootless/Kata/Firecracker for true
multi-tenant isolation; seccomp/AppArmor + egress policy on preview containers.

---

## 6. Resume prompt

The copy-paste prompt to start the next session is in **`docs/RESUME_PROMPT.md`**.
