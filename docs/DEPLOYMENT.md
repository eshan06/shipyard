# Shipyard — Deployment

How to build the Shipyard container images and deploy the stack, either with
Docker Compose (single host / staging) or Kubernetes (multi-node). For
day-2 operations (health, scaling, backups, failure modes) see
[`RUNBOOK.md`](./RUNBOOK.md).

The stack is five processes:

| Service  | Image                  | Port | Notes                                            |
| -------- | ---------------------- | ---- | ------------------------------------------------ |
| web      | `shipyard-web`         | 3000 | Next.js dashboard (`next start`)                 |
| api      | `shipyard-api`         | 4000 | Fastify control plane (REST + webhooks + SSE)    |
| worker   | `shipyard-worker`      | —    | BullMQ consumers (deploy/destroy/cleanup/cost)   |
| postgres | `postgres:16-alpine`   | 5432 | primary datastore                                |
| redis    | `redis:7-alpine`       | 6379 | BullMQ queues + pub/sub                          |

---

## 1. Build the images

All three Dockerfiles use the **repo root as the build context** (they need the
lockfile, workspace manifests and the shared `packages/*`). Build from the repo
root:

```bash
docker build -f apps/api/Dockerfile    -t shipyard-api:latest    .
docker build -f apps/worker/Dockerfile -t shipyard-worker:latest .
docker build -f apps/web/Dockerfile    -t shipyard-web:latest    .
```

Each is multi-stage (`base → deps → build → runtime`):

- **deps** installs the workspace from `pnpm-lock.yaml` (`--frozen-lockfile`),
  cached on the manifests so source-only changes reuse the layer.
- **build** runs `prisma generate` (api/worker), builds the library packages
  (`@shipyard/core`, `@shipyard/db`, `@shipyard/deploy-engine`) and then the app.
- **runtime** is a slim `node:22-slim` image carrying `node_modules`, the app
  `dist`, and — for api/worker — the generated Prisma client + engine. tsup keeps
  runtime deps external, so `node_modules` must be present (it is).

> The base image is Debian (`node:22-slim`); the Prisma engine generated in the
> image is `libquery_engine-debian-openssl-3.0.x`, which matches. `openssl` and
> `ca-certificates` are installed for the engine.

### Tag & push to a registry

Replace `OWNER` with your registry namespace (the k8s manifests use
`ghcr.io/OWNER/shipyard-*:latest` placeholders):

```bash
export REG=ghcr.io/OWNER TAG=$(git rev-parse --short HEAD)
for app in api worker web; do
  docker build -f apps/$app/Dockerfile -t $REG/shipyard-$app:$TAG -t $REG/shipyard-$app:latest .
  docker push $REG/shipyard-$app:$TAG
  docker push $REG/shipyard-$app:latest
done
```

---

## 2. Environment variables

Every service validates its env at startup with a zod schema and **fails fast**
with a list of the offending variables. The full contract lives in
[`ENGINEERING.md` §4](./ENGINEERING.md) and `.env.example`. The essentials:

**Shared (api + worker)**

| Var                      | Required | Notes                                                  |
| ------------------------ | -------- | ------------------------------------------------------ |
| `DATABASE_URL`           | yes      | Postgres connection string                             |
| `REDIS_URL`              | yes      | Redis connection string (BullMQ)                       |
| `SECRETS_ENCRYPTION_KEY` | yes      | base64 32 bytes — `openssl rand -base64 32`            |
| `PREVIEW_BASE_DOMAIN`    | yes      | wildcard domain for preview URLs (`<slug>.<domain>`)   |
| `NODE_ENV` / `LOG_LEVEL` | no       | `production` / `info`                                  |

**API**

