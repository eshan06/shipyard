# shipyard — CLI

A dependency-free Go CLI for the Shipyard control plane. It speaks the same
REST + SSE surface the dashboard uses, authenticated with a **team-scoped API
token** — built for CI scripts and terminal workflows.

```
$ shipyard previews list
STATUS     SLUG               PROJECT       BRANCH                 SERVICES  URL
DEPLOYING  payments-pr-236    Payments API  feat/3ds-challenge     2         -
RUNNING    storefront-pr-412  Storefront    feat/pdp-redesign      4         https://storefront-pr-412.preview.acme.dev

$ shipyard logs storefront-pr-412          # SSE: backfill + live tail
22:39:27 INFO  web: Waiting for web
22:39:27 INFO  [web] web is healthy
22:39:27 INFO  Preview ready at https://storefront-pr-412.preview.acme.dev
```

## Commands

| Command | Description |
| --- | --- |
| `previews list [--status S] [--limit N]` | Table of preview environments |
| `previews get <id\|slug>` | One preview's detail |
| `previews stop\|redeploy\|pin <id\|slug>` | Queue a lifecycle action |
| `previews destroy <id\|slug> --yes` | Permanent teardown (guarded) |
| `logs <id\|slug>` | Live-tail deployment logs over SSE (Ctrl-C to stop) |
| `status <id\|slug> [--watch]` | Current status, or stream transitions |

Every command accepts `--json` (raw API payloads for scripting), `--api`, and
`--token`.

## Auth & config

| Env | Meaning |
| --- | --- |
| `SHIPYARD_API_URL` | API origin (default `http://localhost:4000`) |
| `SHIPYARD_TOKEN` | API token (`Authorization: Bearer`) |

Create a token in the dashboard under **Settings → Team → API tokens** (or
`POST /api/v1/teams/:id/tokens`) with scopes such as `previews:read`,
`previews:write`, `deployments:read`. The raw token is shown exactly once;
only its SHA-256 hash is stored.

## Build & test

Requires Go ≥ 1.23. No third-party dependencies.

```bash
cd cli
go test ./...
go build -o shipyard .        # or: GOOS=linux go build … for CI images
```

Slug resolution is client-side: `shipyard logs storefront-pr-412` first tries
the argument as an id, then falls back to matching the slug against the list.
