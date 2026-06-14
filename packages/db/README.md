# @shipyard/db

The shared data-access layer for Shipyard: the Prisma schema, the generated
client wrapped in a process-wide singleton, migrations, and a rich development
seed.

## Usage

```ts
import { prisma, PreviewStatus, type Preview, Prisma } from "@shipyard/db";

const running = await prisma.preview.findMany({
  where: { status: PreviewStatus.RUNNING },
});
```

`prisma` is a **singleton**. Do not construct your own `PrismaClient` — in
development the instance is memoised on `globalThis` to avoid hot-reload
connection storms; in production each process owns exactly one client.

This package also re-exports the entire generated client surface (every model
type, enum, input/where type, and the `Prisma` namespace) so consumers import
everything domain-related from `@shipyard/db`.

## Scripts

| Script      | What it does                                            |
| ----------- | ------------------------------------------------------- |
| `generate`  | `prisma generate` — (re)generate the client             |
| `migrate`   | `prisma migrate dev` — create/apply a dev migration     |
| `deploy`    | `prisma migrate deploy` — apply migrations (prod/CI)    |
| `push`      | `prisma db push` — sync schema without a migration      |
| `seed`      | `tsx prisma/seed.ts` — load rich demo data              |
| `studio`    | `prisma studio` — browse the database                   |
| `build`     | `tsup` — bundle `src/index.ts` to `dist/`               |
| `typecheck` | `tsc --noEmit`                                          |
| `test`      | `vitest run`                                            |

## Seed

`prisma/seed.ts` is **idempotent** (everything is `upsert`ed on a stable id or
natural unique key) and **deterministic** (all timestamps derive from a single
fixed `BASE_DATE` constant — no `Date.now()`), so it can be run repeatedly and
reproduces the same dataset. Secrets are encrypted with `@shipyard/core`'s
`encryptSecret`; if `SECRETS_ENCRYPTION_KEY` is unset, the seed generates a dev
key for the run and logs it so you can persist it in `.env`.

The seed populates a believable dashboard: a team with members, two projects,
~12 pull requests, previews spanning every status (RUNNING/BUILDING/DEPLOYING/
DEGRADED/STOPPED/FAILED/DESTROYED), deployments with builds (including realistic
failures), services, coherent build+runtime log stories, env vars, reviewers,
cost history, notifications, audit logs, webhook events, and an API token
(hash only).
```sh
pnpm --filter @shipyard/db seed
```

> Note: the generated Prisma client lives in `generated/` and is git-ignored at
> the repo root. Run `pnpm --filter @shipyard/db generate` after cloning.