| Var                                                   | Required | Notes                                  |
| ----------------------------------------------------- | -------- | -------------------------------------- |
| `SESSION_SECRET`                                      | yes      | ≥ 32 chars — `openssl rand -hex 32`    |
| `PUBLIC_API_URL` / `PUBLIC_APP_URL`                   | yes      | public URLs (CORS + OAuth redirects)   |
| `API_HOST` / `API_PORT`                               | no       | default `0.0.0.0` / `4000`             |
| `DEV_AUTH`                                            | no       | **keep `false` in prod**               |
| `TRUST_PROXY`                                         | no       | trust `X-Forwarded-*`; default `true` — in prod set hop-count (`1`) or the proxy subnet, else IP spoofing |
| `GITHUB_OAUTH_CLIENT_ID/SECRET`                       | no       | enable dashboard OAuth login           |
| `GITHUB_WEBHOOK_SECRET`                               | webhooks | must match the GitHub App; verification **401s when unset** |
| `RATE_LIMIT_MAX` / `RATE_LIMIT_WINDOW`                | no       | default `200` / `1 minute`             |
| `PRISMA_LOG`                                          | no       | optional Prisma log levels (`query,info,warn,error`) |

**Worker**

| Var                                                  | Required | Notes                                       |
| ---------------------------------------------------- | -------- | ------------------------------------------- |
| `DEPLOY_DRIVER`                                       | no       | `mock` (default) or `docker`                |
| `DOCKER_HOST`                                         | no       | only for the `docker` driver                |
| `WORKER_CONCURRENCY`                                  | no       | jobs in flight per worker (default 4)       |
| `CLEANUP_INTERVAL_MS` / `COST_INTERVAL_MS`           | no       | scheduler cadence                           |
| `PREVIEW_AUTO_STOP_MINUTES` / `PREVIEW_DESTROY_TTL_MINUTES` | no | idle auto-stop / closed-PR destroy TTL  |
| `COST_PER_*`                                          | no       | cost model rates                            |

**Web** — all `NEXT_PUBLIC_*` are **build-time** (see the note below)

| Var                       | Required | Notes                                                        |
| ------------------------- | -------- | ------------------------------------------------------------ |
| `NEXT_PUBLIC_API_URL`     | yes      | API base; also read at runtime by the Next rewrite (below)   |
| `NEXT_PUBLIC_DEPLOY_DRIVER` | no     | `mock` (simulated previews) or `docker` (link to live URL)   |
| `NEXT_PUBLIC_DEV_AUTH`    | no       | gates the dashboard dev-login form; **keep `false` in prod** |

> **`NEXT_PUBLIC_*` are inlined at image BUILD time** by `next build` — they are
> baked into the browser bundle and **cannot** be changed at container runtime.
> For the prebuilt web image, pass them as Docker **build-args** (the release
> workflow and `apps/web/Dockerfile` wire `NEXT_PUBLIC_API_URL` and
> `NEXT_PUBLIC_DEPLOY_DRIVER`).
>
> The same-origin `/api/v1/*` calls are proxied server-side by the web app's
> catch-all Route Handler (`apps/web/src/app/api/v1/[...path]/route.ts`), which
> resolves its upstream **at runtime** as `API_URL ?? NEXT_PUBLIC_API_URL`.
> Compose/k8s therefore set `API_URL` (and `NEXT_PUBLIC_API_URL`) as runtime
> env on the web container. In-cluster, point it at the API Service
> (`http://shipyard-api:4000`); with Compose, `http://api:4000`.

