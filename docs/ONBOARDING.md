# Onboarding — your first 15 minutes with Shipyard

This guide walks a new team from zero to a live preview. It mirrors the
**Get started** checklist shown on the dashboard Overview (which tracks your real
progress and disappears once you're set up). For installing/running the stack
locally, see [`README.md`](../README.md); for production, see
[`docs/DEPLOYMENT.md`](./DEPLOYMENT.md).

## Before you start
- A running Shipyard (local dev or a deployed instance) and an account. Locally,
  sign in with a seeded dev account (e.g. `alice@acme.dev`); in production, sign
  in with GitHub.
- Owner or Admin role on a team if you want to connect repositories and mint
  tokens (see roles in [`docs/RUNBOOK.md`](./RUNBOOK.md)).

## The checklist

### 1. Connect a project
A *project* links a GitHub repository to Shipyard. Go to **Projects → Add a
project** and select the repo you want previews for. In production this requires
the **GitHub App** to be installed on that repository (see
[Going to production](#going-to-production)); locally, the seed data already
includes a demo project.

### 2. Get your first preview
A *preview* is an isolated, full-stack environment built from a branch/PR.
- **The usual way:** open (or push to) a pull request on a connected repo —
  Shipyard receives the webhook and builds a preview automatically.
- **To see the loop immediately in local dev:** with the API and worker running,
  fire a signed webhook with `node scripts/e2e-webhook.mjs 1001` and watch the
  preview go `QUEUED → BUILDING → RUNNING` on the **Previews** page, with a live
  URL and streaming logs.

### 3. Add an environment variable
Most apps need configuration to run. On a project (or an individual preview), add
environment variables and secrets under its settings. **Secrets are encrypted at
rest (AES-256-GCM) and are never shown again in plaintext** — copy a secret's
value when you create it. Prefer per-project defaults that every preview inherits.

> Tip: do **not** load real production personal data into preview databases or
> seed templates. Previews are ephemeral and shareable; use synthetic/anonymized
> data. (See the DPA in [`legal/`](../legal/README.md).)

### 4. Create an API token
For CI pipelines or scripting against the API, mint a **team-scoped API token**
under **Settings → Team**. The raw token is shown **once** at creation — store it
in your secret manager. Tokens are bound to a single team and can be revoked at
any time.

## Going to production
To move beyond the local mock driver you (the operator) need to provide a few
account-level integrations — these can't be set up from a sandbox:

1. **GitHub App** — real PR webhooks + repo access. Set `GITHUB_APP_ID`,
   `GITHUB_APP_PRIVATE_KEY`, `GITHUB_WEBHOOK_SECRET`; point its webhook at
   `https://<your-api-host>/api/v1/webhooks/github`.
2. **GitHub OAuth app** — dashboard login. Set `GITHUB_OAUTH_CLIENT_ID` /
   `GITHUB_OAUTH_CLIENT_SECRET` and `DEV_AUTH=false`.
3. **Real preview deploys** — set `DEPLOY_DRIVER=docker` and run the worker on a
   host with a Docker daemon (`DOCKER_HOST` if remote).
4. **(Optional) Product analytics sink** — events flow to the API's
   `/api/v1/telemetry` route; route them to a real destination with
   `ANALYTICS_DRIVER=log|http|posthog` (see `.env.example`). `log` (the default)
   needs nothing and emits durable structured events to your log collector.

See [`docs/DEPLOYMENT.md`](./DEPLOYMENT.md) for container/k8s specifics and
[`docs/RETURN_HANDOFF.md`](./RETURN_HANDOFF.md) for the full operator checklist.

## Troubleshooting
- **No preview after opening a PR?** Confirm the GitHub App is installed on that
  repo and the webhook secret matches; check **Builds**/logs for errors.
- **Preview builds but the app errors?** It's almost always missing env vars
  (step 3) — check the preview's runtime logs.
- **Checklist won't go away?** It hides automatically once all four steps are
  done; you can also dismiss it with the **×**. State is stored per-browser.
