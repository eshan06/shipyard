# Shipyard — interactive demo

A **backend-free build of the real dashboard**, for linking from a marketing
site or portfolio. No API, database, Redis, or Docker: the app runs its actual
production UI against an in-memory dataset.

```bash
pnpm --filter @shipyard/web demo:build     # build the demo bundle
pnpm --filter @shipyard/web demo:start     # serve it on http://localhost:3100
```

## What a visitor can do

Everything is live and stateful for the session — this is the real dashboard,
not a video or a set of screenshots.

- **Browse the fleet** — 10 previews across every lifecycle state (running,
  building, stopped, failed, destroyed) over 3 connected repos.
- **Watch a deploy happen.** Hitting **Redeploy** on any preview runs a
  scripted ~8-second deploy: the status walks `BUILDING → DEPLOYING → RUNNING`,
  build and runtime log lines stream in over (simulated) SSE, and services flip
  to healthy one by one — exactly the transitions the real worker drives.
- **Stop / destroy / pin** previews and see the state machine respond.
- **Open** a preview to the in-app simulated environment page.
- **Mint and revoke API tokens**, with the raw value shown exactly once.
- Read live logs with pause/clear, browse deployments, builds, per-project
  costs against a monthly budget, env vars (secrets masked), and reviewers.

Reloading the page resets everything to the seeded snapshot.

## How it works

The dashboard only touches the network in two places: the typed API client
(`fetch`) and the SSE hooks (`EventSource`). Demo mode replaces exactly those
two seams and changes nothing else:

| File | Role |
| --- | --- |
| `apps/web/src/demo/data.ts` | The seeded dataset — projects, PRs, previews, deployments, services, costs, tokens. All timestamps are relative to page load, so the demo never looks stale. |
| `apps/web/src/demo/store.ts` | Mutable state + the deploy simulation. Applies the same status transitions and `previewStatusDisplay()` helper the real API uses. |
| `apps/web/src/demo/backend.ts` | Routes `/api/v1/*` to the store and provides a drop-in `EventSource` that replays log/status events. |
| `apps/web/src/components/demo-mode.tsx` | Installs the backend at module scope (before React renders) and renders the demo badge. |

Because every page, SWR cache, mutation, and optimistic update is the
unmodified production code path, the demo exercises the real UI — a bug in the
demo is usually a bug in the app.

**Normal production builds contain none of this.** The `IS_DEMO` flag alone is
not enough to achieve that: it dead-codes the *call*, but `backend` → `store` →
`data` all run top-level side effects, so a bundler must keep the modules —
which put ~32 kB of fixture data in the shared layout chunk of every page. What
actually excludes it is the module replacement in `next.config.mjs`, which
swaps `@/demo/backend` for `backend.stub.ts` (a no-op) unless
`NEXT_PUBLIC_DEMO=true`, for both webpack and Turbopack.

Don't remove that config thinking the env flag covers it — verify with:

```bash
pnpm --filter @shipyard/web build
grep -rl "preview.acme.dev" apps/web/.next/static   # must print nothing
```

## Deploying it

The demo is a standard Next.js app with no runtime dependencies, so any Node
host works.

`pnpm demo:build` works from the repo root **or** from `apps/web` — the script
builds this app's workspace dependencies itself before running `next build`.
That matters because `apps/web` imports `@shipyard/core`, whose package exports
resolve to a compiled `dist/`; without it a fresh clone fails with
`Module not found: Can't resolve '@shipyard/core/status'`.

No environment variables are needed — `apps/web/scripts/demo-build.mjs` sets
the four `NEXT_PUBLIC_*` values itself, because Next inlines them at build
time and they must not depend on the host's runtime env.

**Vercel** — set **Root Directory to `apps/web`** in Project Settings.

This repo contains more than one deployable thing (the Next app and the Python
reviewbot), so importing it at the repo root makes Vercel ask for a
multi-service `vercel.json` and block the Deploy button. Scoping the project to
`apps/web` is what you want anyway: the demo needs no other service.

| Setting | Value |
| --- | --- |
| Root Directory | `apps/web` |
| Framework Preset | Next.js |
| Build Command | `pnpm demo:build` (override) |
| Install Command | *(default)* |
| Output Directory | *(default)* |

Leave "Include files outside the root directory" **on** — pnpm installs the
workspace from the repo root.

**Docker / any Node host**: run `pnpm demo:build`, then serve with
`pnpm demo:start` (or `next start` from `apps/web`). Nothing else needs to be
provisioned — no `.env`, no database, no API, no Docker daemon.

### Embedding in a marketing page

The demo is a normal site, so an `<iframe>` works if you'd rather keep visitors
on your landing page:

```html
<iframe src="https://demo.your-domain.com" width="100%" height="820"
        style="border:0;border-radius:12px" loading="lazy"
        title="Shipyard interactive demo"></iframe>
```

A direct link is usually better on mobile, where the dashboard's sidebar layout
wants the full viewport.
