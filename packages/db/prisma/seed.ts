/**
 * Shipyard development seed.
 *
 * Produces a RICH, fully-deterministic, and idempotent slice of demo data so
 * the dashboard looks believable out of the box: a team with members, two
 * projects, a spread of pull requests, previews in every interesting status,
 * deployments with builds (including realistic failures), services, coherent
 * streaming log stories, encrypted env vars, reviewers, cost history,
 * notifications, audit logs, webhook events, and an API token.
 *
 * ## Design principles
 *
 * - **Idempotent**: every write is an `upsert` keyed on a stable, explicit id
 *   (or a natural unique key), so running the seed repeatedly converges to the
 *   same state rather than duplicating rows.
 * - **Deterministic**: all timestamps are derived from a single fixed
 *   {@link BASE_DATE} constant via small helpers — no `Date.now()` /
 *   `new Date()` (no-arg) calls — so the produced data is byte-for-byte
 *   reproducible across runs and machines.
 * - **Coherent**: log chunks, build outcomes, service health, and preview
 *   status all tell the same story per preview.
 *
 * Run with: `pnpm --filter @shipyard/db seed` (or `pnpm db:seed` at the root).
 */

import {
  encryptSecret,
  generateEncryptionKey,
  loadEncryptionKey,
} from "@shipyard/core";

import {
  BuildStatus,
  DeploymentStatus,
  DeploymentTrigger,
  EnvScope,
  EnvTarget,
  LogLevel,
  LogSource,
  MembershipRole,
  NotificationType,
  Prisma,
  PreviewStatus,
  PullRequestState,
  RepoProvider,
  ReviewState,
  SeedKind,
  ServiceStatus,
  ServiceType,
  WebhookStatus,
  prisma,
} from "../src/index.js";

// ─────────────────────────────────────────────────────────────────────────────
// Deterministic time helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fixed reference instant for the whole seed. Everything is computed relative
 * to this so the dataset is reproducible. (Chosen to sit just after the demo
 * "now" so `expiresAt` values land in a believable near future.)
 */
const BASE_DATE = new Date("2026-06-14T12:00:00.000Z");

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Return a {@link Date} `ms` milliseconds *before* {@link BASE_DATE}. */
function ago(ms: number): Date {
  return new Date(BASE_DATE.getTime() - ms);
}

/** Return a {@link Date} `ms` milliseconds *after* {@link BASE_DATE}. */
function ahead(ms: number): Date {
  return new Date(BASE_DATE.getTime() + ms);
}

/** Add `ms` milliseconds to an existing {@link Date}. */
function plus(d: Date, ms: number): Date {
  return new Date(d.getTime() + ms);
}

// ─────────────────────────────────────────────────────────────────────────────
// Secrets bootstrap
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The base64-encoded 32-byte secrets key used to encrypt every seeded secret.
 * Resolved once by {@link ensureEncryptionKey} and threaded into
 * {@link encryptSecret}, which (per `@shipyard/core`) takes the key explicitly.
 */
let ENCRYPTION_KEY = "";

/**
 * Ensure a valid `SECRETS_ENCRYPTION_KEY` is present so {@link encryptSecret}
 * can run, and cache it in {@link ENCRYPTION_KEY}.
 *
 * In real environments the key is provided out-of-band; for local seeding we
 * generate a valid dev key (via `@shipyard/core`'s {@link generateEncryptionKey},
 * guaranteeing a base64-encoded 32-byte value) when one is missing, export it to
 * `process.env`, and log it so the developer can reuse it — otherwise re-running
 * with a different key would make previously-stored ciphertext undecryptable.
 */
function ensureEncryptionKey(): void {
  if (
    !process.env.SECRETS_ENCRYPTION_KEY ||
    process.env.SECRETS_ENCRYPTION_KEY.length === 0
  ) {
    const devKey = generateEncryptionKey();
    process.env.SECRETS_ENCRYPTION_KEY = devKey;
    console.warn(
      "[seed] SECRETS_ENCRYPTION_KEY was not set — generated a DEV key for this run.\n" +
        `[seed] SECRETS_ENCRYPTION_KEY=${devKey}\n` +
        "[seed] Add it to your .env to keep seeded secrets decryptable across runs.",
    );
  }
  // Validates length/format and returns the canonical base64 key.
  ENCRYPTION_KEY = loadEncryptionKey();
}

/**
 * Encrypt a plaintext secret using the resolved {@link ENCRYPTION_KEY}.
 * Centralises the two-argument `@shipyard/core` contract so call sites stay
 * terse and the key threading is in exactly one place.
 */
function encrypt(plaintext: string): string {
  return encryptSecret(plaintext, ENCRYPTION_KEY);
}

// ─────────────────────────────────────────────────────────────────────────────
// Stable id helpers (deterministic, human-readable, collision-free)
// ─────────────────────────────────────────────────────────────────────────────

/** Build a stable id with a namespaced prefix, e.g. `user_alice`. */
const id = (prefix: string, key: string): string => `${prefix}_${key}`;

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures: users
// ─────────────────────────────────────────────────────────────────────────────

interface UserSeed {
  key: string;
  email: string;
  name: string;
  githubLogin: string;
  githubId: string;
  isAdmin?: boolean;
}

const USERS: readonly UserSeed[] = [
  {
    key: "alice",
    email: "alice@acme.dev",
    name: "Alice Nguyen",
    githubLogin: "alicen",
    githubId: "1000001",
    isAdmin: true,
  },
  {
    key: "bob",
    email: "bob@acme.dev",
    name: "Bob Martínez",
    githubLogin: "bobm",
    githubId: "1000002",
  },
  {
    key: "carol",
    email: "carol@acme.dev",
    name: "Carol Smith",
    githubLogin: "carolcodes",
    githubId: "1000003",
  },
  {
    key: "dave",
    email: "dave@acme.dev",
    name: "Dave Okafor",
    githubLogin: "daveo",
    githubId: "1000004",
  },
  {
    key: "erin",
    email: "erin@acme.dev",
    name: "Erin Patel",
    githubLogin: "erinp",
    githubId: "1000005",
  },
] as const;

const userId = (key: string): string => id("user", key);
const avatarFor = (login: string): string =>
  `https://avatars.githubusercontent.com/${login}?v=4`;

// ─────────────────────────────────────────────────────────────────────────────
// Main seed
// ─────────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  ensureEncryptionKey();
  console.log("[seed] starting — base date:", BASE_DATE.toISOString());

  await seedUsers();
  const team = await seedTeam();
  await seedMemberships();

  const storefront = await seedStorefrontProject(team.id);
  const paymentsApi = await seedPaymentsProject(team.id);

  await seedProjectEnvVars(storefront.id, paymentsApi.id);
  await seedSeedTemplates(storefront.id, paymentsApi.id);

  const storefrontPrs = await seedStorefrontPullRequests(storefront.id);
  const paymentsPrs = await seedPaymentsPullRequests(paymentsApi.id);

  await seedStorefrontPreviews(storefront.id, storefrontPrs);
  await seedPaymentsPreviews(paymentsApi.id, paymentsPrs);

  await seedCostRecords();
  await seedNotifications();
  await seedReviews();
  await seedAuditLogs(team.id);
  await seedWebhookEvents();
  await seedApiToken(team.id);

  console.log("[seed] done.");
}

// ─────────────────────────────────────────────────────────────────────────────
// Users / team / memberships
// ─────────────────────────────────────────────────────────────────────────────

async function seedUsers(): Promise<void> {
  for (const u of USERS) {
    await prisma.user.upsert({
      where: { id: userId(u.key) },
      create: {
        id: userId(u.key),
        email: u.email,
        name: u.name,
        avatarUrl: avatarFor(u.githubLogin),
        githubId: u.githubId,
        githubLogin: u.githubLogin,
        isAdmin: u.isAdmin ?? false,
        createdAt: ago(120 * DAY),
        updatedAt: ago(2 * DAY),
      },
      update: {
        email: u.email,
        name: u.name,
        avatarUrl: avatarFor(u.githubLogin),
        githubId: u.githubId,
        githubLogin: u.githubLogin,
        isAdmin: u.isAdmin ?? false,
      },
    });
  }
  console.log(`[seed] users: ${USERS.length}`);
}

async function seedTeam(): Promise<{ id: string }> {
  const team = await prisma.team.upsert({
    where: { slug: "acme" },
    create: {
      id: id("team", "acme"),
      name: "Acme",
      slug: "acme",
      avatarUrl: "https://avatars.githubusercontent.com/acme-inc?v=4",
      budgetUsdMonthly: new Prisma.Decimal("750.00"),
      createdAt: ago(150 * DAY),
      updatedAt: ago(1 * DAY),
    },
    update: {
      name: "Acme",
      avatarUrl: "https://avatars.githubusercontent.com/acme-inc?v=4",
      budgetUsdMonthly: new Prisma.Decimal("750.00"),
    },
  });
  console.log("[seed] team: Acme");
  return { id: team.id };
}

