/**
 * {@link ComposePlanner} — turns a project's configuration into a
 * {@link PreviewPlan}.
 *
 * Two sources are supported:
 *  1. An existing `docker-compose.yml` (parsed with `js-yaml`) — services,
 *     images/builds, env, ports, healthchecks and `depends_on` are translated
 *     into engine {@link ServicePlan}s.
 *  2. A synthesized default stack (`web` + `api` + `postgres` + `redis`) when no
 *     compose file is provided — a sensible full-stack default for previews.
 *
 * Every produced resource carries deterministic Shipyard labels so the
 * orchestrator can later discover and tear it down by `previewId`.
 */

import { load as parseYaml } from "js-yaml";
import {
  PreviewPlan,
  ServiceKind,
  ServicePlan,
  ShipyardLabel,
  previewPlanSchema,
  servicePlanSchema,
  type Healthcheck,
  type PortMapping,
} from "./types.js";
import { InvalidPlanError } from "./errors.js";

// ─────────────────────────────────────────────────────────────────────────────
// Planner inputs
// ─────────────────────────────────────────────────────────────────────────────

/** A detected application framework; influences default image/command choices. */
export type Framework =
  | "next"
  | "vite"
  | "remix"
  | "astro"
  | "node"
  | "express"
  | "fastify"
  | "unknown";

/** Configuration describing how to build a project's preview. */
export interface ProjectConfig {
  /** Raw `docker-compose.yml` contents. When present, it is parsed and used. */
  composeFile?: string;
  /**
   * Build context directory for synthesized `web`/`api` services (the project
   * checkout). Defaults to `.`.
   */
  rootDirectory?: string;
  /** Dockerfile (relative to {@link rootDirectory}) for the web service. */
  webDockerfile?: string;
  /** Dockerfile (relative to {@link rootDirectory}) for the api service. */
  apiDockerfile?: string;
  /** Override image for the database service. Defaults to `postgres:16-alpine`. */
  databaseImage?: string;
  /** Override image for the cache service. Defaults to `redis:7-alpine`. */
  cacheImage?: string;
  /** Disable the default database service in the synthesized plan. */
  withDatabase?: boolean;
  /** Disable the default cache service in the synthesized plan. */
  withCache?: boolean;
}

