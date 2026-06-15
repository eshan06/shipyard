# Resume prompt

Paste this to pick the project back up in a new session.

---

We're continuing work on **Shipyard** (preview-environments platform) at
`C:\Users\toesh\newGithub\shipyard`. Start by reading **`docs/GO_LIVE.md`** (the full handoff:
what's done + the prioritized go-live roadmap) and your memory for this project (the
`build-on-fast-fs-mirror`, `dashboard-redesign`, `web-perf-barrel-and-dev`, `no-claude-coauthor`,
and `shipyard-run-readiness-2026-06-15` entries).

Working conventions (from `docs/GO_LIVE.md` §0): the working tree is a symlink-hostile virtiofs mount,
so **edit + commit here but build/verify on the fast-FS mirror** (`bash /home/agent/sync.sh`, then
`cp` `.env` over, then run gates in `/home/agent/build/shipyard`). **Never run `pnpm build` while the
Turbopack `pnpm dev` server is up.** **Commits must NOT include a `Co-Authored-By: Claude` trailer;**
push `main` only (the repo is `github.com/eshan06/shipyard`). Postgres, Redis, and **Docker are
available in the sandbox**, so real docker-driver work can be validated here. Ultracode is fine —
use workflows/subagents for substantive work and adversarially verify.

The goal is **production readiness**. Work the **agent-owned** items in `docs/GO_LIVE.md` §5 order —
I (the human) will handle the provisioning/account items (`(you)` tasks) separately. Specifically,
**start with the core-product track**:

1. **Harden the docker deploy orchestrator for untrusted customer code** (the critical risk in
   `GO_LIVE.md` §3): add `HostConfig` resource limits (`Memory`, `NanoCpus`, `PidsLimit`), `CapDrop`,
   `no-new-privileges`/seccomp, read-only rootfs where feasible, and constrained egress —
   `packages/deploy-engine/src/docker.ts`.
2. **Stand up a per-preview reverse proxy** (Traefik/Caddy in `infra/docker`) so
   `<slug>.<PREVIEW_BASE_DOMAIN>` routes to the right container.
3. **Write and run a real docker-driver e2e** against the sandbox Docker daemon
   (`DEPLOY_DRIVER=docker`): build → run → route → destroy a real sample preview. Surface and fix any
   bugs in the never-run-for-real path.

Keep every gate green (lint/typecheck/build/test), verify behavior (don't just assert it compiles),
commit logically as you go (no co-author), and update `docs/GO_LIVE.md` + memory as items land. When
this track is solid, move to the release CI pipeline + image slimming, then security hardening
(trustProxy, CSP, `SECURITY.md`), then the GitHub App code integration, then observability + docs
refresh — per `docs/GO_LIVE.md` §4–5.