async function seedMemberships(): Promise<void> {
  const roles: Record<string, MembershipRole> = {
    alice: MembershipRole.OWNER,
    bob: MembershipRole.ADMIN,
    carol: MembershipRole.MEMBER,
    dave: MembershipRole.MEMBER,
    erin: MembershipRole.VIEWER,
  };
  const teamId = id("team", "acme");
  for (const u of USERS) {
    const role = roles[u.key] ?? MembershipRole.MEMBER;
    await prisma.membership.upsert({
      where: { userId_teamId: { userId: userId(u.key), teamId } },
      create: {
        id: id("mem", `${u.key}_acme`),
        userId: userId(u.key),
        teamId,
        role,
        createdAt: ago(149 * DAY),
      },
      update: { role },
    });
  }
  console.log("[seed] memberships: 5");
}

// ─────────────────────────────────────────────────────────────────────────────
// Projects
// ─────────────────────────────────────────────────────────────────────────────

async function seedStorefrontProject(teamId: string): Promise<{ id: string }> {
  const config: Prisma.InputJsonValue = {
    composeFile: "infra/preview/docker-compose.yml",
    buildCommand: "pnpm build",
    installCommand: "pnpm install --frozen-lockfile",
    outputDirectory: ".next",
    nodeVersion: "20",
    healthcheck: { path: "/api/health", timeoutSeconds: 90 },
  };
  const project = await prisma.project.upsert({
    where: { teamId_slug: { teamId, slug: "storefront" } },
    create: {
      id: id("proj", "storefront"),
      teamId,
      name: "Storefront",
      slug: "storefront",
      provider: RepoProvider.GITHUB,
      repoFullName: "acme/storefront",
      repoId: "548921001",
      installationId: "44120093",
      defaultBranch: "main",
      framework: "next",
      rootDirectory: ".",
      config,
      autoDeployPrs: true,
      autoStopMinutes: 120,
      destroyTtlMinutes: 60,
      isArchived: false,
      createdAt: ago(140 * DAY),
      updatedAt: ago(1 * DAY),
    },
    update: { name: "Storefront", framework: "next", config },
  });
  console.log("[seed] project: acme/storefront");
  return { id: project.id };
}

async function seedPaymentsProject(teamId: string): Promise<{ id: string }> {
  const config: Prisma.InputJsonValue = {
    composeFile: "docker-compose.preview.yml",
    buildCommand: "pnpm build",
    installCommand: "pnpm install --frozen-lockfile",
    startCommand: "node dist/server.js",
    nodeVersion: "20",
    healthcheck: { path: "/healthz", timeoutSeconds: 60 },
  };
  const project = await prisma.project.upsert({
    where: { teamId_slug: { teamId, slug: "payments-api" } },
    create: {
      id: id("proj", "payments"),
      teamId,
      name: "Payments API",
      slug: "payments-api",
      provider: RepoProvider.GITHUB,
      repoFullName: "acme/payments-api",
      repoId: "548921002",
      installationId: "44120093",
      defaultBranch: "main",
      framework: "node",
      rootDirectory: ".",
      config,
      autoDeployPrs: true,
      autoStopMinutes: 90,
      destroyTtlMinutes: 30,
      isArchived: false,
      createdAt: ago(110 * DAY),
      updatedAt: ago(1 * DAY),
    },
    update: { name: "Payments API", framework: "node", config },
  });
  console.log("[seed] project: acme/payments-api");
  return { id: project.id };
}

// ─────────────────────────────────────────────────────────────────────────────
// Project-scoped env vars & seed templates
// ─────────────────────────────────────────────────────────────────────────────

/** Upsert one EnvVar by its (projectId|previewId, key) natural unique key. */
async function upsertProjectEnvVar(input: {
  projectId: string;
  key: string;
  value: string;
  target?: EnvTarget;
  isSecret?: boolean;
  createdAt: Date;
}): Promise<void> {
  const valueEncrypted = encrypt(input.value);
  await prisma.envVar.upsert({
    where: { projectId_key: { projectId: input.projectId, key: input.key } },
    create: {
      id: id("env", `${input.projectId}_${input.key}`),
      projectId: input.projectId,
      scope: EnvScope.PROJECT,
      target: input.target ?? EnvTarget.BOTH,
      key: input.key,
      valueEncrypted,
      isSecret: input.isSecret ?? false,
      createdAt: input.createdAt,
      updatedAt: input.createdAt,
    },
    update: {
      target: input.target ?? EnvTarget.BOTH,
      valueEncrypted,
      isSecret: input.isSecret ?? false,
    },
  });
}

/** Upsert one preview-scoped EnvVar by its (previewId, key) natural unique key. */
async function upsertPreviewEnvVar(input: {
  previewId: string;
  key: string;
  value: string;
  target?: EnvTarget;
  isSecret?: boolean;
  createdAt: Date;
}): Promise<void> {
  const valueEncrypted = encrypt(input.value);
  await prisma.envVar.upsert({
    where: { previewId_key: { previewId: input.previewId, key: input.key } },
    create: {
      id: id("env", `${input.previewId}_${input.key}`),
      previewId: input.previewId,
      scope: EnvScope.PREVIEW,
      target: input.target ?? EnvTarget.RUNTIME,
      key: input.key,
      valueEncrypted,
      isSecret: input.isSecret ?? false,
      createdAt: input.createdAt,
      updatedAt: input.createdAt,
    },
    update: {
      target: input.target ?? EnvTarget.RUNTIME,
      valueEncrypted,
      isSecret: input.isSecret ?? false,
    },
  });
}

async function seedProjectEnvVars(
  storefrontId: string,
  paymentsId: string,
): Promise<void> {
  const createdAt = ago(130 * DAY);

  // Storefront
  await upsertProjectEnvVar({
    projectId: storefrontId,
    key: "NEXT_PUBLIC_API_URL",
    value: "https://api.preview.acme.dev",
    target: EnvTarget.BOTH,
    createdAt,
  });
  await upsertProjectEnvVar({
    projectId: storefrontId,
    key: "STRIPE_PUBLISHABLE_KEY",
    value: "pk_test_51Acme0000publishable0000",
    target: EnvTarget.BOTH,
    createdAt,
  });
  await upsertProjectEnvVar({
    projectId: storefrontId,
    key: "SESSION_SECRET",
    value: "s3ssion-sup3r-secret-for-storefront",
    target: EnvTarget.RUNTIME,
    isSecret: true,
    createdAt,
  });

  // Payments API
  await upsertProjectEnvVar({
    projectId: paymentsId,
    key: "DATABASE_POOL_MAX",
    value: "10",
    target: EnvTarget.RUNTIME,
    createdAt,
  });
  await upsertProjectEnvVar({
    projectId: paymentsId,
    key: "STRIPE_SECRET_KEY",
    value: "sk_test_51Acme0000secret0000key0000",
    target: EnvTarget.RUNTIME,
    isSecret: true,
    createdAt,
  });
  await upsertProjectEnvVar({
    projectId: paymentsId,
    key: "WEBHOOK_SIGNING_SECRET",
    value: "whsec_AcmePaymentsSigningSecret0000",
    target: EnvTarget.RUNTIME,
    isSecret: true,
    createdAt,
  });

  console.log("[seed] project env vars: 6 (3 secret)");
}

async function seedSeedTemplates(
  storefrontId: string,
  paymentsId: string,
): Promise<void> {
  const createdAt = ago(120 * DAY);

  await prisma.seedTemplate.upsert({
    where: {
      projectId_name: { projectId: storefrontId, name: "Demo catalog" },
    },
    create: {
      id: id("seedtpl", "storefront_catalog"),
      projectId: storefrontId,
      name: "Demo catalog",
      kind: SeedKind.SQL,
      source:
        "INSERT INTO products (sku, title, price_cents) VALUES " +
        "('TSHIRT-01','Acme Tee',2500),('MUG-01','Acme Mug',1200);",
      isDefault: true,
      createdAt,
      updatedAt: createdAt,
    },
    update: { isDefault: true },
  });

  await prisma.seedTemplate.upsert({
    where: {
      projectId_name: { projectId: storefrontId, name: "Empty store" },
    },
    create: {
      id: id("seedtpl", "storefront_empty"),
      projectId: storefrontId,
      name: "Empty store",
      kind: SeedKind.SCRIPT,
      source: "scripts/seed/empty.ts",
      isDefault: false,
      createdAt,
      updatedAt: createdAt,
    },
    update: {},
  });

  await prisma.seedTemplate.upsert({
    where: {
      projectId_name: { projectId: paymentsId, name: "Sandbox customers" },
    },
    create: {
      id: id("seedtpl", "payments_customers"),
      projectId: paymentsId,
      name: "Sandbox customers",
      kind: SeedKind.SNAPSHOT,
      source: "s3://acme-seeds/payments/sandbox-customers-2026-05.dump",
      isDefault: true,
      createdAt,
      updatedAt: createdAt,
    },
    update: { isDefault: true },
  });

  console.log("[seed] seed templates: 3");
}