Never commit a real `.env`. `SECRETS_ENCRYPTION_KEY` encrypts env vars at rest
(AES-256-GCM); losing or rotating it makes existing encrypted secrets
unreadable — see [`RUNBOOK.md`](./RUNBOOK.md#rotating-secrets_encryption_key).

---

## 3. Deploy with Docker Compose (single host / staging)

`infra/docker/docker-compose.prod.yml` runs the whole stack: postgres, redis,
api, worker, web, plus a `migrate` service that runs `prisma migrate deploy`
before the apps start.

```bash
# 1. Prepare env at the REPO ROOT. Each service loads it via `env_file: ../../.env`
#    (an explicit path), so this "just works" — no --env-file flag needed.
cp .env.example .env
#    Set at minimum:
#      SECRETS_ENCRYPTION_KEY=$(openssl rand -base64 32)
#      SESSION_SECRET=$(openssl rand -hex 32)
#      GITHUB_WEBHOOK_SECRET=<your GitHub App webhook secret>   # 401s if unset
#      DEV_AUTH=false
#    DATABASE_URL / REDIS_URL in .env are the host-dev localhost values and are
#    intentionally IGNORED by this stack: the compose file pins the in-network
#    service names (postgres:5432 / redis:6379). To use a MANAGED DB/cache,
#    export the override in your shell before `up` (see the note below) — do not
#    rely on the .env values for these two.

# 2. Build (or pull) the images
docker compose -f infra/docker/docker-compose.prod.yml build

# 3. Start the stack — migrations run first, automatically
docker compose -f infra/docker/docker-compose.prod.yml up -d

# 4. Verify
curl -fsS localhost:4000/healthz   # {"status":"ok"}
curl -fsS localhost:4000/readyz    # {"status":"ready","db":true,"redis":true}
open http://localhost:3000         # dashboard
```

- **Env precedence:** app config (secrets, `DEV_AUTH`, `GITHUB_*`,
  `DEPLOY_DRIVER`, `PREVIEW_*`, `COST_*`, …) comes from the repo-root `.env` via
  `env_file`, so operator values reach the containers. Only container-internal
  wiring (`DATABASE_URL`/`REDIS_URL` service names, `NODE_ENV=production`,
  `API_HOST`/`API_PORT`, web `PORT`) is pinned in the compose `environment:`
  block, which is why it overrides the `.env` localhost DB/Redis values.
- **Self-ordering migrations:** the `migrate` service runs `prisma migrate deploy`
  and exits; `api` and `worker` `depends_on` it with
  `service_completed_successfully`, so a plain `up -d` always migrates the schema
  before the apps boot. It is idempotent (a no-op when the schema is current), so
  it re-runs safely on every `up`. To run it alone:
  `docker compose -f infra/docker/docker-compose.prod.yml run --rm migrate`.
- `depends_on` also uses health conditions: api/worker wait for postgres+redis to
  be healthy; web waits for api to be healthy.
- **Managed DB/cache:** export the connection strings before `up` (they win via
  interpolation) and drop the bundled `postgres`/`redis` services:
  ```bash
  export DATABASE_URL='postgresql://user:pass@managed-host:5432/shipyard?schema=public'
  export REDIS_URL='rediss://managed-cache:6380'
  docker compose -f infra/docker/docker-compose.prod.yml up -d
  ```
- For the **`docker` deploy driver**, set `DEPLOY_DRIVER=docker` in `.env` and
  uncomment the `/var/run/docker.sock` mount on the `worker` service (single-host
  only — this grants the worker root-equivalent access to the host daemon).
- Every service has bounded json-file logging (`max-size: 10m`, `max-file: 3`)
  and CPU/memory limits set via `deploy.resources` (honored by `docker compose`).

Validate the compose file without starting anything:

```bash
docker compose -f infra/docker/docker-compose.prod.yml config
```

---

## 4. Deploy to Kubernetes

Manifests live in `infra/k8s/` (numbered for apply order). They use two
substitution tokens — `OWNER` (your GHCR namespace) and `REPLACE_TAG` (the
immutable release tag CI pushed) — plus `example.com` hostnames. See
[`infra/k8s/README.md`](../infra/k8s/README.md) for the full substitution guide
(including a ready-to-run `sed` one-liner and Kustomize notes).

```bash
# 0. Push your images (see the release workflow), then substitute the tokens:
#    - infra/k8s/30-migrate-job.yaml, 40-api.yaml, 50-worker.yaml, 60-web.yaml
#      → image: ghcr.io/OWNER/shipyard-*:REPLACE_TAG   (OWNER + immutable tag)
#    - infra/k8s/10-configmap.yaml  → PUBLIC_*_URL, PREVIEW_BASE_DOMAIN, NEXT_PUBLIC_API_URL
#    - infra/k8s/70-ingress.yaml    → hostnames + TLS
#    Use the SAME REPLACE_TAG for the migrate Job and all three workloads.

# 1. Namespace + non-secret config
kubectl apply -f infra/k8s/00-namespace.yaml
kubectl apply -f infra/k8s/10-configmap.yaml

# 2. Secrets — DO NOT use the template values. Create the real Secret:
kubectl -n shipyard create secret generic shipyard-secrets \
  --from-literal=DATABASE_URL='postgresql://USER:PASS@postgres:5432/shipyard?schema=public' \
  --from-literal=REDIS_URL='redis://redis:6379' \
  --from-literal=SECRETS_ENCRYPTION_KEY="$(openssl rand -base64 32)" \
  --from-literal=SESSION_SECRET="$(openssl rand -hex 32)" \
  --from-literal=GITHUB_OAUTH_CLIENT_ID='' \
  --from-literal=GITHUB_OAUTH_CLIENT_SECRET='' \
  --from-literal=GITHUB_WEBHOOK_SECRET='' \
  --from-literal=GITHUB_APP_ID='' \
  --from-literal=GITHUB_APP_PRIVATE_KEY=''
#   `infra/k8s/20-secret.example.yaml` is a committed *template* showing the keys.
#   It is named `*.example.yaml` on purpose so a directory apply
#   (`kubectl apply -f infra/k8s/`) never applies it and clobbers this real
#   Secret — doing so would crash-loop api/worker on an invalid encryption key AND
#   make all stored ciphertext undecryptable. Prefer an external-secrets /
#   sealed-secrets operator in real clusters.

# 3. Run DB migrations (Job) BEFORE rolling out api/worker:
kubectl apply -f infra/k8s/30-migrate-job.yaml
kubectl -n shipyard wait --for=condition=complete job/shipyard-migrate --timeout=300s

# 4. Deploy services
kubectl apply -f infra/k8s/40-api.yaml
kubectl apply -f infra/k8s/50-worker.yaml
kubectl apply -f infra/k8s/60-web.yaml
kubectl apply -f infra/k8s/70-ingress.yaml

# 5. Verify
kubectl -n shipyard get pods,svc,ingress
kubectl -n shipyard rollout status deploy/shipyard-api
```

> **Postgres & Redis**: the manifests assume they are reachable in-cluster at
> `postgres:5432` / `redis:6379` (deploy them via your preferred chart, or use a
> managed service and put the real connection strings in the Secret). They are
> intentionally not bundled as stateful workloads here.

> **Migrations on every release**: a completed Job is immutable. Either delete
> the old Job before re-applying, template the Job name with the release tag, or
> run migrations as a Helm/ArgoCD pre-sync hook. Apply the api/worker rollout
> only after the migration Job completes.

### Substitution checklist (placeholders to fill in)

- `ghcr.io/OWNER/shipyard-api:REPLACE_TAG`   → your API image + immutable tag
- `ghcr.io/OWNER/shipyard-worker:REPLACE_TAG` → your worker image + immutable tag
- `ghcr.io/OWNER/shipyard-web:REPLACE_TAG`   → your web image + immutable tag
- Hostnames `*.shipyard.example.com` in the ConfigMap + Ingress
- TLS `secretName: shipyard-tls` (cert-manager `letsencrypt-prod` issuer, or your own)
- Create the real `shipyard-secrets` out-of-band — do **not** apply
  `20-secret.example.yaml` (see [`infra/k8s/README.md`](../infra/k8s/README.md))

---

## 5. CI / CD

**`.github/workflows/ci.yml`** runs on every push / PR:

- `lint`, `typecheck`, `test`, `build` (JS workspace).
- The `test` job runs `prisma validate` and `prisma migrate deploy` against a
  service Postgres before the tests, so the schema and every migration are
  exercised on each PR.
- A `docker-build` matrix builds all three images (`api`, `worker`, `web`)
  from their Dockerfiles — **build only, no push** — with GitHub Actions layer
  caching, so Dockerfile/COPY-list drift fails CI instead of a release.

**`.github/workflows/release.yml`** runs on a pushed git tag `v*` (or manual
dispatch): it builds and **pushes** the three images to
`ghcr.io/<owner>/shipyard-{api,worker,web}`, tagged with the git tag **and**
`latest`, using the built-in `GITHUB_TOKEN` (`packages: write`) — no extra
secrets. The web image receives its `NEXT_PUBLIC_*` as build-args. After a
release, substitute `REPLACE_TAG` with the pushed tag in the k8s manifests (or
`docker compose pull`) and roll out — running the migration Job / `migrate`
service first.
