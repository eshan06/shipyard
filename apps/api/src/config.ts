/**
 * Runtime configuration for the Shipyard control-plane API.
 *
 * The API validates its entire environment once at startup with a zod schema
 * and fails fast on any invalid/missing variable (per `docs/ENGINEERING.md` §4).
 * Downstream code reads the validated, typed {@link AppConfig} rather than
 * touching `process.env` directly, so a misconfiguration can never silently
 * surface deep inside a request handler.
 *
 * @module
 */

import { z } from "zod";

import { loadEncryptionKey } from "@shipyard/core";

/**
 * Coerce a loosely-typed env string into a boolean. Accepts the common truthy
 * spellings (`1`, `true`, `yes`, `on`, case-insensitive); everything else —
 * including `undefined` — is `false`. Returned as a zod schema so it composes
 * with `.default(...)`.
 */
const BooleanFromEnv = z
  .union([z.boolean(), z.string()])
  .transform((v) => {
    if (typeof v === "boolean") return v;
    return ["1", "true", "yes", "on"].includes(v.trim().toLowerCase());
  });

/**
 * The full, validated environment schema for the API. Optional GitHub vars are
 * left optional so the service boots without OAuth/webhooks configured; the
 * affected routes report "not configured" at call time instead.
 */
const ConfigSchema = z.object({
  /** Node runtime mode; gates dev-only behaviour and pretty logging. */
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  /** Pino log level. */
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),

  /** Postgres connection string (read by Prisma). */
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  /** Redis connection string (BullMQ queues + pub/sub). */
  REDIS_URL: z.string().min(1, "REDIS_URL is required"),
  /**
   * Base64 32-byte secrets key. Validated via core `loadEncryptionKey`, which
   * throws a clear message when it is missing or the wrong length.
   */
  SECRETS_ENCRYPTION_KEY: z
    .string()
    .min(1, "SECRETS_ENCRYPTION_KEY is required")
    .superRefine((value, ctx) => {
      try {
        loadEncryptionKey({ SECRETS_ENCRYPTION_KEY: value });
      } catch (error) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            error instanceof Error
              ? error.message
              : "SECRETS_ENCRYPTION_KEY is invalid",
        });
      }
    }),

  /** Interface the HTTP server binds to. */
  API_HOST: z.string().min(1).default("0.0.0.0"),
  /** Port the HTTP server listens on. */
  API_PORT: z.coerce.number().int().min(1).max(65_535).default(4000),

  /** Dashboard origin — used for CORS and OAuth redirects. */
  PUBLIC_APP_URL: z.string().url("PUBLIC_APP_URL must be a URL"),
  /** Public base URL of this API. */
  PUBLIC_API_URL: z.string().url("PUBLIC_API_URL must be a URL"),
  /** Wildcard DNS domain for preview URLs (`<slug>.<domain>`). */
  PREVIEW_BASE_DOMAIN: z.string().min(1, "PREVIEW_BASE_DOMAIN is required"),

  /** Secret used to sign the session cookie / JWT and the cookie plugin. */
  SESSION_SECRET: z
    .string()
    .min(
      32,
      "SESSION_SECRET must be at least 32 characters (generate with `openssl rand -hex 32`)",
    ),
  /** Dev convenience: enables password-less `POST /auth/dev-login`. */
  DEV_AUTH: BooleanFromEnv.default(false),

  /**
   * Whether/how much to trust `X-Forwarded-*` headers. Passed straight to
   * Fastify's `trustProxy`. Accepts:
   *  - a boolean word (`true`/`false`/`yes`/`no`/`on`/`off`) → boolean;
   *  - a bare integer → the number of proxy hops to trust (e.g. `1`);
   *  - any other non-empty string → a comma-separated IP/CIDR allowlist in
   *    Fastify/proxy-addr syntax (e.g. `10.0.0.0/8,127.0.0.1`).
   *
   * Defaults to `true` to preserve out-of-the-box local/dev behaviour. In
   * production behind a single known proxy, set the hop count (`1`) or the
   * proxy's IP/subnet so clients cannot spoof `X-Forwarded-For` to defeat the
   * per-IP rate limiter.
   */
  TRUST_PROXY: z
    .union([z.boolean(), z.string()])
    .default(true)
    .transform((v): boolean | number | string => {
      if (typeof v === "boolean") return v;
      const trimmed = v.trim();
      const lower = trimmed.toLowerCase();
      if (["true", "yes", "on"].includes(lower)) return true;
      if (["false", "no", "off"].includes(lower)) return false;
      // A bare integer means "trust this many proxy hops".
      if (/^\d+$/.test(trimmed)) return Number.parseInt(trimmed, 10);
      // Otherwise treat it as an IP/subnet allowlist and pass it through.
      return trimmed;
    }),

  /** GitHub OAuth app client id (dashboard login). Optional. */
  GITHUB_OAUTH_CLIENT_ID: z.string().optional(),
  /** GitHub OAuth app client secret. Optional. */
  GITHUB_OAUTH_CLIENT_SECRET: z.string().optional(),
  /** Shared secret for verifying inbound GitHub webhook signatures. Optional. */
  GITHUB_WEBHOOK_SECRET: z.string().optional(),

  /** Max requests per window, per ip/token, for the rate limiter. */
  RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(200),
  /** Rate-limit window (a `@fastify/rate-limit` duration string or ms number). */
  RATE_LIMIT_WINDOW: z.string().min(1).default("1 minute"),

  /** Expose the Prometheus `GET /metrics` endpoint. Defaults on. */
  METRICS_ENABLED: BooleanFromEnv.default(true),

  // ── Product analytics / telemetry ──────────────────────────────────────────
  /**
   * Which sink receives product-analytics events (those posted to
   * `POST /api/v1/telemetry` and any server-side `app.analytics.track(...)`).
   * - `log` (default): emit durable, structured pino events — a real,
   *   dependency-free sink that ships to whatever collector consumes the API's
   *   logs. Nothing leaves the cluster.
   * - `http`: POST each event as JSON to {@link ANALYTICS_HTTP_ENDPOINT} (a
   *   warehouse/collector of your choice).
   * - `posthog`: send events to PostHog's capture API.
   * Mirrors the worker's `DEPLOY_DRIVER` driver-toggle convention.
   */
  ANALYTICS_DRIVER: z.enum(["log", "http", "posthog"]).default("log"),
  /** Collector endpoint for the `http` driver (required when driver=http). */
  ANALYTICS_HTTP_ENDPOINT: z.string().url().optional(),
  /**
   * Optional `Authorization` header value the `http` driver sends (e.g.
   * `"Bearer <token>"`). Omit for unauthenticated collectors.
   */
  ANALYTICS_HTTP_AUTH_HEADER: z.string().optional(),
  /** PostHog instance host for the `posthog` driver. */
  ANALYTICS_POSTHOG_HOST: z
    .string()
    .url()
    .default("https://us.i.posthog.com"),
  /** PostHog project API key (required when driver=posthog). */
  ANALYTICS_POSTHOG_API_KEY: z.string().optional(),
})
  .superRefine((cfg, ctx) => {
    // Driver-specific requirements: fail fast at startup, not at first event.
    if (cfg.ANALYTICS_DRIVER === "http" && !cfg.ANALYTICS_HTTP_ENDPOINT) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["ANALYTICS_HTTP_ENDPOINT"],
        message: "ANALYTICS_HTTP_ENDPOINT is required when ANALYTICS_DRIVER=http",
      });
    }
    if (cfg.ANALYTICS_DRIVER === "posthog" && !cfg.ANALYTICS_POSTHOG_API_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["ANALYTICS_POSTHOG_API_KEY"],
        message:
          "ANALYTICS_POSTHOG_API_KEY is required when ANALYTICS_DRIVER=posthog",
      });
    }
  });