/** Inputs to {@link ComposePlanner.plan}. */
export interface PlanInput {
  /** Owning preview id (cuid). */
  previewId: string;
  /** URL-safe preview slug. */
  slug: string;
  /** Project id (for labelling). */
  projectId?: string;
  /** Project configuration / compose file. */
  config?: ProjectConfig;
  /** Detected framework; defaults to `unknown`. */
  framework?: Framework;
  /**
   * Resolved environment variables to inject. Applied to every synthesized app
   * service, and merged over compose-declared env (caller values win).
   */
  env?: Record<string, string>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Compose file typings (the subset we read)
// ─────────────────────────────────────────────────────────────────────────────

interface ComposeHealthcheck {
  test?: string | string[];
  interval?: string;
  timeout?: string;
  retries?: number;
  start_period?: string;
}

interface ComposeService {
  image?: string;
  build?: string | { context?: string; dockerfile?: string; args?: Record<string, string>; target?: string };
  command?: string | string[];
  environment?: Record<string, string | number | boolean | null> | string[];
  ports?: Array<string | number>;
  expose?: Array<string | number>;
  volumes?: string[];
  depends_on?: string[] | Record<string, unknown>;
  healthcheck?: ComposeHealthcheck;
  restart?: string;
}

interface ComposeFile {
  services?: Record<string, ComposeService>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Planner
// ─────────────────────────────────────────────────────────────────────────────

/** Default network name for a preview, derived deterministically from its slug. */
export function networkNameFor(slug: string): string {
  return `shipyard-${slug}`;
}

/** Default named-volume prefix for a preview. */
function volumeNameFor(slug: string, name: string): string {
  return `shipyard-${slug}-${name}`;
}

/** Build the deterministic label set stamped on every resource of a preview. */
export function buildLabels(input: {
  previewId: string;
  slug: string;
  projectId?: string;
}): Record<string, string> {
  const labels: Record<string, string> = {
    [ShipyardLabel.managed]: "true",
    [ShipyardLabel.previewId]: input.previewId,
    [ShipyardLabel.slug]: input.slug,
    [ShipyardLabel.createdAt]: new Date().toISOString(),
  };
  if (input.projectId) labels["shipyard.projectId"] = input.projectId;
  return labels;
}

/**
 * Produces {@link PreviewPlan}s from project configuration.
 *
 * Stateless and deterministic given its inputs (except for the `createdAt`
 * label timestamp), so it is trivially unit-testable.
 */
export class ComposePlanner {
  /**
   * Produce a validated {@link PreviewPlan} for the given input.
   *
   * @throws {@link InvalidPlanError} if the compose file is malformed or the
   *         resulting plan fails schema validation.
   */
  plan(input: PlanInput): PreviewPlan {
    const slug = input.slug;
    const env = input.env ?? {};
    const services = input.config?.composeFile
      ? this.fromCompose(input.config.composeFile, slug, env)
      : this.synthesizeDefault(input);

    if (services.length === 0) {
      throw new InvalidPlanError("Plan produced no services.");
    }

    const labels = buildLabels({
      previewId: input.previewId,
      slug,
      projectId: input.projectId,
    });

    const primaryServiceName = this.pickPrimaryService(services);

    const draft: PreviewPlan = {
      previewId: input.previewId,
      slug,
      networkName: networkNameFor(slug),
      projectId: input.projectId,
      services,
      labels,
      primaryServiceName,
    };

    const parsed = previewPlanSchema.safeParse(draft);
    if (!parsed.success) {
      throw new InvalidPlanError(`Generated plan is invalid: ${parsed.error.message}`, parsed.error);
    }
    return parsed.data;
  }

  /**
   * Translate a `docker-compose.yml` document into engine {@link ServicePlan}s.
   *
   * Caller-supplied `env` is merged over each service's compose-declared
   * environment (caller values take precedence) so resolved secrets win.
   */
  private fromCompose(composeFile: string, slug: string, env: Record<string, string>): ServicePlan[] {
    let doc: unknown;
    try {
      doc = parseYaml(composeFile);
    } catch (cause) {
      throw new InvalidPlanError("Failed to parse docker-compose.yml.", cause);
    }
    if (doc == null || typeof doc !== "object") {
      throw new InvalidPlanError("docker-compose.yml is empty or not an object.");
    }
    const compose = doc as ComposeFile;
    const serviceEntries = Object.entries(compose.services ?? {});
    if (serviceEntries.length === 0) {
      throw new InvalidPlanError("docker-compose.yml declares no services.");
    }

    const plans: ServicePlan[] = [];
    for (const [name, svc] of serviceEntries) {
      plans.push(this.composeServiceToPlan(name, svc, slug, env));
    }
    return plans;
  }

  /** Convert one compose service definition into a validated {@link ServicePlan}. */
  private composeServiceToPlan(
    name: string,
    svc: ComposeService,
    slug: string,
    callerEnv: Record<string, string>,
  ): ServicePlan {
    const kind = inferKind(name, svc.image);

    const draft: Record<string, unknown> = {
      name,
      kind,
      env: { ...normalizeEnv(svc.environment), ...callerEnv },
      ports: normalizePorts(svc.ports, svc.expose),
      dependsOn: normalizeDependsOn(svc.depends_on),
      restart: normalizeRestart(svc.restart),
    };

    if (svc.command != null) {
      draft.command = Array.isArray(svc.command) ? svc.command : ["sh", "-c", svc.command];
    }
    if (svc.volumes && svc.volumes.length > 0) {
      draft.volumes = normalizeVolumes(svc.volumes, slug);
    }
    const healthcheck = normalizeHealthcheck(svc.healthcheck);
    if (healthcheck) draft.healthcheck = healthcheck;

    // image / build resolution (exactly one).
    if (svc.build != null) {
      draft.build =
        typeof svc.build === "string"
          ? { context: svc.build }
          : {
              context: svc.build.context ?? ".",
              ...(svc.build.dockerfile ? { dockerfile: svc.build.dockerfile } : {}),
              ...(svc.build.args ? { args: svc.build.args } : {}),
              ...(svc.build.target ? { target: svc.build.target } : {}),
            };
    } else if (svc.image != null) {
      draft.image = svc.image;
    } else {
      throw new InvalidPlanError(`Compose service "${name}" has neither image nor build.`);
    }

    const parsed = servicePlanSchema.safeParse(draft);
    if (!parsed.success) {
      throw new InvalidPlanError(
        `Compose service "${name}" is invalid: ${parsed.error.message}`,
        parsed.error,
      );
    }
    return parsed.data;
  }

