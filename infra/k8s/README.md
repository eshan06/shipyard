# Shipyard — Kubernetes manifests

Plain, dependency-free manifests for the Shipyard control plane, numbered for
apply order. They are deliberately templating-free (no Helm/Kustomize required):
you fill in a few well-known **substitution points** and apply. For the full
deploy walkthrough see [`../../docs/DEPLOYMENT.md`](../../docs/DEPLOYMENT.md); for
day-2 ops see [`../../docs/RUNBOOK.md`](../../docs/RUNBOOK.md).

| File                      | Kind                | Notes                                             |
| ------------------------- | ------------------- | ------------------------------------------------- |
| `00-namespace.yaml`       | Namespace           | `shipyard`                                         |
| `10-configmap.yaml`       | ConfigMap           | non-secret config; **edit hostnames**             |
| `20-secret.example.yaml`  | Secret (TEMPLATE)   | shape only — **never applied directly** (see below) |
| `30-migrate-job.yaml`     | Job                 | `prisma migrate deploy`; run before api/worker    |
| `40-api.yaml`             | Deployment+Service  | Fastify control plane                             |
| `50-worker.yaml`          | Deployment          | BullMQ worker (headless)                          |
| `60-web.yaml`             | Deployment+Service  | Next.js dashboard                                 |
| `70-ingress.yaml`         | Ingress             | ingress-nginx + cert-manager example; **edit hosts** |

---

## Substitution points

Three things must be replaced before these manifests will run in your cluster.
They are intentionally the same tokens everywhere so a one-line `sed` (or a
Kustomize overlay) can template them.

### 1. `OWNER` — your container registry namespace

The four workloads reference `ghcr.io/OWNER/shipyard-{api,worker,web}`. Replace
`OWNER` with the GitHub owner CI pushed images under (`github.com/<owner>`). The
release workflow (`.github/workflows/release.yml`) publishes to
`ghcr.io/${{ github.repository_owner }}/shipyard-*`.

### 2. `REPLACE_TAG` — the immutable release tag

Every image is pinned to `:REPLACE_TAG` (NOT `:latest`). Set it to the immutable
tag CI pushed for the release you are deploying — the git tag (e.g. `v1.4.0`) or
the commit SHA. Use the **same** tag for `30-migrate-job.yaml`, `40-api.yaml`,
`50-worker.yaml` and `60-web.yaml` so the migrations match the rollout.

> **Why an immutable tag + `imagePullPolicy: IfNotPresent`?** A unique per-release
> tag is never already cached on a node, so `IfNotPresent` still pulls it on every
> rollout — while avoiding needless re-pulls of an unchanged image. If you must
> deploy a **mutable** tag (e.g. `latest`), switch the affected
> `imagePullPolicy` to `Always`, or nodes may silently run a stale image.

### 3. Hostnames / domains

`example.com` placeholders live in `10-configmap.yaml` (`PUBLIC_API_URL`,
`PUBLIC_APP_URL`, `PREVIEW_BASE_DOMAIN`) and `70-ingress.yaml` (the two `host:`
entries + the TLS `hosts`). Replace with your real domains and TLS setup.

### One-liner (sed)

Applied from the repo root; writes the substituted YAML to `k8s.rendered.yaml`:

```bash
export OWNER=my-org TAG=v1.4.0
sed -e "s|OWNER|${OWNER}|g" -e "s|REPLACE_TAG|${TAG}|g" \
    -e "s|shipyard.example.com|shipyard.mydomain.io|g" \
    -e "s|api.shipyard.example.com|api.shipyard.mydomain.io|g" \
    -e "s|preview.shipyard.example.com|preview.mydomain.io|g" \
    infra/k8s/00-namespace.yaml infra/k8s/10-configmap.yaml \
    infra/k8s/30-migrate-job.yaml infra/k8s/40-api.yaml \
    infra/k8s/50-worker.yaml infra/k8s/60-web.yaml infra/k8s/70-ingress.yaml \
    > k8s.rendered.yaml
# then: kubectl apply -f k8s.rendered.yaml   (secret created separately, see below)
```

> `OWNER` is substituted before `REPLACE_TAG`; the order above avoids partial
> matches. With Kustomize, prefer `images:` (name/newTag) and a `configMapGenerator`
> overlay instead of `sed`.

---

## The Secret is created out-of-band — NOT from a file here

`20-secret.example.yaml` is a **template that documents the Secret's keys**. It is
named `*.example.yaml` so `kubectl apply -f infra/k8s/` (a directory apply) does
**not** pick it up. This is a safety guard, not a style choice:

> If the placeholder `REPLACE_ME`/`CHANGE_ME` values ever overwrote the real
> `shipyard-secrets` Secret, api/worker would crash-loop on an invalid
> `SECRETS_ENCRYPTION_KEY` **and every env-var ciphertext stored in Postgres would
> become permanently undecryptable.** See the RUNBOOK's key-rotation section.

Create the real Secret directly (or, better, via a sealed-secrets /
external-secrets operator or your cloud secret manager):

```bash
kubectl -n shipyard create secret generic shipyard-secrets \
  --from-literal=DATABASE_URL='postgresql://USER:PASS@postgres:5432/shipyard?schema=public' \
  --from-literal=REDIS_URL='redis://redis:6379' \
  --from-literal=SECRETS_ENCRYPTION_KEY="$(openssl rand -base64 32)" \
  --from-literal=SESSION_SECRET="$(openssl rand -hex 32)" \
  --from-literal=GITHUB_OAUTH_CLIENT_ID='' \
  --from-literal=GITHUB_OAUTH_CLIENT_SECRET='' \
  --from-literal=GITHUB_WEBHOOK_SECRET=''
```

Set `GITHUB_WEBHOOK_SECRET` to the exact shared secret configured in your GitHub
App — webhook verification hard-fails (401) when it is unset.

---

## Apply order

```bash
kubectl apply -f infra/k8s/00-namespace.yaml
kubectl apply -f infra/k8s/10-configmap.yaml
# create the Secret out-of-band (above) — do NOT apply 20-secret.example.yaml
kubectl apply -f infra/k8s/30-migrate-job.yaml
kubectl -n shipyard wait --for=condition=complete job/shipyard-migrate --timeout=300s
kubectl apply -f infra/k8s/40-api.yaml
kubectl apply -f infra/k8s/50-worker.yaml
kubectl apply -f infra/k8s/60-web.yaml
kubectl apply -f infra/k8s/70-ingress.yaml
```

A completed Job is immutable: on each release either delete the old
`shipyard-migrate` Job first, template its name with the tag, or run migrations
as a Helm/ArgoCD pre-sync hook. Roll api/worker only after it completes.
