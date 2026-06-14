# Shipyard — Engineering Conventions & Cross-Cutting Contracts

> Single source of truth for everyone (humans + agents) working on Shipyard.
> Read this **before** writing code. It locks down the contracts that let the
> `api`, `worker`, and `web` apps agree without re-deriving them.

## 1. Monorepo layout

| Path                       | Package name              | Responsibility |
| -------------------------- | ------------------------- | -------------- |
| `apps/web`                 | `@shipyard/web`           | Next.js (App Router) dashboard |
| `apps/api`                 | `@shipyard/api`           | Fastify control plane: REST, webhooks, auth, SSE |
| `apps/worker`              | `@shipyard/worker`        | BullMQ consumers: deploy / cleanup / cost / log-relay |
| `packages/db`              | `@shipyard/db`            | Prisma schema + client singleton + seed |
| `packages/core`            | `@shipyard/core`          | zod schemas/DTOs, status machines, crypto, errors, cost, ids |
| `packages/deploy-engine`   | `@shipyard/deploy-engine` | Docker orchestration + `MockOrchestrator` |
| `packages/config`          | `@shipyard/config`        | shared tsconfig / eslint / prettier presets |

## 2. Language & module conventions

- **TypeScript strict**, ESM only (`"type": "module"`).
- **Relative imports inside a package end in `.js`** (NodeNext resolution), e.g.
  `import { buildApp } from "./app.js"`. Cross-package imports use the package
  name: `import { prisma } from "@shipyard/db"`.
- Workspace deps are declared `"@shipyard/core": "workspace:*"`.
- Every exported symbol gets a **TSDoc** comment (match the existing style in
  `packages/core`). Prefer small, pure, well-named functions.
- Validation with **zod** (reuse schemas from `@shipyard/core`). Errors use the
  `AppError` hierarchy from `@shipyard/core` (`NotFoundError`, `ForbiddenError`,
  `ValidationError`, `ConflictError`, `RateLimitError`).
- Use `Result`/`ok`/`err` from core at fallible boundaries; throw `AppError` for
  request-handler control flow.
- **Never** return decrypted secret values or `valueEncrypted` over the API.
  Secret env vars are masked (`value: null, isSecret: true`).

## 3. Build tooling per package/app

- Libraries (`packages/*`) build with **tsup** to `dist/` (ESM + d.ts), and have
  `vitest.config.ts`, `eslint.config.mjs`, `tsconfig.json` extending
  `@shipyard/config`. Scripts: `build`, `dev`, `lint`, `typecheck`, `test`.
- `apps/api` & `apps/worker`: run with `tsx` in dev, build with tsup (or tsc) to
  `dist/`, `node dist/index.js` in prod.
- `apps/web`: standard Next.js (`next dev` / `next build` / `next start`).
- `typecheck` = `tsc --noEmit`. Keep the repo **green**: `pnpm -w typecheck`,
  `pnpm -w lint`, `pnpm -w test`, `pnpm -w build` all pass.

## 4. Environment variable contract (`.env.example`)

Shared (api + worker):
```
DATABASE_URL=postgresql://shipyard:shipyard@localhost:5432/shipyard?schema=public
REDIS_URL=redis://localhost:6379
SECRETS_ENCRYPTION_KEY=        # base64 32 bytes: `openssl rand -base64 32`
NODE_ENV=development
LOG_LEVEL=info
```
API:
```
API_PORT=4000
API_HOST=0.0.0.0
PUBLIC_APP_URL=http://localhost:3000      # dashboard origin (CORS, OAuth redirect)
PUBLIC_API_URL=http://localhost:4000
PREVIEW_BASE_DOMAIN=preview.localhost     # <slug>.preview.localhost
SESSION_SECRET=                            # >=32 chars, signs session cookie/JWT
DEV_AUTH=true                              # dev: allow password-less dev login
GITHUB_OAUTH_CLIENT_ID=
GITHUB_OAUTH_CLIENT_SECRET=
GITHUB_APP_ID=
GITHUB_APP_PRIVATE_KEY=
GITHUB_WEBHOOK_SECRET=
RATE_LIMIT_MAX=200                          # requests per window per ip/token
RATE_LIMIT_WINDOW=1 minute
```
Worker:
```
DEPLOY_DRIVER=mock                          # mock | docker
DOCKER_HOST=                                # optional, dockerode default if empty
PREVIEW_BASE_DOMAIN=preview.localhost
WORKER_CONCURRENCY=4
CLEANUP_INTERVAL_MS=60000
COST_INTERVAL_MS=300000
COST_PER_VCPU_HOUR=0.04
COST_PER_GB_MEM_HOUR=0.005
COST_PER_GB_STORAGE_HOUR=0.0002
COST_PER_GB_EGRESS=0.09
```
Web:
```
NEXT_PUBLIC_API_URL=http://localhost:4000
```
Each app validates its own env at startup with a zod schema and fails fast.

## 5. API ↔ Worker contract

### 5.1 BullMQ queues (Redis-backed)

| Queue name  | Producer | Consumer | Payload |
| ----------- | -------- | -------- | ------- |
| `deploy`    | api      | worker   | `{ deploymentId, previewId, projectId, commitSha, trigger }` |
| `destroy`   | api/worker | worker | `{ previewId, reason: "pr_closed"\|"manual"\|"ttl"\|"idle" }` |
| `cleanup`   | scheduler | worker  | `{}` (repeatable; scans idle/expired previews) |
| `cost`      | scheduler | worker  | `{}` (repeatable; samples running previews) |