  /**
   * Build the default full-stack plan: `web` + `api` + `postgres` + `redis`.
   *
   * `web` and `api` are built from the project checkout (Dockerfile); the
   * database/cache use upstream images. Internal connection strings are wired
   * so the api can reach postgres/redis by their in-network hostnames.
   */
  private synthesizeDefault(input: PlanInput): ServicePlan[] {
    const cfg = input.config ?? {};
    const context = cfg.rootDirectory ?? ".";
    const callerEnv = input.env ?? {};
    const withDb = cfg.withDatabase !== false;
    const withCache = cfg.withCache !== false;

    const dbName = "postgres";
    const cacheName = "redis";
    const databaseUrl = `postgres://shipyard:shipyard@${dbName}:5432/shipyard`;
    const redisUrl = `redis://${cacheName}:6379`;

    const services: ServicePlan[] = [];

    // Database (postgres)
    if (withDb) {
      services.push(
        servicePlanSchema.parse({
          name: dbName,
          kind: "database" satisfies ServiceKind,
          image: cfg.databaseImage ?? "postgres:16-alpine",
          env: {
            POSTGRES_USER: "shipyard",
            POSTGRES_PASSWORD: "shipyard",
            POSTGRES_DB: "shipyard",
          },
          ports: [{ container: 5432 }],
          volumes: [{ name: volumeNameFor(input.slug, "pgdata"), mountPath: "/var/lib/postgresql/data" }],
          healthcheck: {
            command: "pg_isready -U shipyard -d shipyard",
            intervalMs: 5_000,
            timeoutMs: 5_000,
            retries: 12,
          },
        }),
      );
    }

    // Cache (redis)
    if (withCache) {
      services.push(
        servicePlanSchema.parse({
          name: cacheName,
          kind: "cache" satisfies ServiceKind,
          image: cfg.cacheImage ?? "redis:7-alpine",
          command: ["redis-server", "--appendonly", "yes"],
          ports: [{ container: 6379 }],
          volumes: [{ name: volumeNameFor(input.slug, "redisdata"), mountPath: "/data" }],
          healthcheck: {
            command: "redis-cli ping",
            intervalMs: 5_000,
            timeoutMs: 3_000,
            retries: 12,
          },
        }),
      );
    }

    // API service (built from the checkout)
    const apiDependsOn = [...(withDb ? [dbName] : []), ...(withCache ? [cacheName] : [])];
    services.push(
      servicePlanSchema.parse({
        name: "api",
        kind: "api" satisfies ServiceKind,
        build: { context, dockerfile: cfg.apiDockerfile ?? "Dockerfile" },
        env: {
          NODE_ENV: "production",
          PORT: "3001",
          ...(withDb ? { DATABASE_URL: databaseUrl } : {}),
          ...(withCache ? { REDIS_URL: redisUrl } : {}),
          ...callerEnv,
        },
        ports: [{ container: 3001 }],
        dependsOn: apiDependsOn,
        healthcheck: { httpPath: "/health", port: 3001 },
      }),
    );

    // Web service (built from the checkout)
    services.push(
      servicePlanSchema.parse({
        name: "web",
        kind: "web" satisfies ServiceKind,
        build: { context, dockerfile: cfg.webDockerfile ?? "Dockerfile" },
        env: {
          NODE_ENV: "production",
          PORT: "3000",
          API_URL: "http://api:3001",
          NEXT_PUBLIC_API_URL: "http://api:3001",
          ...callerEnv,
        },
        ports: [{ container: 3000 }],
        dependsOn: ["api"],
        healthcheck: { httpPath: frameworkHealthPath(input.framework), port: 3000 },
      }),
    );

    return services;
  }

