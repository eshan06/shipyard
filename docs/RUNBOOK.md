# Shipyard — Operations Runbook

Day-2 operations for the Shipyard control plane. For build/deploy procedures see
[`DEPLOYMENT.md`](./DEPLOYMENT.md).

## Components at a glance

```
GitHub ──webhook──▶ api (Fastify)  ──enqueue──▶ Redis (BullMQ) ──▶ worker
                      │  REST + SSE                                  │ deploy/destroy
   browser ◀──────────┘            cleanup ◀── repeatable ──▶ cost   │ + cleanup + cost
   (web/Next.js, same-origin /api/v1 → api)        Postgres ◀────────┘
```

- **api** — REST + OpenAPI (`/docs`), GitHub webhook intake, auth/RBAC, and SSE
  live-log/status streams. Stateless; scale horizontally.
- **worker** — BullMQ consumers: `deploy`, `destroy`, plus repeatable `cleanup`
  and `cost` schedulers. Does the real preview orchestration.
- **web** — Next.js dashboard. Stateless; calls the api same-origin.
- **postgres** — source of truth. **redis** — queues + pub/sub for live logs.

---

## Health & readiness

| Endpoint   | Service | Meaning                                                                 |
| ---------- | ------- | ----------------------------------------------------------------------- |
| `/healthz` | api     | Liveness — process is up and serving. Always `200 {"status":"ok"}`.     |
| `/readyz`  | api     | Readiness — checks Postgres + Redis. `200` when both reachable, else `503` with `{"db":bool,"redis":bool}`. |
| `GET /`    | web     | Liveness/readiness for the dashboard (no backend deps).                 |

- **Kubernetes**: api uses `/healthz` (liveness) + `/readyz` (readiness, keeps a
  pod out of rotation until DB+Redis are reachable); web probes `/`. The worker
  is headless — no HTTP probe; liveness is inferred from job throughput + logs,
  and it exits non-zero on a fatal config/boot error so the Deployment restarts
  it.
- **Compose**: api/web have container `HEALTHCHECK`s hitting the same endpoints.

Quick checks:

```bash
curl -fsS localhost:4000/healthz
curl -fsS localhost:4000/readyz          # 503 if db or redis is down
# k8s
kubectl -n shipyard get pods
kubectl -n shipyard logs deploy/shipyard-worker -f
```

---

## Observability

### Structured logging (pino)

All three Node services log JSON via **pino** to stdout (one event per line),
with a level field (`30`=info, `40`=warn, `50`=error) and contextual fields
(`driver`, `concurrency`, `queues`, job ids, preview/deployment ids, etc.).
`LOG_LEVEL` controls verbosity (`info` default; `debug`/`trace` for diagnosis).
In production keep raw JSON and ship stdout to your log stack (Loki, CloudWatch,
ELK, Datadog…); `pino-pretty` is dev-only.

Useful log signatures:

- `starting shipyard worker` / `shipyard worker ready` `{queues:[...]}` — worker boot.
- `using in-memory mock orchestrator` — worker is on `DEPLOY_DRIVER=mock`.
- `deploy job failed (will retry per attempts)` — a deploy attempt failed; BullMQ
  will retry per the job's `attempts`.
- `cost tick complete {sampled, recordsWritten}` — cost roll-up ran.
- api request logs include method/route/status/latency (Fastify + pino).

### Metrics

There is **no Prometheus `/metrics` endpoint** in this build. Monitor via:

1. **Health probes** — alert on `/readyz` flapping or non-200, and on pod restarts.
2. **Logs** — alert on `level>=50` (error) lines, on `deploy job failed`
   frequency, and on the cost tick going silent (scheduler stalled).
3. **Redis/BullMQ** — watch queue depth and failed-job counts (e.g.
   `redis-cli`, `bull-board`, or a BullMQ exporter) for the `deploy`, `destroy`,
   `cleanup`, `cost` queues; a growing `deploy` backlog means worker capacity is
   short.
