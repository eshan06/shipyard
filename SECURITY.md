# Security Policy

Thanks for helping keep Shipyard and its users safe. Shipyard is a preview-
environments platform: it ingests GitHub webhooks, builds and runs per-pull-
request preview stacks, and stores team secrets that are injected into those
environments. Because previews can execute customer-supplied code, we take
reports about isolation, secret handling, and authentication especially
seriously.

This document explains what versions are supported, how to report a
vulnerability, and the security model you can rely on (and its current limits).

---

## Supported versions

Shipyard is pre-1.0 (`0.x`) and ships from a single active line. We provide
security fixes for:

| Version                         | Supported          |
| ------------------------------- | ------------------ |
| Latest tagged release (`v*`)    | :white_check_mark: |
| `main` (HEAD)                   | :white_check_mark: |
| Any older tagged release        | :x:                |

There are no long-term-support branches yet. If you run a self-hosted
deployment, track the latest release; fixes are delivered forward, not
backported.

---

## Reporting a vulnerability

**Please do not open a public GitHub issue for security problems.** Public
disclosure before a fix is available puts every deployment at risk.

Instead, report privately to:

- **Email:** `[[SECURITY_CONTACT_EMAIL]]`  <!-- replace with your monitored security inbox -->
- Optionally, use GitHub's **private vulnerability reporting** ("Report a
  vulnerability" under the repository's *Security* tab) if it is enabled.

To help us triage quickly, please include:

1. A description of the issue and its impact.
2. The affected component (`apps/api`, `apps/worker`, `apps/web`,
   `packages/*`, or the deploy/infra config).
3. Reproduction steps or a proof of concept.
4. The version / commit SHA you tested, and your configuration where relevant
   (e.g. `DEPLOY_DRIVER=docker` vs `mock`).
5. Any suggested remediation, if you have one.

If you need to send sensitive material, ask in your first email and we will
arrange an encrypted channel.

### What to expect

- **Acknowledgement:** we aim to confirm receipt within **3 business days**.
- **Assessment:** an initial severity assessment and next steps within **10
  business days**.
- **Updates:** periodic progress updates until the issue is resolved.
- **Credit:** with your permission, we are happy to credit you once a fix ships.

These are good-faith targets for a small team, not a contractual SLA.

### Coordinated disclosure

We follow coordinated disclosure. Please give us a reasonable window to
investigate and ship a fix before any public disclosure — **90 days** is our
default target, and we will work with you if a fix needs longer or a report
warrants faster action. We will let you know when a fix is released so we can
disclose together.

### Safe harbor

We will not pursue or support legal action against researchers who, in good
faith, follow this policy: who avoid privacy violations, data destruction, and
service degradation, who only interact with accounts they own or have explicit
permission to test, and who give us a reasonable time to remediate before
disclosure.

---

## Scope

**In scope** — the Shipyard control plane in this repository:

- `apps/api` — the Fastify control-plane API (auth, RBAC, webhooks, SSE).
- `apps/worker` — the BullMQ worker that orchestrates preview stacks.
- `apps/web` — the Next.js dashboard.
- `packages/*` — shared libraries (`core` crypto/auth primitives, `db`,
  `deploy-engine`).
- The deployment and CI artifacts in `infra/` and `.github/workflows/`.

**Out of scope** (report to the relevant upstream instead):