// ─────────────────────────────────────────────────────────────────────────────
// Pull requests
// ─────────────────────────────────────────────────────────────────────────────

interface PrSeed {
  key: string;
  number: number;
  title: string;
  author: UserSeed;
  headRef: string;
  baseRef?: string;
  headSha: string;
  state: PullRequestState;
  labels?: string[];
  createdAgoDays: number;
  repo: string;
}

const U = (key: string): UserSeed => {
  const found = USERS.find((u) => u.key === key);
  if (!found) throw new Error(`unknown user fixture: ${key}`);
  return found;
};

async function upsertPullRequest(
  projectId: string,
  pr: PrSeed,
): Promise<{ id: string; number: number }> {
  const createdAt = ago(pr.createdAgoDays * DAY);
  const row = await prisma.pullRequest.upsert({
    where: { projectId_number: { projectId, number: pr.number } },
    create: {
      id: id("pr", pr.key),
      projectId,
      number: pr.number,
      title: pr.title,
      authorLogin: pr.author.githubLogin,
      authorAvatar: avatarFor(pr.author.githubLogin),
      headRef: pr.headRef,
      baseRef: pr.baseRef ?? "main",
      headSha: pr.headSha,
      state: pr.state,
      url: `https://github.com/${pr.repo}/pull/${pr.number}`,
      labels: pr.labels ?? [],
      createdAt,
      updatedAt: ago((pr.createdAgoDays - 0.25) * DAY),
    },
    update: {
      title: pr.title,
      state: pr.state,
      headSha: pr.headSha,
      labels: pr.labels ?? [],
    },
  });
  return { id: row.id, number: row.number };
}

async function seedStorefrontPullRequests(
  projectId: string,
): Promise<Record<string, { id: string; number: number }>> {
  const defs: PrSeed[] = [
    {
      key: "sf_412",
      number: 412,
      title: "feat: redesigned product detail page",
      author: U("alice"),
      headRef: "feat/pdp-redesign",
      headSha: "a1b2c3d4e5f60718293a4b5c6d7e8f9001122334",
      state: PullRequestState.OPEN,
      labels: ["frontend", "needs-review"],
      createdAgoDays: 2,
      repo: "acme/storefront",
    },
    {
      key: "sf_409",
      number: 409,
      title: "fix: cart total rounding on multi-currency",
      author: U("bob"),
      headRef: "fix/cart-rounding",
      headSha: "b2c3d4e5f60718293a4b5c6d7e8f900112233445",
      state: PullRequestState.OPEN,
      labels: ["bug"],
      createdAgoDays: 3,
      repo: "acme/storefront",
    },
    {
      key: "sf_405",
      number: 405,
      title: "chore: bump next to 15.1",
      author: U("carol"),
      headRef: "chore/next-15-1",
      headSha: "c3d4e5f60718293a4b5c6d7e8f90011223344556",
      state: PullRequestState.MERGED,
      labels: ["dependencies"],
      createdAgoDays: 9,
      repo: "acme/storefront",
    },
    {
      key: "sf_401",
      number: 401,
      title: "feat: wishlist (WIP)",
      author: U("dave"),
      headRef: "feat/wishlist",
      headSha: "d4e5f60718293a4b5c6d7e8f9001122334455667",
      state: PullRequestState.DRAFT,
      labels: ["frontend", "wip"],
      createdAgoDays: 5,
      repo: "acme/storefront",
    },
    {
      key: "sf_398",
      number: 398,
      title: "fix: hydration mismatch in header",
      author: U("erin"),
      headRef: "fix/header-hydration",
      headSha: "e5f60718293a4b5c6d7e8f900112233445566778",
      state: PullRequestState.CLOSED,
      labels: ["bug", "wontfix"],
      createdAgoDays: 14,
      repo: "acme/storefront",
    },
    {
      key: "sf_414",
      number: 414,
      title: "perf: image CDN + responsive srcset",
      author: U("alice"),
      headRef: "perf/image-cdn",
      headSha: "f60718293a4b5c6d7e8f90011223344556677889",
      state: PullRequestState.OPEN,
      labels: ["performance"],
      createdAgoDays: 1,
      repo: "acme/storefront",
    },
  ];

  const out: Record<string, { id: string; number: number }> = {};
  for (const d of defs) out[d.key] = await upsertPullRequest(projectId, d);
  console.log(`[seed] storefront PRs: ${defs.length}`);
  return out;
}