  /**
   * Choose the preview's primary service (the one whose URL is the preview URL).
   * Preference order: explicit `web` → first `web` kind → first `api` kind →
   * first service with a published port → first service.
   */
  private pickPrimaryService(services: ServicePlan[]): string | undefined {
    const byName = services.find((s) => s.name === "web");
    if (byName) return byName.name;
    const web = services.find((s) => s.kind === "web");
    if (web) return web.name;
    const api = services.find((s) => s.kind === "api");
    if (api) return api.name;
    const withPort = services.find((s) => s.ports.length > 0);
    if (withPort) return withPort.name;
    return services[0]?.name;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Compose normalization helpers (exported for unit testing)
// ─────────────────────────────────────────────────────────────────────────────

/** Map a service name/image to a {@link ServiceKind} heuristically. */
export function inferKind(name: string, image?: string): ServiceKind {
  const haystack = `${name} ${image ?? ""}`.toLowerCase();
  if (/\b(postgres|mysql|mariadb|mongo|cockroach)\b/.test(haystack)) return "database";
  if (/\b(redis|memcached|valkey)\b/.test(haystack)) return "cache";
  if (/(^|[-_])web([-_]|$)|frontend|next|nuxt|vite/.test(haystack)) return "web";
  if (/(^|[-_])api([-_]|$)|backend|server|gateway/.test(haystack)) return "api";
  if (/worker|queue|consumer|cron/.test(haystack)) return "worker";
  return "custom";
}

/** Normalize compose `environment` (map or `KEY=VAL` array) into a string map. */
export function normalizeEnv(
  environment: ComposeService["environment"],
): Record<string, string> {
  if (!environment) return {};
  if (Array.isArray(environment)) {
    const out: Record<string, string> = {};
    for (const entry of environment) {
      const idx = entry.indexOf("=");
      if (idx === -1) {
        out[entry] = "";
      } else {
        out[entry.slice(0, idx)] = entry.slice(idx + 1);
      }
    }
    return out;
  }
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(environment)) {
    out[key] = value == null ? "" : String(value);
  }
  return out;
}

/** Normalize compose `ports`/`expose` into {@link PortMapping}s. */
export function normalizePorts(
  ports: ComposeService["ports"],
  expose: ComposeService["expose"],
): PortMapping[] {
  const out: PortMapping[] = [];
  for (const entry of ports ?? []) {
    const mapping = parsePortString(String(entry));
    if (mapping) out.push(mapping);
  }
  for (const entry of expose ?? []) {
    const container = Number.parseInt(String(entry), 10);
    if (Number.isFinite(container) && !out.some((p) => p.container === container)) {
      out.push({ container, protocol: "tcp" });
    }
  }
  return out;
}

/**
 * Parse a single compose port string into a {@link PortMapping}.
 *
 * Handles `"8080"`, `"3000:3000"`, `"127.0.0.1:8080:80"`, and `"53:53/udp"`.
 * Returns `undefined` for unparseable values.
 */
export function parsePortString(raw: string): PortMapping | undefined {
  const [portPart, protoPart] = raw.split("/");
  if (!portPart) return undefined;
  const protocol = protoPart === "udp" ? "udp" : "tcp";
  const segments = portPart.split(":");
  // Last segment is always the container port; the one before (if present) is host.
  const containerStr = segments[segments.length - 1];
  const hostStr = segments.length >= 2 ? segments[segments.length - 2] : undefined;
  const container = Number.parseInt(containerStr ?? "", 10);
  if (!Number.isFinite(container)) return undefined;
  const host = hostStr != null ? Number.parseInt(hostStr, 10) : undefined;
  return {
    container,
    ...(host != null && Number.isFinite(host) ? { host } : {}),
    protocol,
  };
}

/** Normalize compose `depends_on` (array or map form) into a name list. */
export function normalizeDependsOn(dependsOn: ComposeService["depends_on"]): string[] {
  if (!dependsOn) return [];
  if (Array.isArray(dependsOn)) return [...dependsOn];
  return Object.keys(dependsOn);
}

/** Map compose `restart` policy strings onto the engine's restart enum. */
export function normalizeRestart(
  restart: string | undefined,
): ServicePlan["restart"] {
  switch (restart) {
    case "always":
      return "always";
    case "on-failure":
      return "on-failure";
    case "no":
      return "no";
    case "unless-stopped":
    default:
      return "unless-stopped";
  }
}

/** Normalize compose `volumes` (named + bind) into engine named-volume mounts. */
export function normalizeVolumes(
  volumes: string[],
  slug: string,
): Array<{ name: string; mountPath: string }> {
  const out: Array<{ name: string; mountPath: string }> = [];
  for (const entry of volumes) {
    const parts = entry.split(":");
    if (parts.length < 2) continue;
    const source = parts[0]!;
    const mountPath = parts[1]!;
    // Only named volumes (not host bind mounts) are portable across hosts.
    const isNamed = !source.startsWith(".") && !source.startsWith("/") && !source.includes("/");
    const name = isNamed ? volumeNameFor(slug, source) : volumeNameFor(slug, mountPath.replace(/[^a-z0-9]+/gi, "-"));
    out.push({ name, mountPath });
  }
  return out;
}

/**
 * Translate a compose healthcheck into the engine's {@link Healthcheck} shape.
 * Only `CMD`/`CMD-SHELL` test forms are mapped; durations are parsed from
 * compose's Go-style strings (`"5s"`, `"1m30s"`, `"500ms"`).
 */
export function normalizeHealthcheck(
  hc: ComposeHealthcheck | undefined,
): Partial<Healthcheck> | undefined {
  if (!hc || !hc.test) return undefined;
  let command: string | undefined;
  if (Array.isArray(hc.test)) {
    const [mode, ...rest] = hc.test;
    if (mode === "CMD-SHELL") command = rest.join(" ");
    else if (mode === "CMD") command = rest.join(" ");
    else if (mode === "NONE") return undefined;
    else command = hc.test.join(" ");
  } else if (typeof hc.test === "string") {
    command = hc.test;
  }
  if (!command) return undefined;
  const out: Partial<Healthcheck> = { command };
  const interval = parseDuration(hc.interval);
  if (interval != null) out.intervalMs = interval;
  const timeout = parseDuration(hc.timeout);
  if (timeout != null) out.timeoutMs = timeout;
  if (typeof hc.retries === "number") out.retries = hc.retries;
  const start = parseDuration(hc.start_period);
  if (start != null) out.startPeriodMs = start;
  return out;
}

/**
 * Parse a Go-style duration string (as used by compose) into milliseconds.
 * Supports `h`, `m`, `s`, `ms`, `us`/`µs`, `ns`; returns `undefined` if empty
 * or unparseable.
 */
export function parseDuration(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const re = /(\d+(?:\.\d+)?)(ms|us|µs|ns|h|m|s)/g;
  let match: RegExpExecArray | null;
  let total = 0;
  let matched = false;
  while ((match = re.exec(value)) !== null) {
    matched = true;
    const n = Number.parseFloat(match[1]!);
    switch (match[2]) {
      case "h":
        total += n * 3_600_000;
        break;
      case "m":
        total += n * 60_000;
        break;
      case "s":
        total += n * 1_000;
        break;
      case "ms":
        total += n;
        break;
      case "us":
      case "µs":
        total += n / 1_000;
        break;
      case "ns":
        total += n / 1_000_000;
        break;
    }
  }
  return matched ? Math.round(total) : undefined;
}

/** Default health path per framework for the synthesized web service. */
function frameworkHealthPath(framework: Framework | undefined): string {
  switch (framework) {
    case "next":
    case "remix":
    case "astro":
      return "/";
    default:
      return "/";
  }
}