/**
 * The validated, typed application configuration. This is the only shape the
 * rest of the API should depend on for environment-derived settings.
 */
export type AppConfig = Readonly<z.infer<typeof ConfigSchema>>;

/**
 * Parse and validate the process environment into an {@link AppConfig}.
 *
 * @param env - Environment map to read from. Defaults to `process.env`.
 * @returns A frozen, fully-validated configuration object.
 * @throws Error with a single message listing every invalid/missing field when
 *   validation fails — surfaced once at startup so the operator can fix them all.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  // Treat a blank env var as unset. `.env` files (and `.env.example`) routinely
  // ship keys with empty values as documentation placeholders (e.g.
  // `ANALYTICS_HTTP_ENDPOINT=`); an empty string is "present" to zod, so it
  // would fail stricter optional validators like `.url()` instead of falling
  // through to `.optional()`/`.default()`. Stripping blanks here makes "unset"
  // and "empty" mean the same thing across every field.
  const compact: NodeJS.ProcessEnv = {};
  for (const [key, value] of Object.entries(env)) {
    if (value !== undefined && value !== "") compact[key] = value;
  }
  const parsed = ConfigSchema.safeParse(compact);
  if (!parsed.success) {
    const lines = parsed.error.issues
      .map((issue) => {
        const path = issue.path.join(".") || "(root)";
        return `  - ${path}: ${issue.message}`;
      })
      .join("\n");
    throw new Error(
      `Invalid API configuration. Fix the following environment variables:\n${lines}`,
    );
  }
  return Object.freeze(parsed.data);
}
