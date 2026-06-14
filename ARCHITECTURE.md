# Shipyard — Architecture

> Preview environments manager. Every pull request gets a live, disposable,
> full-stack environment: deployed branch, seeded database, backend services,
> protected secrets, and automatic cleanup. Like Vercel preview deployments,
> but built for full-stack teams that need databases, backend services, and
> seeded data.

## High-level

```
                         ┌─────────────────────────────────────────┐
   GitHub PR events ───▶ │  apps/api  (Fastify control plane)       │
   (webhooks)            │   • REST + OpenAPI  • SSE/WS live logs    │
                         │   • auth (Auth.js)  • RBAC                │
                         └───────────────┬───────────────-──────────┘
                                         │ enqueue jobs (BullMQ/Redis)
                                         ▼
                         ┌─────────────────────────────────────────┐
   Dashboard (Next.js) ◀▶│  apps/worker  (deploy / cleanup / cost)  │
   apps/web              │   • packages/deploy-engine (dockerode)   │
                         │   • spins up per-PR preview stacks        │
                         └───────────────┬─────────────────────────-┘
                                         ▼
                         Docker: web + api + postgres + redis + … per preview
```

## Packages

| Package                    | Responsibility                                                        |
| -------------------------- | -------------------------------------------------------------------- |
| `apps/web`                 | Next.js dashboard: previews, deployments, logs, costs, reviewers     |
| `apps/api`                 | Fastify control plane: REST API, webhooks, auth, SSE/WS, OpenAPI     |
| `apps/worker`              | BullMQ consumers: build/deploy, cleanup/auto-stop, cost rollups      |
| `packages/db`              | Prisma schema + client + migrations + seed                           |
| `packages/core`            | Shared zod schemas, domain types, DTOs, status machines, crypto      |
| `packages/deploy-engine`   | Docker orchestration: build images, compose preview stacks, teardown |
| `packages/config`          | Shared tsconfig / eslint / prettier presets                          |

## Domain model

See `packages/db/prisma/schema.prisma`. Core aggregates:

- **Team → Project → PullRequest → Preview → Deployment → Build / Service / LogChunk**
- **EnvVar** (encrypted at rest, project/preview scope, build/runtime target)
- **SeedTemplate** (test data), **Review** (reviewer state), **CostRecord** (usage→$)
- **WebhookEvent** (idempotency), **AuditLog**, **ApiToken**, **Notification**

## Lifecycle: PR → preview

1. **`pull_request` webhook** (`opened`/`synchronize`/`reopened`) → API verifies
   signature, records `WebhookEvent` (idempotent by delivery id), upserts
   `PullRequest`, ensures a `Preview`, enqueues a `deploy` job.
2. **Worker `deploy`**: checkout commit → detect/compose services → build images
   (`Build`) → start stack via deploy-engine → wait for health → set `Preview.url`
   → `RUNNING`. Logs stream to `LogChunk` + Redis pub/sub → SSE to dashboard.
3. **Seeding**: default `SeedTemplate` applied to the preview database after DB
   service is healthy.
4. **Secrets**: `EnvVar`s decrypted just-in-time and injected into containers;
   never returned in plaintext over the API.
5. **`pull_request closed/merged`** → enqueue `destroy` after `destroyTtlMinutes`.
6. **Auto-stop**: idle previews (no activity for `autoStopMinutes`) stopped by the
   cleanup worker; unpinned, closed previews destroyed after TTL.
7. **Cost**: periodic worker samples container stats → `CostRecord` → budget alerts.

## Cross-cutting

- **AuthN**: Auth.js + GitHub OAuth (web). API: session cookie or `ApiToken` (CLI).
- **AuthZ**: team membership roles (OWNER/ADMIN/MEMBER/VIEWER) enforced in API.
- **Secrets**: AES-256-GCM via `SECRETS_ENCRYPTION_KEY`; ciphertext only in DB.
- **Idempotency**: webhooks keyed by delivery id; jobs safe to retry.
- **Observability**: pino structured logs; deployment/build logs persisted + live.
- **Realtime**: Redis pub/sub → API SSE/WS → dashboard (logs, status).

## Why this stack

- **Fastify** over Nest: lighter, fast, first-class schema validation + OpenAPI.
- **Prisma**: typed data access shared across api/worker; migrations.
- **BullMQ**: durable, retryable jobs — deploys/cleanup must survive restarts.
- **dockerode**: programmatic Docker; previews are real container stacks, which is
  what differentiates Shipyard from frontend-only preview tools.
- **Next.js + shadcn/ui**: fast, accessible dashboard with server components.

## Environments / setup

Local infra via `infra/docker/docker-compose.yml` (postgres + redis). App env in
`.env` (see `.env.example`). Production targets Docker hosts or Kubernetes
(`infra/k8s`, planned).