4. **Postgres** — connection count, slow queries, disk.

If you later need `/metrics`, add `prom-client` to the api/worker (out of scope
for these deploy artifacts — would require an app code change).

---

## Preview lifecycle (what the workers do)

A preview moves `QUEUED → BUILDING → DEPLOYING → RUNNING`; from `RUNNING` it can
go `DEGRADED` (a service is unhealthy) or be stopped/destroyed. On any failure it
goes `FAILED`. State transitions are validated by the core status machine and
persisted across `Build`/`Deployment`/`Preview` rows; live updates fan out over
Redis pub/sub → SSE to the dashboard.

- **deploy** (on `pull_request` opened/synchronize/reopened): checkout → build →
  start stack → wait for health → set `Preview.url` → `RUNNING`. Idempotent on
  retry (keyed by `deploymentId`). On failure it persists `FAILED` + a
  `BUILD_FAILED` notification, then re-throws so BullMQ records the failure.
- **destroy** (on PR close/merge after TTL, idle auto-stop, or manual): tears the
  stack down.
- **cleanup** (repeatable, `CLEANUP_INTERVAL_MS`, default 60s): scans for idle
  previews (past `PREVIEW_AUTO_STOP_MINUTES`) and closed/merged PRs past
  `PREVIEW_DESTROY_TTL_MINUTES`, and enqueues `destroy` jobs.
- **cost** (repeatable, `COST_INTERVAL_MS`, default 5m): samples running previews
  and writes `CostRecord`s using the `COST_PER_*` rates; rolls up to dollars and
  drives budget tracking on the dashboard.

---

## Scaling

- **api** — stateless; raise `replicas`. Behind a load balancer/Ingress. SSE
  connections are long-lived, so ensure the proxy allows long read timeouts and
  disables buffering (the sample Ingress sets `proxy-read-timeout: 3600` and
  `proxy-buffering: off`).
- **web** — stateless; raise `replicas`.
- **worker** — two knobs:
  - `WORKER_CONCURRENCY` (default 4): jobs processed concurrently **per** worker.
  - `replicas`: BullMQ delivers each job to exactly one consumer, so adding
    worker pods scales throughput safely. The repeatable `cleanup`/`cost` jobs
    register on a fixed `jobId`, so they are not duplicated across replicas.
  - Roll workers with the `Recreate` strategy (as in `50-worker.yaml`) and a
    generous `terminationGracePeriodSeconds` so in-flight deploy/destroy jobs
    drain on SIGTERM rather than two generations racing the schedulers.
- **redis / postgres** — the usual: connection limits, memory, and (for the
  `deploy` queue) backlog drive scaling decisions.

---

## Backups

- **Postgres is the only durable state that must be backed up.** Use managed
  automated backups (RDS/Cloud SQL snapshots + PITR) or scheduled `pg_dump`:

  ```bash
  pg_dump "$DATABASE_URL" --no-owner --format=custom -f shipyard-$(date +%F).dump
  # restore:
  pg_restore --no-owner --clean --if-exists -d "$DATABASE_URL" shipyard-YYYY-MM-DD.dump
  ```

  Test restores periodically. Encrypted env-var secrets live in Postgres but are
  encrypted with `SECRETS_ENCRYPTION_KEY` — a DB backup is **useless without that
  key**, so back the key up separately and securely.

- **Redis** holds transient queue state (AOF persistence is enabled in the
  Compose/dev configs). It can be rebuilt from Postgres on loss; backing it up is
  optional. Losing Redis loses in-flight/queued jobs (see below).

---

## Common failure modes & remedies

### Preview stuck in `BUILDING`/`DEPLOYING`

1. Check the worker is running and consuming: `kubectl -n shipyard logs
   deploy/shipyard-worker -f` (or `docker compose ... logs -f worker`). No
   `shipyard worker ready` / no job activity ⇒ worker down or can't reach Redis.