- Vulnerabilities in third-party dependencies with no Shipyard-specific impact
  (report upstream; tell us if Shipyard's usage makes them exploitable).
- Findings that require a pre-compromised host, a malicious operator with valid
  admin credentials, or physical access.
- Social engineering, spam, or volumetric DoS.
- Missing hardening that is already documented as a known limitation below.

---

## Security model

This section describes what Shipyard actually does today, verified against the
code. Where a protection is still in progress, we say so rather than overclaim.

### Secrets at rest — AES-256-GCM

Team/preview environment variables are stored **encrypted** in Postgres
(`EnvVar.valueEncrypted`), never in plaintext. Encryption is authenticated
AES-256-GCM (`packages/core/src/crypto.ts`):

- A single 32-byte key from `SECRETS_ENCRYPTION_KEY` (base64) encrypts all
  secrets. It is validated at startup; the service fails fast if it is missing
  or the wrong length.
- Each value uses a **fresh random 96-bit IV**, and the payload is stored in a
  versioned format (`v1:<iv>:<tag>:<ciphertext>`, each part base64) so the
  scheme can evolve without breaking existing ciphertext.
- The 128-bit GCM authentication tag is verified on decrypt: tampering with any
  part of the payload, or using the wrong key, causes decryption to fail rather
  than return corrupted data.

The key is **decryption-critical**: it must be stored in a secret manager,
separate from database backups, and rotated only via re-encryption (see
`docs/RUNBOOK.md` → *Rotating `SECRETS_ENCRYPTION_KEY`*). A database backup is
useless without the key.

### Session authentication — signed JWT cookie

Dashboard sessions use a JSON Web Token signed with **HS256** over
`SESSION_SECRET` (`apps/api/src/plugins/auth.ts`). The token is delivered in a
cookie named `sy_session` with:

- `httpOnly` — not readable from JavaScript;
- `sameSite=lax` — mitigates cross-site request forgery on state-changing
  requests;
- `secure` — set when `NODE_ENV=production` (HTTPS-only);
- a 30-day expiry that matches the JWT's own expiration.

`SESSION_SECRET` must be a strong random value (`openssl rand -hex 32`); the
config layer enforces a minimum length at startup.

### API tokens — SHA-256 hashed, team-scoped

Programmatic access (CLI/CI) uses bearer tokens (`apps/api/src/lib/tokens.ts`):

- Tokens are minted with 32 bytes of randomness and a `shipyard_` prefix, and
  shown to the user **exactly once** at creation.
- Only their **SHA-256 hash** and a short display prefix are persisted
  (`ApiToken`); a database leak never exposes a usable credential.
- On each request the presented token is hashed and looked up; tokens are
  **team-scoped** (bound to their owning team), carry **scopes**, and honor
  `revokedAt` / `expiresAt`, so RBAC can confine a token to a single team.

### Webhook authenticity — HMAC-SHA256

Inbound GitHub webhooks (`POST /api/v1/webhooks/github`) are authenticated by
signature, not by session (`apps/api/src/routes/webhooks.ts`):

- The `X-Hub-Signature-256` header is verified as an **HMAC-SHA256** over the
  exact raw request bytes using `GITHUB_WEBHOOK_SECRET`, with a **constant-time**
  comparison (`crypto.timingSafeEqual`).
- Verification **hard-fails with `401` when the secret is unset** or the
  signature is missing/invalid — there is no unauthenticated fallback. Ship
  `GITHUB_WEBHOOK_SECRET` set to the value configured in your GitHub App; never
  leave a committed default in place.
- Deliveries are recorded and de-duplicated by delivery id, so replays are not
  reprocessed.

### Transport, headers, and rate limiting

- `helmet` sets standard security headers on the API. (The Swagger UI at `/docs`
  requires inline assets, so the Content-Security-Policy is relaxed for that
  build — scope or disable `/docs` on public deployments accordingly.)
- Per-IP/token rate limiting is applied (`RATE_LIMIT_MAX` / `RATE_LIMIT_WINDOW`).
  It depends on an accurate client IP. `TRUST_PROXY` controls how much
  `X-Forwarded-*` is trusted and **defaults to `true`** for local/dev
  convenience; in production, constrain it to the number of proxy hops (`1`) or
  your proxy's IP/subnet so clients cannot spoof `X-Forwarded-For` to evade the
  limits. Do not leave it `true` when the API is directly reachable.
- Every service validates its entire environment at startup and refuses to boot
  on an invalid/missing value, so misconfiguration fails loudly instead of
  degrading security silently.

### Preview workload isolation — known limitation, hardening in progress

Shipyard builds and runs **customer-supplied code** in per-PR preview stacks. Be
aware of the current posture:

- With `DEPLOY_DRIVER=docker`, previews are built and run via the Docker daemon
  (`packages/deploy-engine`, dockerode). On a single host, giving the worker
  access to the daemon (e.g. binding `/var/run/docker.sock`) grants it
  **root-equivalent control of that host**. Run this only on hosts dedicated to
  Shipyard, ideally with a rootless/remote daemon or a per-tenant node.
- Preview containers are **not yet strongly sandboxed** from each other or from
  the host beyond standard container boundaries. Stronger isolation
  (per-tenant nodes, gVisor/Kata-style runtimes, network egress policy, seccomp/
  AppArmor profiles, and resource caps) is **in progress**.
- Until that lands, treat any single-host `docker`-driver deployment as trusting
  the code that runs in previews. The default `DEPLOY_DRIVER=mock` runs no
  customer code at all.

The Kubernetes manifests (`infra/k8s/`) run the control-plane workloads as a
non-root user with dropped capabilities, `allowPrivilegeEscalation: false`, and
(for api/worker) a read-only root filesystem — but the same preview-isolation
caveats apply to wherever previews are actually executed.

---

## Operator responsibilities

Shipyard's security depends on how you run it. At minimum:

- Generate strong, unique `SECRETS_ENCRYPTION_KEY` and `SESSION_SECRET`; store
  them in a secret manager and back the encryption key up separately from the
  database.
- Set `GITHUB_WEBHOOK_SECRET` to your GitHub App's webhook secret.
- Keep `DEV_AUTH=false` (and `NEXT_PUBLIC_DEV_AUTH=false`) in every deployed
  environment — the dev-login path is password-less by design.
- Terminate TLS in front of the API and dashboard, and set `TRUST_PROXY`
  correctly for your proxy.
- Never commit a real `.env` or a populated `infra/k8s/20-secret.example.yaml`.

See `docs/DEPLOYMENT.md` and `docs/RUNBOOK.md` for the full deployment and
day-2 operational guidance.
