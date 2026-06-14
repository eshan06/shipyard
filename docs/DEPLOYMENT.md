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
| `SESSION_SECRET`                                      | yes      | ≥ 16 chars — `openssl rand -hex 32`    |
| `PUBLIC_API_URL` / `PUBLIC_APP_URL`                   | yes      | public URLs (CORS + OAuth redirects)   |
| `API_HOST` / `API_PORT`                               | no       | default `0.0.0.0` / `4000`             |
| `DEV_AUTH`                                            | no       | **keep `false` in prod**               |
| `GITHUB_OAUTH_CLIENT_ID/SECRET`, `GITHUB_WEBHOOK_SECRET` | no    | enable login / webhook verification    |
| `RATE_LIMIT_MAX` / `RATE_LIMIT_WINDOW`                | no       | default `200` / `1 minute`             |

**Worker**

| Var                                                  | Required | Notes                                       |
| ---------------------------------------------------- | -------- | ------------------------------------------- |
| `DEPLOY_DRIVER`                                       | no       | `mock` (default) or `docker`                |
| `DOCKER_HOST`                                         | no       | only for the `docker` driver                |
| `WORKER_CONCURRENCY`                                  | no       | jobs in flight per worker (default 4)       |
| `CLEANUP_INTERVAL_MS` / `COST_INTERVAL_MS`           | no       | scheduler cadence                           |
| `PREVIEW_AUTO_STOP_MINUTES` / `PREVIEW_DESTROY_TTL_MINUTES` | no | idle auto-stop / closed-PR destroy TTL  |
| `COST_PER_*`                                          | no       | cost model rates                            |

**Web**

| Var                  | Required | Notes                                                              |
| -------------------- | -------- | ----------------------------------------------------------------- |
| `NEXT_PUBLIC_API_URL`| yes      | API base; read **at runtime** by the Next rewrite (see below)     |

> The dashboard calls the API **same-origin** at `/api/v1/*` via a Next.js
> rewrite whose destination is `NEXT_PUBLIC_API_URL`, evaluated at **runtime** in
> `next.config.mjs`. So you set the API URL via env at container start — it is
> **not** baked into the build. In-cluster, point it at the API Service
> (`http://shipyard-api:4000`); with Compose, `http://api:4000`.

Never commit a real `.env`. `SECRETS_ENCRYPTION_KEY` encrypts env vars at rest
(AES-256-GCM); losing or rotating it makes existing encrypted secrets
unreadable — see [`RUNBOOK.md`](./RUNBOOK.md#rotating-secrets_encryption_key).

---

## 3. Deploy with Docker Compose (single host / staging)

`infra/docker/docker-compose.prod.yml` runs the whole stack: postgres, redis,
api, worker, web, plus a one-off `migrate` service (behind the `tools` profile).

```bash
# 1. Prepare env (in the repo root, used as env_file by api/worker)
cp .env.example .env
#    Set at minimum:
#      SECRETS_ENCRYPTION_KEY=$(openssl rand -base64 32)
#      SESSION_SECRET=$(openssl rand -hex 32)
#      DEV_AUTH=false
#    Connection strings default to the in-network service names
#    (postgres:5432 / redis:6379) — leave them unless you use an external DB.

# 2. Build (or pull) the images
docker compose -f infra/docker/docker-compose.prod.yml build

# 3. Run migrations ONCE before first boot / on every release with new migrations
docker compose -f infra/docker/docker-compose.prod.yml run --rm migrate

# 4. Start the stack
docker compose -f infra/docker/docker-compose.prod.yml up -d

# 5. Verify
curl -fsS localhost:4000/healthz   # {"status":"ok"}
curl -fsS localhost:4000/readyz    # {"status":"ready","db":true,"redis":true}
open http://localhost:3000         # dashboard
```

- `depends_on` uses health conditions: api/worker wait for postgres+redis to be
  healthy; web waits for api to be healthy.
- The `migrate` service reuses the API image to run
  `prisma migrate deploy`. It is gated behind the `tools` profile so it never
  starts as part of `up` — run it explicitly (step 3).
- To use a managed DB/cache, override `DATABASE_URL` / `REDIS_URL` in `.env` and
  drop the `postgres` / `redis` services.
- For the **`docker` deploy driver**, uncomment the `/var/run/docker.sock` mount
  on the `worker` service and set `DEPLOY_DRIVER=docker` (single-host only).

Validate the compose file without starting anything:

```bash
docker compose -f infra/docker/docker-compose.prod.yml config
```

---

## 4. Deploy to Kubernetes

Manifests live in `infra/k8s/` (numbered for apply order). They use placeholder
image refs `ghcr.io/OWNER/shipyard-*:latest` and example hostnames — edit both.

```bash
# 0. Push your images and edit the image refs + hostnames:
#    - infra/k8s/30-migrate-job.yaml, 40-api.yaml, 50-worker.yaml, 60-web.yaml
#      → image: ghcr.io/OWNER/shipyard-*:<tag>
#    - infra/k8s/10-configmap.yaml  → PUBLIC_*_URL, PREVIEW_BASE_DOMAIN, NEXT_PUBLIC_API_URL
#    - infra/k8s/70-ingress.yaml    → hostnames + TLS

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
  --from-literal=GITHUB_WEBHOOK_SECRET=''
#   (20-secret.yaml is a committed *template* showing the keys — prefer an
#    external-secrets/sealed-secrets operator in real clusters.)

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

### Image reference checklist (placeholders to fill in)

- `ghcr.io/OWNER/shipyard-api:latest`  → your API image
- `ghcr.io/OWNER/shipyard-worker:latest` → your worker image
- `ghcr.io/OWNER/shipyard-web:latest`  → your web image
- Hostnames `*.shipyard.example.com` in the ConfigMap + Ingress
- TLS `secretName: shipyard-tls` (cert-manager `letsencrypt-prod` issuer, or your own)

---

## 5. CI

`.github/workflows/ci.yml` runs typecheck, lint, test and build on every push /
PR. Extend it to build & push the three images on a tag/release and (optionally)
trigger the migration Job + rollout.