2. Check the `deploy` queue for a stuck/failed job and inspect its error
   (BullMQ failed jobs / bull-board). Look for `deploy job failed` log lines.
3. Confirm `DEPLOY_DRIVER` is what you expect; with `docker`, verify the worker
   can reach the Docker daemon (`DOCKER_HOST` / mounted socket).
4. Remedy: fix the root cause (build error, missing env var, daemon
   unreachable), then re-trigger by pushing to the PR or re-enqueuing. Jobs
   retry automatically per their `attempts`; persistent failures land the
   preview in `FAILED`.

### `/readyz` returns 503 / Redis down

- `{"db":false}` — Postgres unreachable: check `DATABASE_URL`, network policy,
  DB pod/instance health, connection limits.
- `{"redis":false}` — Redis unreachable: the api degrades but the dashboard's
  live features (queue enqueue, SSE) break and the worker stops processing jobs.
  Check `REDIS_URL` and the Redis pod/instance. When Redis returns, the worker
  resumes; **jobs that were only in Redis (not yet persisted) are lost** — closed
  PRs / idle previews are re-detected by the next `cleanup` tick, and pushing to
  a PR re-enqueues a deploy.

### Worker crash-looping on boot

- Almost always a config error — the worker validates env at startup and exits
  with a message listing the offending variables. Read the first log lines; fix
  the env (commonly `SECRETS_ENCRYPTION_KEY`, `DATABASE_URL`, `REDIS_URL`).

### Migration / schema drift (`column ... does not exist`)

- The DB schema is behind the code. Migrations run via `prisma migrate deploy`:
  - **Compose:** the `migrate` service runs it automatically and api/worker
    `depends_on` its successful completion, so `up -d` self-orders migrations
    before the apps start. Re-run on demand with
    `docker compose -f infra/docker/docker-compose.prod.yml run --rm migrate`.
  - **Kubernetes:** apply the `shipyard-migrate` Job and wait for it to complete
    **before** rolling out api/worker (a completed Job is immutable — delete or
    re-tag it per release).
- (You'll see drift as `prisma:error ... column X does not exist` in logs against
  an un-migrated DB.)

### Budget alerts / runaway cost

- The `cost` scheduler rolls per-preview usage to dollars against the
  `COST_PER_*` rates; budgets surface on the dashboard. If costs spike: look for
  previews that never auto-stopped (lower `PREVIEW_AUTO_STOP_MINUTES` /
  `PREVIEW_DESTROY_TTL_MINUTES`), confirm the `cleanup` scheduler is ticking, and
  manually destroy stragglers from the dashboard or by enqueuing `destroy`.

---

## Rotating `SECRETS_ENCRYPTION_KEY`

`SECRETS_ENCRYPTION_KEY` (base64 32 bytes) encrypts stored env-var secrets at
rest with AES-256-GCM. It is **decryption-critical**: rotating it naively makes
every existing encrypted `EnvVar` undecryptable.

> ⚠️ Do not just swap the key and restart. Existing ciphertext is bound to the
> old key.

Safe rotation:

1. **Generate** a new key: `openssl rand -base64 32`.
2. **Re-encrypt** existing secrets with the new key (decrypt-with-old →
   encrypt-with-new) in a maintenance window. There is no built-in rotation CLI
   in this build, so run a one-off script using `@shipyard/core`'s
   `decryptSecret`/`encryptSecret` against the `EnvVar` table, reading the old
   key from the current env and writing ciphertext for the new key. Back up
   Postgres first.
3. **Roll** the key into the Secret/`.env` and restart api + worker together so
   both pick it up atomically.
4. If you cannot re-encrypt (key lost): the affected secrets are unrecoverable —
   re-enter them in the dashboard after setting the new key, which writes fresh
   ciphertext.

Keep the key in your secret manager, separate from DB backups, and audit access.