- Job options: `attempts: 3`, exponential backoff, `removeOnComplete: { age: 86400 }`,
  `removeOnFail: { age: 604800 }`. Jobs must be **idempotent** (safe to retry).
- A shared module `@shipyard/core` exports the queue names + payload zod schemas
  (`DeployJobSchema`, `DestroyJobSchema`) so producer & consumer agree. (Add them
  under `packages/core/src/jobs.ts`.)

### 5.2 Redis pub/sub channels (live updates → SSE)

| Channel                         | Published by | Message JSON |
| ------------------------------- | ------------ | ------------ |
| `sy:deploy:logs:<deploymentId>` | worker       | `{ seq, level, source, message, ts }` |
| `sy:preview:status:<previewId>` | worker       | `{ previewId, status, url?, at }` |
| `sy:preview:events`             | worker       | `{ type, previewId, projectId, teamId, status, at }` |

The API exposes SSE endpoints that subscribe to these and forward to the browser.
Persisted `LogChunk` rows are the durable copy; pub/sub is the live tail.

## 6. HTTP API conventions (`apps/api`)

- Base path `/api/v1`. JSON only. Health at `/healthz` (liveness) and `/readyz`
  (checks db + redis). OpenAPI JSON at `/openapi.json`, docs UI at `/docs`.
- Use **`fastify-type-provider-zod`**: route `schema` uses zod; this both
  validates and generates OpenAPI. Response serialization via zod too.
- Errors: a global error handler converts `AppError` and `ZodError` to the
  `ErrorResponse` wire shape from `@shipyard/core` (`toErrorResponse`). 422 for
  validation with field issues.
- Pagination: cursor-based via `PaginationQuerySchema` (`cursor`, `limit`,
  `order`). List responses: `{ data: T[], nextCursor: string | null }`.
- **AuthN**: a `request.auth` principal is set by an auth hook. Two schemes:
  1. Session cookie (`sy_session`, signed JWT with `userId`) — browser.
  2. `Authorization: Bearer <token>` API token (sha256 hashed lookup) — CLI/CI.
  `DEV_AUTH=true` enables `POST /api/v1/auth/dev-login {email}` to mint a session
  for a seeded user (no GitHub needed for local demo).
- **AuthZ**: team-scoped RBAC. Resolve the owning team for the resource, then
  check the caller's `Membership.role` against the required role
  (`OWNER>ADMIN>MEMBER>VIEWER`). Reads need `VIEWER`; writes need `MEMBER`;
  destructive/settings need `ADMIN`/`OWNER`. Throw `ForbiddenError` otherwise.
- Mutations that change important state write an `AuditLog` row.
- CORS: allow `PUBLIC_APP_URL` with credentials.

### 6.1 Resource routes (under `/api/v1`)

`/auth/*`, `/me`, `/teams`, `/teams/:id/members`, `/teams/:id/tokens`,
`/projects`, `/projects/:id`, `/projects/:id/env`, `/projects/:id/seeds`,
`/pull-requests`, `/previews`, `/previews/:id` (+ `/redeploy`, `/stop`,
`/destroy`, `/pin`), `/previews/:id/env`, `/previews/:id/services`,
`/previews/:id/reviews`, `/previews/:id/costs`, `/previews/:id/logs` (SSE),
`/deployments`, `/deployments/:id`, `/deployments/:id/logs` (SSE),
`/deployments/:id/cancel`, `/builds/:id`, `/costs/summary`, `/audit`,
`/notifications`, `/webhooks/github` (no auth; signature-verified).

## 7. Web dashboard conventions (`apps/web`)

- Next.js App Router, React Server Components where possible; client components
  for live/interactive views. Tailwind + shadcn/ui. Dark + light theme.
- A typed API client in `src/lib/api.ts` wrapping `fetch` to `PUBLIC_API_URL`,
  forwarding the session cookie. SSE via `EventSource` for live logs/status.
- Routes: `/` (overview), `/previews`, `/previews/[id]`, `/deployments`,
  `/deployments/[id]`, `/builds` (failed builds), `/costs`, `/projects`,
  `/projects/[id]` (env/seeds/settings), `/settings/team` (members/tokens),
  `/login`. Every list has loading skeletons, empty states, and error states.
- Status colors map the `StatusColorToken` palette from `@shipyard/core`
  (`neutral|info|success|warning|danger`) to theme tokens.
- Accessible (semantic HTML, focus states, aria), responsive (mobile → wide).

## 8. Testing

- **Unit**: pure logic + services with a mocked `PrismaClient` (vitest). Fast,
  no external deps. Already done for `packages/core`/`deploy-engine` — match it.
- **Integration**: behind real `DATABASE_URL`/`REDIS_URL` (docker compose), run
  the api against a migrated test DB; the worker against the `MockOrchestrator`.
- Coverage target: meaningful tests on every service + the webhook→deploy flow.

## 9. Definition of done for a wave

`pnpm -w typecheck` ✅ · `pnpm -w lint` ✅ · `pnpm -w test` ✅ ·
`pnpm -w build` ✅ · PROGRESS.md updated · git committed.
</invoke>
