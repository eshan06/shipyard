# Contributing to Shipyard

Thanks for contributing! This is a short, practical guide. For the deeper design
rationale see [`docs/ENGINEERING.md`](./docs/ENGINEERING.md) and
[`ARCHITECTURE.md`](./ARCHITECTURE.md).

## Getting set up

See the [README Quickstart](./README.md#quickstart-local-development): Node 22 +
pnpm 9 + Docker, then `pnpm install`, `pnpm infra:up`, copy `.env`, and
`pnpm db:generate && pnpm db:migrate && pnpm db:seed`.

## Repository layout

A pnpm + turbo monorepo (`apps/*`, `packages/*`):

| Path                     | What it is                                                       |
| ------------------------ | --------------------------------------------------------------- |
| `apps/web`               | Next.js 15 dashboard (App Router)                               |
| `apps/api`               | Fastify control-plane API (REST + webhooks + SSE)              |
| `apps/worker`            | BullMQ workers (deploy / destroy / cleanup / cost)            |
| `packages/core`          | Shared zod schemas, DTOs, status machines, crypto, cost model  |
| `packages/db`            | Prisma schema, generated client singleton, migrations, seed    |
| `packages/deploy-engine` | Docker orchestration for preview stacks (dockerode)            |
| `packages/config`        | Shared tsconfig / eslint / prettier presets                    |
| `infra/`, `docs/`        | Deployment artifacts and documentation                         |

Shared domain logic lives in `packages/core`; `apps/*` and `packages/db` consume
it. Don't reach into another package's internals — import from its public entry.

## Conventions

- **TypeScript, ESM** everywhere; `strict` mode (configs in `packages/config`).
- **Validate at the boundary**: env, webhook payloads, and request bodies are
  parsed with **zod**. Each app validates its full env once at startup and fails
  fast — see `apps/*/src/config.ts` and `docs/ENGINEERING.md` §4. Add new env
  vars to the schema **and** `.env.example`.
- **Types & enums** come from `@shipyard/core` / `@shipyard/db` — don't redeclare
  domain enums or status strings; use the status machine in
  `packages/core/src/status.ts` for transitions.
- **Secrets** are encrypted at rest via `@shipyard/core` crypto; never log or
  return plaintext secrets.
- **Logging** is structured pino (JSON). Use the existing logger; no `console.*`
  in app code (boot-failure paths excepted).
- **Formatting/lint**: Prettier + ESLint (flat config). Run `pnpm format` and
  `pnpm lint` before pushing.

## Quality gates (run before pushing)

```bash
pnpm db:generate    # if you touched the Prisma schema
pnpm typecheck
pnpm lint
pnpm test           # needs postgres + redis (pnpm infra:up)
pnpm build
```

CI (`.github/workflows/ci.yml`) runs install → lint → typecheck → test → build
with real Postgres + Redis. PRs must be green.

### Database changes

Edit `packages/db/prisma/schema.prisma`, then:

```bash
pnpm --filter @shipyard/db migrate    # create a dev migration
pnpm db:generate                      # regenerate the client
```

Commit the generated migration. Keep the seed (`packages/db/prisma/seed.ts`)
idempotent and deterministic.

## Commit & PR style

- Use **Conventional Commits**: `feat: …`, `fix: …`, `chore: …`, `docs: …`,
  `refactor: …`, `test: …`. Optional scope, e.g. `feat(worker): …`.
- Keep commits focused; write a clear PR description (what + why). Link issues.
- Update docs (`README.md`, `docs/*`) and `.env.example` when behavior or config
  changes.