async function seedPaymentsPullRequests(
  projectId: string,
): Promise<Record<string, { id: string; number: number }>> {
  const defs: PrSeed[] = [
    {
      key: "pa_233",
      number: 233,
      title: "feat: idempotency keys for charge endpoint",
      author: U("bob"),
      headRef: "feat/idempotency-keys",
      headSha: "10293847565647382910abcdef0123456789aabb",
      state: PullRequestState.OPEN,
      labels: ["api", "needs-review"],
      createdAgoDays: 2,
      repo: "acme/payments-api",
    },
    {
      key: "pa_230",
      number: 230,
      title: "fix: webhook retry backoff jitter",
      author: U("dave"),
      headRef: "fix/webhook-backoff",
      headSha: "20384756647382910abcdef0123456789aabbcc1",
      state: PullRequestState.OPEN,
      labels: ["bug", "reliability"],
      createdAgoDays: 4,
      repo: "acme/payments-api",
    },
    {
      key: "pa_226",
      number: 226,
      title: "feat: refund partial amounts",
      author: U("carol"),
      headRef: "feat/partial-refunds",
      headSha: "30475664738210abcdef0123456789aabbcc1d2e",
      state: PullRequestState.MERGED,
      labels: ["api"],
      createdAgoDays: 12,
      repo: "acme/payments-api",
    },
    {
      key: "pa_221",
      number: 221,
      title: "chore: upgrade prisma to 6",
      author: U("alice"),
      headRef: "chore/prisma-6",
      headSha: "40566473821abcdef0123456789aabbcc1d2e3f4",
      state: PullRequestState.MERGED,
      labels: ["dependencies"],
      createdAgoDays: 20,
      repo: "acme/payments-api",
    },
    {
      key: "pa_236",
      number: 236,
      title: "feat: 3DS challenge flow",
      author: U("erin"),
      headRef: "feat/3ds-challenge",
      headSha: "5066473821abcdef0123456789aabbcc1d2e3f45",
      state: PullRequestState.OPEN,
      labels: ["api", "security"],
      createdAgoDays: 1,
      repo: "acme/payments-api",
    },
    {
      key: "pa_218",
      number: 218,
      title: "fix: decimal precision on FX conversion",
      author: U("bob"),
      headRef: "fix/fx-precision",
      headSha: "60473821abcdef0123456789aabbcc1d2e3f4567",
      state: PullRequestState.CLOSED,
      labels: ["bug"],
      createdAgoDays: 25,
      repo: "acme/payments-api",
    },
  ];

  const out: Record<string, { id: string; number: number }> = {};
  for (const d of defs) out[d.key] = await upsertPullRequest(projectId, d);
  console.log(`[seed] payments PRs: ${defs.length}`);
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Previews + deployments + builds + services + logs
// ─────────────────────────────────────────────────────────────────────────────

interface ServiceSeed {
  nameSuffix: string;
  type: ServiceType;
  image?: string;
  command?: string;
  ports?: number[];
  status: ServiceStatus;
  healthPath?: string;
  restartCount?: number;
}

interface DeploymentSeed {
  keySuffix: string;
  trigger: DeploymentTrigger;
  status: DeploymentStatus;
  createdByKey?: string;
  /** When the deployment was queued, relative to BASE_DATE in ms (ago). */
  queuedAgoMs: number;
  /** Build outcome for this deployment. */
  build: {
    status: BuildStatus;
    cacheHit?: boolean;
    exitCode?: number;
    errorSummary?: string;
    imageTag?: string;
    durationMs?: number;
  };
  /** Whether to emit a rich log story for this deployment. */
  emitLogs: boolean;
  /** Optional override for number of runtime log lines. */
  runtimeLogCount?: number;
}

interface PreviewSeed {
  key: string;
  projectId: string;
  pullRequestId: string | null;
  name: string;
  slug: string;
  status: PreviewStatus;
  url: string | null;
  commitSha: string | null;
  branch: string | null;
  isPinned?: boolean;
  autoStopMinutes?: number;
  lastActivityAgoMs: number;
  expiresInMs?: number | null;
  createdAgoMs: number;
  destroyedAgoMs?: number | null;
  services: ServiceSeed[];
  deployments: DeploymentSeed[];
  /** Preview-scoped env overrides. */
  envVars?: Array<{
    key: string;
    value: string;
    target?: EnvTarget;
    isSecret?: boolean;
  }>;
}

/** Terminal/in-progress disposition of a build's log story. */
type BuildLogOutcome =
  | { kind: "succeeded" }
  | { kind: "failed"; failLine?: string }
  /** Build still running: emit the prefix only, no terminal trailer. */
  | { kind: "in_progress" };

/** Insert a coherent BUILD log story for a deployment, returning next seq. */
async function emitBuildLogs(
  deploymentId: string,
  startedAt: Date,
  outcome: BuildLogOutcome,
  startSeq: number,
): Promise<number> {
  const lines: Array<{ level: LogLevel; msg: string; dtMs: number }> = [
    { level: LogLevel.INFO, msg: "Cloning repository (depth=1)…", dtMs: 0 },
    { level: LogLevel.INFO, msg: "HEAD is now at the PR head commit", dtMs: 800 },
    { level: LogLevel.INFO, msg: "Detected framework: next", dtMs: 1100 },
    { level: LogLevel.INFO, msg: "Restoring build cache…", dtMs: 1500 },
    { level: LogLevel.INFO, msg: "Cache restored (1.2 GB)", dtMs: 2600 },
    { level: LogLevel.INFO, msg: "Installing dependencies: pnpm install --frozen-lockfile", dtMs: 3000 },
    { level: LogLevel.INFO, msg: "Lockfile is up to date, resolution step is skipped", dtMs: 3400 },
    { level: LogLevel.INFO, msg: "Packages: +642", dtMs: 6000 },
    { level: LogLevel.WARN, msg: "deprecated subdep glob@7.2.3: Glob versions prior to v9 are no longer supported", dtMs: 6400 },
    { level: LogLevel.INFO, msg: "Done in 11.3s", dtMs: 17000 },
    { level: LogLevel.INFO, msg: "Running build: pnpm build", dtMs: 17500 },
    { level: LogLevel.INFO, msg: "▲ Next.js 15.1.0", dtMs: 18000 },
    { level: LogLevel.INFO, msg: "Creating an optimized production build…", dtMs: 18500 },
    { level: LogLevel.INFO, msg: "Compiled successfully in 42s", dtMs: 60000 },
    { level: LogLevel.INFO, msg: "Linting and checking validity of types…", dtMs: 60500 },
    { level: LogLevel.INFO, msg: "Collecting page data…", dtMs: 64000 },
    { level: LogLevel.INFO, msg: "Generating static pages (0/37)", dtMs: 66000 },
    { level: LogLevel.INFO, msg: "Generating static pages (37/37)", dtMs: 72000 },
  ];

  // For an in-progress build, stop partway through (after "Compiled
  // successfully") so the story reads like a live, unfinished build.
  const prefix =
    outcome.kind === "in_progress"
      ? lines.slice(0, 14)
      : lines;

  let seq = startSeq;
  for (const l of prefix) {
    await prisma.logChunk.create({
      data: {
        id: id("log", `${deploymentId}_b_${seq}`),
        deploymentId,
        source: LogSource.BUILD,
        level: l.level,
        seq,
        message: l.msg,
        timestamp: plus(startedAt, l.dtMs),
      },
    });
    seq += 1;
  }

  if (outcome.kind === "failed") {
    const failMsgs: Array<{ level: LogLevel; msg: string; dtMs: number }> = [
      { level: LogLevel.ERROR, msg: outcome.failLine ?? "Build failed", dtMs: 73000 },
      { level: LogLevel.ERROR, msg: "  at compileModule (next/dist/build/index.js:912:15)", dtMs: 73050 },
      { level: LogLevel.ERROR, msg: 'Error: Command "pnpm build" exited with 1', dtMs: 73100 },
    ];
    for (const l of failMsgs) {
      await prisma.logChunk.create({
        data: {
          id: id("log", `${deploymentId}_b_${seq}`),
          deploymentId,
          source: LogSource.BUILD,
          level: l.level,
          seq,
          message: l.msg,
          timestamp: plus(startedAt, l.dtMs),
        },
      });
      seq += 1;
    }
  } else if (outcome.kind === "succeeded") {
    const okMsgs: Array<{ level: LogLevel; msg: string; dtMs: number }> = [
      { level: LogLevel.INFO, msg: "Route (app)                              Size     First Load JS", dtMs: 73000 },
      { level: LogLevel.INFO, msg: "Build completed. Exporting image…", dtMs: 74000 },
      { level: LogLevel.INFO, msg: "Pushed image registry.preview.acme.dev/app:pr", dtMs: 82000 },
    ];
    for (const l of okMsgs) {
      await prisma.logChunk.create({
        data: {
          id: id("log", `${deploymentId}_b_${seq}`),
          deploymentId,
          source: LogSource.DEPLOY,
          level: l.level,
          seq,
          message: l.msg,
          timestamp: plus(startedAt, l.dtMs),
        },
      });
      seq += 1;
    }
  }
  return seq;
}

/** Insert RUNTIME/boot logs for a successfully deployed service. */
async function emitRuntimeLogs(
  deploymentId: string,
  serviceId: string | null,
  bootAt: Date,
  count: number,
  startSeq: number,
): Promise<number> {
  const templates: Array<{ level: LogLevel; msg: string }> = [
    { level: LogLevel.INFO, msg: "Starting container…" },
    { level: LogLevel.INFO, msg: "Loaded 18 environment variables" },
    { level: LogLevel.INFO, msg: "Connecting to database…" },
    { level: LogLevel.INFO, msg: "Database connection established (pool size 10)" },
    { level: LogLevel.INFO, msg: "Applying pending migrations…" },
    { level: LogLevel.INFO, msg: "Migrations up to date" },
    { level: LogLevel.INFO, msg: "Seeding preview database from template 'Demo catalog'" },
    { level: LogLevel.INFO, msg: "Seed complete: 2 products, 0 orders" },
    { level: LogLevel.INFO, msg: "Server listening on 0.0.0.0:3000" },
    { level: LogLevel.INFO, msg: "Health check passed: GET /api/health 200" },
    { level: LogLevel.INFO, msg: "GET / 200 in 38ms" },
    { level: LogLevel.INFO, msg: "GET /products 200 in 54ms" },
    { level: LogLevel.WARN, msg: "Slow query (212ms): SELECT * FROM products ORDER BY created_at DESC" },
    { level: LogLevel.INFO, msg: "GET /products/TSHIRT-01 200 in 61ms" },
    { level: LogLevel.INFO, msg: "POST /cart 201 in 73ms" },
    { level: LogLevel.WARN, msg: "Upstream latency elevated: payments-api p95=480ms" },
    { level: LogLevel.INFO, msg: "GET /api/health 200 in 4ms" },
    { level: LogLevel.ERROR, msg: "Unhandled rejection in /checkout: TimeoutError: payments-api timed out after 5000ms" },
    { level: LogLevel.INFO, msg: "Retrying checkout via circuit breaker (attempt 2)" },
    { level: LogLevel.INFO, msg: "GET /api/health 200 in 3ms" },
  ];

  let seq = startSeq;
  for (let i = 0; i < count; i += 1) {
    const t = templates[i % templates.length]!;
    await prisma.logChunk.create({
      data: {
        id: id("log", `${deploymentId}_r_${seq}`),
        deploymentId,
        serviceId: serviceId ?? undefined,
        source: LogSource.RUNTIME,
        level: t.level,
        seq,
        // Append a counter so messages remain unique-ish and the story flows.
        message: i >= templates.length ? `${t.msg} (#${i})` : t.msg,
        timestamp: plus(bootAt, i * 1500),
      },
    });
    seq += 1;
  }
  return seq;
}

/** Create a preview together with all of its child rows, idempotently. */
async function seedPreview(p: PreviewSeed): Promise<void> {
  const createdAt = ago(p.createdAgoMs);
  const lastActivityAt = ago(p.lastActivityAgoMs);
  const expiresAt =
    p.expiresInMs === null || p.expiresInMs === undefined
      ? null
      : ahead(p.expiresInMs);
  const destroyedAt =
    p.destroyedAgoMs === null || p.destroyedAgoMs === undefined
      ? null
      : ago(p.destroyedAgoMs);

  await prisma.preview.upsert({
    where: { slug: p.slug },
    create: {
      id: id("prev", p.key),
      projectId: p.projectId,
      pullRequestId: p.pullRequestId ?? undefined,
      name: p.name,
      slug: p.slug,
      status: p.status,
      url: p.url ?? undefined,
      commitSha: p.commitSha ?? undefined,
      branch: p.branch ?? undefined,
      isPinned: p.isPinned ?? false,
      autoStopMinutes: p.autoStopMinutes ?? 120,
      lastActivityAt,
      expiresAt: expiresAt ?? undefined,
      createdAt,
      updatedAt: lastActivityAt,
      destroyedAt: destroyedAt ?? undefined,
    },
    update: {
      status: p.status,
      url: p.url ?? null,
      commitSha: p.commitSha ?? null,
      branch: p.branch ?? null,
      isPinned: p.isPinned ?? false,
      lastActivityAt,
      expiresAt: expiresAt ?? null,
      destroyedAt: destroyedAt ?? null,
    },
  });

  // Services
  const serviceIdByType = new Map<ServiceType, string>();
  for (const s of p.services) {
    const svcName = `${p.slug}-${s.nameSuffix}`;
    const svcId = id("svc", `${p.key}_${s.nameSuffix}`);
    await prisma.service.upsert({
      where: { previewId_name: { previewId: id("prev", p.key), name: svcName } },
      create: {
        id: svcId,
        previewId: id("prev", p.key),
        name: svcName,
        type: s.type,
        image: s.image,
        command: s.command,
        internalHost: svcName,
        ports: s.ports ?? [],
        status: s.status,
        containerId:
          s.status === ServiceStatus.PENDING
            ? undefined
            : `sha256:${p.key}${s.nameSuffix}`.padEnd(20, "0").slice(0, 20),
        healthPath: s.healthPath,
        restartCount: s.restartCount ?? 0,
        createdAt,
        updatedAt: lastActivityAt,
      },
      update: { status: s.status, restartCount: s.restartCount ?? 0 },
    });
    if (!serviceIdByType.has(s.type)) serviceIdByType.set(s.type, svcId);
  }

  // Deployments + builds + logs
  for (const d of p.deployments) {
    const deploymentId = id("dep", `${p.key}_${d.keySuffix}`);
    const queuedAt = ago(d.queuedAgoMs);
    const startedAt = plus(queuedAt, 4_000);
    const isTerminal =
      d.status === DeploymentStatus.SUCCEEDED ||
      d.status === DeploymentStatus.FAILED ||
      d.status === DeploymentStatus.CANCELLED;
    const durationMs =
      d.build.durationMs ??
      (d.status === DeploymentStatus.SUCCEEDED ? 96_000 : 75_000);
    const finishedAt = isTerminal ? plus(startedAt, durationMs) : null;

    await prisma.deployment.upsert({
      where: { id: deploymentId },
      create: {
        id: deploymentId,
        previewId: id("prev", p.key),
        commitSha: p.commitSha ?? "0000000000000000000000000000000000000000",
        trigger: d.trigger,
        status: d.status,
        createdById: d.createdByKey ? userId(d.createdByKey) : undefined,
        queuedAt,
        startedAt:
          d.status === DeploymentStatus.QUEUED ? undefined : startedAt,
        finishedAt: finishedAt ?? undefined,
        durationMs: finishedAt ? durationMs : undefined,
        errorSummary:
          d.status === DeploymentStatus.FAILED
            ? d.build.errorSummary ?? "Deployment failed"
            : undefined,
      },
      update: {
        status: d.status,
        finishedAt: finishedAt ?? null,
        durationMs: finishedAt ? durationMs : null,
        errorSummary:
          d.status === DeploymentStatus.FAILED
            ? d.build.errorSummary ?? "Deployment failed"
            : null,
      },
    });

    // Build (1:1 with deployment)
    const buildStarted = plus(startedAt, 1_000);
    const buildIsTerminal =
      d.build.status === BuildStatus.SUCCEEDED ||
      d.build.status === BuildStatus.FAILED ||
      d.build.status === BuildStatus.CANCELLED;
    const buildDuration = d.build.durationMs ?? 72_000;
    await prisma.build.upsert({
      where: { deploymentId },
      create: {
        id: id("build", `${p.key}_${d.keySuffix}`),
        deploymentId,
        status: d.build.status,
        imageTag:
          d.build.imageTag ??
          (d.build.status === BuildStatus.SUCCEEDED
            ? `registry.preview.acme.dev/${p.slug}:${(p.commitSha ?? "latest").slice(0, 7)}`
            : undefined),
        cacheHit: d.build.cacheHit ?? false,
        exitCode:
          d.build.exitCode ??
          (d.build.status === BuildStatus.SUCCEEDED
            ? 0
            : d.build.status === BuildStatus.FAILED
              ? 1
              : undefined),
        errorSummary:
          d.build.status === BuildStatus.FAILED
            ? d.build.errorSummary ?? "Build failed"
            : undefined,
        startedAt:
          d.build.status === BuildStatus.PENDING ? undefined : buildStarted,
        finishedAt: buildIsTerminal
          ? plus(buildStarted, buildDuration)
          : undefined,
        durationMs: buildIsTerminal ? buildDuration : undefined,
      },
      update: {
        status: d.build.status,
        errorSummary:
          d.build.status === BuildStatus.FAILED
            ? d.build.errorSummary ?? "Build failed"
            : null,
      },
    });

    // Logs (idempotent: delete existing chunks for this deployment first so
    // re-runs don't accumulate duplicates, then re-emit the deterministic set).
    if (d.emitLogs) {
      await prisma.logChunk.deleteMany({ where: { deploymentId } });
      let seq = 0;
      const buildOutcome: BuildLogOutcome =
        d.build.status === BuildStatus.FAILED
          ? { kind: "failed", failLine: d.build.errorSummary }
          : d.build.status === BuildStatus.SUCCEEDED
            ? { kind: "succeeded" }
            : { kind: "in_progress" };
      seq = await emitBuildLogs(deploymentId, buildStarted, buildOutcome, seq);
      if (d.status === DeploymentStatus.SUCCEEDED) {
        const webSvc =
          serviceIdByType.get(ServiceType.WEB) ??
          serviceIdByType.get(ServiceType.API) ??
          null;
        const runtimeCount = d.runtimeLogCount ?? 40;
        seq = await emitRuntimeLogs(
          deploymentId,
          webSvc,
          plus(buildStarted, buildDuration + 5_000),
          runtimeCount,
          seq,
        );
      }
    }
  }

  // Preview-scoped env vars
  if (p.envVars) {
    for (const e of p.envVars) {
      await upsertPreviewEnvVar({
        previewId: id("prev", p.key),
        key: e.key,
        value: e.value,
        target: e.target,
        isSecret: e.isSecret,
        createdAt,
      });
    }
  }

  console.log(`[seed] preview: ${p.slug} (${p.status})`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Storefront previews (cover most statuses)
// ─────────────────────────────────────────────────────────────────────────────

async function seedStorefrontPreviews(
  projectId: string,
  prs: Record<string, { id: string; number: number }>,
): Promise<void> {
  const previews: PreviewSeed[] = [
    // RUNNING — healthy, pinned, with a successful redeploy after an earlier fail.
    {
      key: "sf_412",
      projectId,
      pullRequestId: prs.sf_412!.id,
      name: "PR #412 · pdp-redesign",
      slug: "storefront-pr-412",
      status: PreviewStatus.RUNNING,
      url: "https://storefront-pr-412.preview.acme.dev",
      commitSha: "a1b2c3d4e5f60718293a4b5c6d7e8f9001122334",
      branch: "feat/pdp-redesign",
      isPinned: true,
      lastActivityAgoMs: 12 * MINUTE,
      expiresInMs: null,
      createdAgoMs: 2 * DAY,
      services: [
        { nameSuffix: "web", type: ServiceType.WEB, image: "node:20-alpine", ports: [3000], status: ServiceStatus.HEALTHY, healthPath: "/api/health" },
        { nameSuffix: "db", type: ServiceType.DATABASE, image: "postgres:16", ports: [5432], status: ServiceStatus.HEALTHY },
        { nameSuffix: "cache", type: ServiceType.CACHE, image: "redis:7", ports: [6379], status: ServiceStatus.HEALTHY },
      ],
      deployments: [
        {
          keySuffix: "d1",
          trigger: DeploymentTrigger.PR_OPENED,
          status: DeploymentStatus.FAILED,
          createdByKey: "alice",
          queuedAgoMs: 2 * DAY,
          build: { status: BuildStatus.FAILED, exitCode: 1, errorSummary: "Type error: Property 'rating' does not exist on type 'Product'. (app/products/[sku]/page.tsx:42:18)" },
          emitLogs: true,
        },
        {
          keySuffix: "d2",
          trigger: DeploymentTrigger.PR_SYNC,
          status: DeploymentStatus.SUCCEEDED,
          createdByKey: "alice",
          queuedAgoMs: 14 * MINUTE,
          build: { status: BuildStatus.SUCCEEDED, cacheHit: true, durationMs: 88_000 },
          emitLogs: true,
          runtimeLogCount: 64,
        },
      ],
      envVars: [
        { key: "FEATURE_PDP_V2", value: "true", target: EnvTarget.BOTH },
        { key: "PREVIEW_BANNER", value: "PR #412 — PDP redesign", target: EnvTarget.RUNTIME },
      ],
    },
    // BUILDING — fresh PR, build in progress.
    {
      key: "sf_414",
      projectId,
      pullRequestId: prs.sf_414!.id,
      name: "PR #414 · image-cdn",
      slug: "storefront-pr-414",
      status: PreviewStatus.BUILDING,
      url: null,
      commitSha: "f60718293a4b5c6d7e8f90011223344556677889",
      branch: "perf/image-cdn",
      lastActivityAgoMs: 2 * MINUTE,
      createdAgoMs: 30 * MINUTE,
      services: [
        { nameSuffix: "web", type: ServiceType.WEB, image: "node:20-alpine", ports: [3000], status: ServiceStatus.PENDING, healthPath: "/api/health" },
        { nameSuffix: "db", type: ServiceType.DATABASE, image: "postgres:16", ports: [5432], status: ServiceStatus.STARTING },
      ],
      deployments: [
        {
          keySuffix: "d1",
          trigger: DeploymentTrigger.PR_OPENED,
          status: DeploymentStatus.BUILDING,
          createdByKey: "alice",
          queuedAgoMs: 3 * MINUTE,
          build: { status: BuildStatus.RUNNING },
          emitLogs: true,
        },
      ],
    },
    // DEGRADED — running but one service unhealthy.
    {
      key: "sf_409",
      projectId,
      pullRequestId: prs.sf_409!.id,
      name: "PR #409 · cart-rounding",
      slug: "storefront-pr-409",
      status: PreviewStatus.DEGRADED,
      url: "https://storefront-pr-409.preview.acme.dev",
      commitSha: "b2c3d4e5f60718293a4b5c6d7e8f900112233445",
      branch: "fix/cart-rounding",
      lastActivityAgoMs: 40 * MINUTE,
      createdAgoMs: 3 * DAY,
      services: [
        { nameSuffix: "web", type: ServiceType.WEB, image: "node:20-alpine", ports: [3000], status: ServiceStatus.HEALTHY, healthPath: "/api/health" },
        { nameSuffix: "db", type: ServiceType.DATABASE, image: "postgres:16", ports: [5432], status: ServiceStatus.UNHEALTHY, restartCount: 3 },
        { nameSuffix: "cache", type: ServiceType.CACHE, image: "redis:7", ports: [6379], status: ServiceStatus.HEALTHY },
      ],
      deployments: [
        {
          keySuffix: "d1",
          trigger: DeploymentTrigger.PR_SYNC,
          status: DeploymentStatus.SUCCEEDED,
          createdByKey: "bob",
          queuedAgoMs: 3 * DAY,
          build: { status: BuildStatus.SUCCEEDED, durationMs: 94_000 },
          emitLogs: true,
          runtimeLogCount: 48,
        },
      ],
    },
    // STOPPED — auto-stopped due to inactivity (draft WIP).
    {
      key: "sf_401",
      projectId,
      pullRequestId: prs.sf_401!.id,
      name: "PR #401 · wishlist",
      slug: "storefront-pr-401",
      status: PreviewStatus.STOPPED,
      url: null,
      commitSha: "d4e5f60718293a4b5c6d7e8f9001122334455667",
      branch: "feat/wishlist",
      lastActivityAgoMs: 26 * HOUR,
      createdAgoMs: 5 * DAY,
      services: [
        { nameSuffix: "web", type: ServiceType.WEB, image: "node:20-alpine", ports: [3000], status: ServiceStatus.STOPPED },
        { nameSuffix: "db", type: ServiceType.DATABASE, image: "postgres:16", ports: [5432], status: ServiceStatus.STOPPED },
      ],
      deployments: [
        {
          keySuffix: "d1",
          trigger: DeploymentTrigger.PR_OPENED,
          status: DeploymentStatus.SUCCEEDED,
          createdByKey: "dave",
          queuedAgoMs: 5 * DAY,
          build: { status: BuildStatus.SUCCEEDED, durationMs: 90_000 },
          emitLogs: true,
          runtimeLogCount: 32,
        },
      ],
    },
    // DESTROYED — closed PR, env torn down.
    {
      key: "sf_398",
      projectId,
      pullRequestId: prs.sf_398!.id,
      name: "PR #398 · header-hydration",
      slug: "storefront-pr-398",
      status: PreviewStatus.DESTROYED,
      url: null,
      commitSha: "e5f60718293a4b5c6d7e8f900112233445566778",
      branch: "fix/header-hydration",
      lastActivityAgoMs: 13 * DAY,
      createdAgoMs: 14 * DAY,
      destroyedAgoMs: 13 * DAY,
      services: [],
      deployments: [
        {
          keySuffix: "d1",
          trigger: DeploymentTrigger.PR_OPENED,
          status: DeploymentStatus.SUCCEEDED,
          createdByKey: "erin",
          queuedAgoMs: 14 * DAY,
          build: { status: BuildStatus.SUCCEEDED, durationMs: 87_000 },
          emitLogs: false,
        },
      ],
    },
  ];

  for (const p of previews) await seedPreview(p);
  console.log(`[seed] storefront previews: ${previews.length}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Payments previews
// ─────────────────────────────────────────────────────────────────────────────

async function seedPaymentsPreviews(
  projectId: string,
  prs: Record<string, { id: string; number: number }>,
): Promise<void> {
  const previews: PreviewSeed[] = [
    // RUNNING
    {
      key: "pa_233",
      projectId,
      pullRequestId: prs.pa_233!.id,
      name: "PR #233 · idempotency-keys",
      slug: "payments-pr-233",
      status: PreviewStatus.RUNNING,
      url: "https://payments-pr-233.preview.acme.dev",
      commitSha: "10293847565647382910abcdef0123456789aabb",
      branch: "feat/idempotency-keys",
      lastActivityAgoMs: 8 * MINUTE,
      createdAgoMs: 2 * DAY,
      autoStopMinutes: 90,
      services: [
        { nameSuffix: "api", type: ServiceType.API, image: "node:20-alpine", command: "node dist/server.js", ports: [4000], status: ServiceStatus.HEALTHY, healthPath: "/healthz" },
        { nameSuffix: "worker", type: ServiceType.WORKER, image: "node:20-alpine", command: "node dist/worker.js", status: ServiceStatus.HEALTHY },
        { nameSuffix: "db", type: ServiceType.DATABASE, image: "postgres:16", ports: [5432], status: ServiceStatus.HEALTHY },
        { nameSuffix: "cache", type: ServiceType.CACHE, image: "redis:7", ports: [6379], status: ServiceStatus.HEALTHY },
      ],
      deployments: [
        {
          keySuffix: "d1",
          trigger: DeploymentTrigger.PR_OPENED,
          status: DeploymentStatus.SUCCEEDED,
          createdByKey: "bob",
          queuedAgoMs: 2 * DAY,
          build: { status: BuildStatus.SUCCEEDED, durationMs: 64_000 },
          emitLogs: true,
          runtimeLogCount: 50,
        },
        {
          keySuffix: "d2",
          trigger: DeploymentTrigger.PR_SYNC,
          status: DeploymentStatus.SUCCEEDED,
          createdByKey: "bob",
          queuedAgoMs: 9 * MINUTE,
          build: { status: BuildStatus.SUCCEEDED, cacheHit: true, durationMs: 41_000 },
          emitLogs: true,
          runtimeLogCount: 72,
        },
      ],
      envVars: [
        { key: "IDEMPOTENCY_TTL_SECONDS", value: "86400", target: EnvTarget.RUNTIME },
        { key: "PREVIEW_STRIPE_SECRET", value: "sk_test_preview_233_secret", target: EnvTarget.RUNTIME, isSecret: true },
      ],
    },
    // DEPLOYING — build done, stack coming up.
    {
      key: "pa_236",
      projectId,
      pullRequestId: prs.pa_236!.id,
      name: "PR #236 · 3ds-challenge",
      slug: "payments-pr-236",
      status: PreviewStatus.DEPLOYING,
      url: null,
      commitSha: "5066473821abcdef0123456789aabbcc1d2e3f45",
      branch: "feat/3ds-challenge",
      lastActivityAgoMs: 90_000,
      createdAgoMs: 25 * MINUTE,
      services: [
        { nameSuffix: "api", type: ServiceType.API, image: "node:20-alpine", command: "node dist/server.js", ports: [4000], status: ServiceStatus.STARTING, healthPath: "/healthz" },
        { nameSuffix: "db", type: ServiceType.DATABASE, image: "postgres:16", ports: [5432], status: ServiceStatus.HEALTHY },
      ],
      deployments: [
        {
          keySuffix: "d1",
          trigger: DeploymentTrigger.PR_OPENED,
          status: DeploymentStatus.DEPLOYING,
          createdByKey: "erin",
          queuedAgoMs: 6 * MINUTE,
          build: { status: BuildStatus.SUCCEEDED, durationMs: 58_000 },
          emitLogs: true,
        },
      ],
    },
    // FAILED — build error.
    {
      key: "pa_230",
      projectId,
      pullRequestId: prs.pa_230!.id,
      name: "PR #230 · webhook-backoff",
      slug: "payments-pr-230",
      status: PreviewStatus.FAILED,
      url: null,
      commitSha: "20384756647382910abcdef0123456789aabbcc1",
      branch: "fix/webhook-backoff",
      lastActivityAgoMs: 70 * MINUTE,
      createdAgoMs: 4 * DAY,
      services: [
        { nameSuffix: "api", type: ServiceType.API, image: "node:20-alpine", command: "node dist/server.js", ports: [4000], status: ServiceStatus.CRASHED, restartCount: 5 },
        { nameSuffix: "db", type: ServiceType.DATABASE, image: "postgres:16", ports: [5432], status: ServiceStatus.HEALTHY },
      ],
      deployments: [
        {
          keySuffix: "d1",
          trigger: DeploymentTrigger.PR_SYNC,
          status: DeploymentStatus.FAILED,
          createdByKey: "dave",
          queuedAgoMs: 70 * MINUTE,
          build: {
            status: BuildStatus.FAILED,
            exitCode: 1,
            errorSummary:
              "tsc: src/webhooks/backoff.ts(58,7): error TS2532: Object is possibly 'undefined'. Build aborted before image export.",
          },
          emitLogs: true,
        },
      ],
    },
    // DESTROYED — merged PR.
    {
      key: "pa_226",
      projectId,
      pullRequestId: prs.pa_226!.id,
      name: "PR #226 · partial-refunds",
      slug: "payments-pr-226",
      status: PreviewStatus.DESTROYED,
      url: null,
      commitSha: "30475664738210abcdef0123456789aabbcc1d2e",
      branch: "feat/partial-refunds",
      lastActivityAgoMs: 11 * DAY,
      createdAgoMs: 12 * DAY,
      destroyedAgoMs: 11 * DAY,
      services: [],
      deployments: [
        {
          keySuffix: "d1",
          trigger: DeploymentTrigger.PR_OPENED,
          status: DeploymentStatus.SUCCEEDED,
          createdByKey: "carol",
          queuedAgoMs: 12 * DAY,
          build: { status: BuildStatus.SUCCEEDED, durationMs: 62_000 },
          emitLogs: false,
        },
      ],
    },
  ];

  for (const p of previews) await seedPreview(p);
  console.log(`[seed] payments previews: ${previews.length}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Reviews
// ─────────────────────────────────────────────────────────────────────────────

interface ReviewSeed {
  previewKey: string;
  reviewerKey: string;
  state: ReviewState;
  updatedAgoMs: number;
}

async function seedReviews(): Promise<void> {
  const defs: ReviewSeed[] = [
    { previewKey: "sf_412", reviewerKey: "bob", state: ReviewState.APPROVED, updatedAgoMs: 20 * MINUTE },
    { previewKey: "sf_412", reviewerKey: "carol", state: ReviewState.CHANGES_REQUESTED, updatedAgoMs: 50 * MINUTE },
    { previewKey: "sf_412", reviewerKey: "dave", state: ReviewState.PENDING, updatedAgoMs: 2 * HOUR },
    { previewKey: "sf_409", reviewerKey: "alice", state: ReviewState.COMMENTED, updatedAgoMs: 3 * HOUR },
    { previewKey: "pa_233", reviewerKey: "alice", state: ReviewState.APPROVED, updatedAgoMs: 30 * MINUTE },
    { previewKey: "pa_233", reviewerKey: "dave", state: ReviewState.PENDING, updatedAgoMs: 1 * HOUR },
    { previewKey: "pa_236", reviewerKey: "bob", state: ReviewState.PENDING, updatedAgoMs: 15 * MINUTE },
    { previewKey: "pa_230", reviewerKey: "carol", state: ReviewState.CHANGES_REQUESTED, updatedAgoMs: 65 * MINUTE },
    { previewKey: "sf_401", reviewerKey: "erin", state: ReviewState.DISMISSED, updatedAgoMs: 25 * HOUR },
  ];

  for (const r of defs) {
    const reviewer = U(r.reviewerKey);
    const previewId = id("prev", r.previewKey);
    const when = ago(r.updatedAgoMs);
    await prisma.review.upsert({
      where: { previewId_login: { previewId, login: reviewer.githubLogin } },
      create: {
        id: id("rev", `${r.previewKey}_${r.reviewerKey}`),
        previewId,
        userId: userId(r.reviewerKey),
        login: reviewer.githubLogin,
        avatarUrl: avatarFor(reviewer.githubLogin),
        state: r.state,
        createdAt: when,
        updatedAt: when,
      },
      update: { state: r.state },
    });
  }
  console.log(`[seed] reviews: ${defs.length}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Cost records (recent days, per active/recent preview)
// ─────────────────────────────────────────────────────────────────────────────

async function seedCostRecords(): Promise<void> {
  const previewKeys = ["sf_412", "sf_409", "pa_233", "pa_236", "sf_401"];
  let count = 0;
  for (const pk of previewKeys) {
    // 5 daily rollups per preview, ending yesterday.
    for (let dayOffset = 5; dayOffset >= 1; dayOffset -= 1) {
      const periodStart = ago(dayOffset * DAY);
      const periodEnd = ago((dayOffset - 1) * DAY);
      const cpuSeconds = 3600 * (2 + (dayOffset % 3)); // 2–4 vCPU-hours
      const memoryGbHours = 12 + dayOffset * 1.5;
      const storageGbHours = 24;
      const egressGb = 0.4 + dayOffset * 0.1;
      // Simple cost model: $0.00002/cpu-s + $0.012/GB-hr mem + $0.0005/GB-hr storage + $0.09/GB egress
      const usd =
        cpuSeconds * 0.00002 +
        memoryGbHours * 0.012 +
        storageGbHours * 0.0005 +
        egressGb * 0.09;
      const recId = id("cost", `${pk}_${dayOffset}`);
      await prisma.costRecord.upsert({
        where: { id: recId },
        create: {
          id: recId,
          previewId: id("prev", pk),
          periodStart,
          periodEnd,
          cpuSeconds,
          memoryGbHours,
          storageGbHours,
          egressGb,
          estimatedUsd: new Prisma.Decimal(usd.toFixed(4)),
          computedAt: periodEnd,
        },
        update: {
          estimatedUsd: new Prisma.Decimal(usd.toFixed(4)),
        },
      });
      count += 1;
    }
  }
  console.log(`[seed] cost records: ${count}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Notifications
// ─────────────────────────────────────────────────────────────────────────────

async function seedNotifications(): Promise<void> {
  const defs: Array<{
    key: string;
    userKey: string;
    type: NotificationType;
    title: string;
    body: string;
    link: string;
    readAgoMs?: number;
    createdAgoMs: number;
  }> = [
    {
      key: "n1",
      userKey: "alice",
      type: NotificationType.PREVIEW_READY,
      title: "Preview ready: PR #412",
      body: "storefront-pr-412 is live and healthy.",
      link: "https://storefront-pr-412.preview.acme.dev",
      createdAgoMs: 12 * MINUTE,
    },
    {
      key: "n2",
      userKey: "dave",
      type: NotificationType.BUILD_FAILED,
      title: "Build failed: PR #230",
      body: "payments-pr-230 failed: TS2532 in src/webhooks/backoff.ts.",
      link: "https://app.acme.dev/previews/payments-pr-230",
      createdAgoMs: 70 * MINUTE,
    },
    {
      key: "n3",
      userKey: "dave",
      type: NotificationType.PREVIEW_STOPPED,
      title: "Preview auto-stopped: PR #401",
      body: "storefront-pr-401 was idle for 26h and has been stopped.",
      link: "https://app.acme.dev/previews/storefront-pr-401",
      readAgoMs: 20 * HOUR,
      createdAgoMs: 25 * HOUR,
    },
    {
      key: "n4",
      userKey: "alice",
      type: NotificationType.BUDGET_EXCEEDED,
      title: "Budget alert: 82% of monthly budget used",
      body: "Acme has used $615 of the $750 monthly preview budget.",
      link: "https://app.acme.dev/teams/acme/usage",
      createdAgoMs: 6 * HOUR,
    },
    {
      key: "n5",
      userKey: "carol",
      type: NotificationType.REVIEW_REQUESTED,
      title: "Review requested: PR #412",
      body: "Alice requested your review on the PDP redesign.",
      link: "https://github.com/acme/storefront/pull/412",
      readAgoMs: 40 * MINUTE,
      createdAgoMs: 55 * MINUTE,
    },
  ];

  for (const n of defs) {
    await prisma.notification.upsert({
      where: { id: id("notif", n.key) },
      create: {
        id: id("notif", n.key),
        userId: userId(n.userKey),
        type: n.type,
        title: n.title,
        body: n.body,
        link: n.link,
        readAt: n.readAgoMs === undefined ? undefined : ago(n.readAgoMs),
        createdAt: ago(n.createdAgoMs),
      },
      update: {
        title: n.title,
        body: n.body,
        readAt: n.readAgoMs === undefined ? null : ago(n.readAgoMs),
      },
    });
  }
  console.log(`[seed] notifications: ${defs.length}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Audit logs
// ─────────────────────────────────────────────────────────────────────────────

async function seedAuditLogs(teamId: string): Promise<void> {
  const defs: Array<{
    key: string;
    actorKey: string;
    action: string;
    targetType: string;
    targetId: string;
    metadata: Prisma.InputJsonValue;
    createdAgoMs: number;
  }> = [
    {
      key: "a1",
      actorKey: "alice",
      action: "preview.pinned",
      targetType: "Preview",
      targetId: id("prev", "sf_412"),
      metadata: { slug: "storefront-pr-412" },
      createdAgoMs: 30 * MINUTE,
    },
    {
      key: "a2",
      actorKey: "bob",
      action: "preview.redeploy",
      targetType: "Preview",
      targetId: id("prev", "sf_409"),
      metadata: { slug: "storefront-pr-409", trigger: "MANUAL" },
      createdAgoMs: 3 * HOUR,
    },
    {
      key: "a3",
      actorKey: "alice",
      action: "envvar.created",
      targetType: "EnvVar",
      targetId: "FEATURE_PDP_V2",
      metadata: { scope: "PREVIEW", isSecret: false },
      createdAgoMs: 2 * DAY,
    },
    {
      key: "a4",
      actorKey: "dave",
      action: "preview.stopped",
      targetType: "Preview",
      targetId: id("prev", "sf_401"),
      metadata: { reason: "auto-stop", idleMinutes: 1560 },
      createdAgoMs: 25 * HOUR,
    },
    {
      key: "a5",
      actorKey: "alice",
      action: "team.budget.updated",
      targetType: "Team",
      targetId: teamId,
      metadata: { from: 500, to: 750 },
      createdAgoMs: 10 * DAY,
    },
  ];

  for (const a of defs) {
    await prisma.auditLog.upsert({
      where: { id: id("audit", a.key) },
      create: {
        id: id("audit", a.key),
        teamId,
        actorId: userId(a.actorKey),
        action: a.action,
        targetType: a.targetType,
        targetId: a.targetId,
        metadata: a.metadata,
        createdAt: ago(a.createdAgoMs),
      },
      update: { action: a.action, metadata: a.metadata },
    });
  }
  console.log(`[seed] audit logs: ${defs.length}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Webhook events
// ─────────────────────────────────────────────────────────────────────────────

async function seedWebhookEvents(): Promise<void> {
  const defs: Array<{
    key: string;
    deliveryId: string;
    eventType: string;
    action: string;
    status: WebhookStatus;
    error?: string;
    payload: Prisma.InputJsonValue;
    receivedAgoMs: number;
    processedAgoMs?: number;
  }> = [
    {
      key: "w1",
      deliveryId: "11111111-aaaa-4bbb-8ccc-000000000001",
      eventType: "pull_request",
      action: "opened",
      status: WebhookStatus.PROCESSED,
      payload: { repository: { full_name: "acme/storefront" }, number: 412, action: "opened" },
      receivedAgoMs: 2 * DAY,
      processedAgoMs: 2 * DAY - 3_000,
    },
    {
      key: "w2",
      deliveryId: "11111111-aaaa-4bbb-8ccc-000000000002",
      eventType: "pull_request",
      action: "synchronize",
      status: WebhookStatus.PROCESSED,
      payload: { repository: { full_name: "acme/storefront" }, number: 412, action: "synchronize" },
      receivedAgoMs: 14 * MINUTE,
      processedAgoMs: 14 * MINUTE - 2_000,
    },
    {
      key: "w3",
      deliveryId: "11111111-aaaa-4bbb-8ccc-000000000003",
      eventType: "pull_request",
      action: "closed",
      status: WebhookStatus.PROCESSED,
      payload: { repository: { full_name: "acme/payments-api" }, number: 226, action: "closed", pull_request: { merged: true } },
      receivedAgoMs: 11 * DAY,
      processedAgoMs: 11 * DAY - 5_000,
    },
    {
      key: "w4",
      deliveryId: "11111111-aaaa-4bbb-8ccc-000000000004",
      eventType: "ping",
      action: "",
      status: WebhookStatus.SKIPPED,
      payload: { zen: "Keep it logically awesome." },
      receivedAgoMs: 60 * DAY,
    },
    {
      key: "w5",
      deliveryId: "11111111-aaaa-4bbb-8ccc-000000000005",
      eventType: "pull_request",
      action: "synchronize",
      status: WebhookStatus.FAILED,
      error: "deploy job enqueue failed: redis ECONNREFUSED",
      payload: { repository: { full_name: "acme/payments-api" }, number: 230, action: "synchronize" },
      receivedAgoMs: 70 * MINUTE,
      processedAgoMs: 70 * MINUTE - 1_000,
    },
  ];

  for (const w of defs) {
    await prisma.webhookEvent.upsert({
      where: { deliveryId: w.deliveryId },
      create: {
        id: id("wh", w.key),
        provider: RepoProvider.GITHUB,
        deliveryId: w.deliveryId,
        eventType: w.eventType,
        action: w.action === "" ? undefined : w.action,
        payload: w.payload,
        status: w.status,
        error: w.error,
        receivedAt: ago(w.receivedAgoMs),
        processedAt:
          w.processedAgoMs === undefined ? undefined : ago(w.processedAgoMs),
      },
      update: { status: w.status, error: w.error ?? null },
    });
  }
  console.log(`[seed] webhook events: ${defs.length}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// API token (store only the hash + prefix)
// ─────────────────────────────────────────────────────────────────────────────

async function seedApiToken(teamId: string): Promise<void> {
  // We never store the plaintext token. The hash below is a stable, opaque
  // value standing in for SHA-256(plaintext); a real token is shown to the
  // user exactly once at creation time.
  const prefix = "shpyd_ci";
  const hashedToken =
    "8f3a2c1b9e7d6f5a4c3b2a1908f7e6d5c4b3a2918f7e6d5c4b3a2918f7e6d5c4";
  await prisma.apiToken.upsert({
    where: { hashedToken },
    create: {
      id: id("tok", "ci"),
      teamId,
      userId: userId("alice"),
      name: "CI deploy token",
      hashedToken,
      prefix,
      scopes: ["previews:read", "previews:write", "deployments:write"],
      lastUsedAt: ago(35 * MINUTE),
      expiresAt: ahead(120 * DAY),
      createdAt: ago(40 * DAY),
    },
    update: {
      scopes: ["previews:read", "previews:write", "deployments:write"],
      lastUsedAt: ago(35 * MINUTE),
    },
  });
  console.log("[seed] api token: 1 (hash only)");
}

// ─────────────────────────────────────────────────────────────────────────────
// Entrypoint
// ─────────────────────────────────────────────────────────────────────────────

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (err: unknown) => {
    console.error("[seed] FAILED:", err);
    await prisma.$disconnect();
    process.exitCode = 1;
  });
