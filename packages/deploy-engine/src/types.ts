/**
 * Core type contracts for `@shipyard/deploy-engine`.
 *
 * These types describe the *plan* for a preview stack (the desired state), the
 * *runtime* facts about running containers (the observed state), and the
 * {@link PreviewOrchestrator} interface that turns one into the other.
 *
 * The vocabulary intentionally mirrors the Shipyard domain model
 * (`packages/db/prisma/schema.prisma`): {@link ServiceKind} corresponds to the
 * `ServiceType` enum and {@link ServiceState} to `ServiceStatus`, so the worker
 * can map engine output straight onto persisted rows.
 */

import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// Labels — deterministic resource tags used for discovery & cleanup
// ─────────────────────────────────────────────────────────────────────────────

/** Canonical Docker label keys stamped on every Shipyard-managed resource. */
export const ShipyardLabel = {
  /** Marks a resource as managed by Shipyard. Value is always `"true"`. */
  managed: "shipyard.managed",
  /** The owning preview's id (cuid). Primary teardown discriminator. */
  previewId: "shipyard.previewId",
  /** URL-safe preview slug, e.g. used for `<slug>.preview.domain`. */
  slug: "shipyard.slug",
  /** Logical service name within the preview (unique per preview). */
  service: "shipyard.service",
  /** Service kind (see {@link ServiceKind}). */
  serviceType: "shipyard.serviceType",
  /** ISO-8601 creation timestamp, useful for age-based cleanup. */
  createdAt: "shipyard.createdAt",
} as const;

export type ShipyardLabelKey = (typeof ShipyardLabel)[keyof typeof ShipyardLabel];

// ─────────────────────────────────────────────────────────────────────────────
// Service kinds & states (mirror Prisma ServiceType / ServiceStatus)
// ─────────────────────────────────────────────────────────────────────────────

/** Logical role of a service inside a preview stack. Mirrors Prisma `ServiceType`. */
export const SERVICE_KINDS = ["web", "api", "worker", "database", "cache", "custom"] as const;
export type ServiceKind = (typeof SERVICE_KINDS)[number];

/** Observed lifecycle state of a single service. Mirrors Prisma `ServiceStatus`. */
export const SERVICE_STATES = [
  "pending",
  "starting",
  "healthy",
  "unhealthy",
  "stopped",
  "crashed",
] as const;
export type ServiceState = (typeof SERVICE_STATES)[number];

/** Aggregate lifecycle state of a whole preview. Mirrors Prisma `PreviewStatus`. */
export const PREVIEW_STATES = [
  "queued",
  "building",
  "deploying",
  "running",
  "degraded",
  "stopped",
  "failed",
  "destroying",
  "destroyed",
] as const;
export type PreviewState = (typeof PREVIEW_STATES)[number];

// ─────────────────────────────────────────────────────────────────────────────
// Service plan (desired state of a single container)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A container port mapping. `container` is the port the process listens on
 * inside the container; `host` is the optional published port on the daemon
 * host (omit to let the engine/daemon allocate an ephemeral one).
 */
export const portMappingSchema = z.object({
  /** Port the service listens on inside the container. */
  container: z.number().int().min(1).max(65535),
  /** Published host port. When omitted, the daemon assigns an ephemeral port. */
  host: z.number().int().min(0).max(65535).optional(),
  /** Transport protocol. Defaults to `tcp`. */
  protocol: z.enum(["tcp", "udp"]).default("tcp"),
});
export type PortMapping = z.infer<typeof portMappingSchema>;

/**
 * How a service image is produced: either a pre-built `image` reference or a
 * `build` from a local context directory + Dockerfile. Exactly one is required.
 */
export const buildSpecSchema = z.object({
  /** Build context directory (absolute or relative to the project checkout). */
  context: z.string().min(1),
  /** Dockerfile path relative to {@link BuildSpec.context}. Defaults to `Dockerfile`. */
  dockerfile: z.string().min(1).default("Dockerfile"),
  /** Build-time `--build-arg` values. */
  args: z.record(z.string()).default({}),
  /** Optional explicit tag to apply to the built image. */
  tag: z.string().min(1).optional(),
  /** Build target stage for multi-stage Dockerfiles. */
  target: z.string().min(1).optional(),
});
export type BuildSpec = z.infer<typeof buildSpecSchema>;

/**
 * Container-level healthcheck. The engine prefers an HTTP probe (`httpPath`)
 * when set; otherwise it falls back to the container's own Docker HEALTHCHECK
 * (or to a "running" check when neither is available).
 */
export const healthcheckSchema = z.object({
  /** HTTP path to GET against the first published/exposed port, e.g. `/healthz`. */
  httpPath: z.string().min(1).optional(),
  /** Port to probe for the HTTP check. Defaults to the service's first port. */
  port: z.number().int().min(1).max(65535).optional(),
  /** Shell command form (`CMD-SHELL`) for a Docker-native healthcheck. */
  command: z.string().min(1).optional(),
  /** Time between probes, milliseconds. */
  intervalMs: z.number().int().positive().default(5_000),
  /** Per-probe timeout, milliseconds. */
  timeoutMs: z.number().int().positive().default(3_000),
  /** Consecutive failures before the service is considered unhealthy. */
  retries: z.number().int().positive().default(10),
  /** Grace period before the first probe counts, milliseconds. */
  startPeriodMs: z.number().int().nonnegative().default(0),
});
export type Healthcheck = z.infer<typeof healthcheckSchema>;

/**
 * The desired state of one service (a single container) within a preview.
 *
 * Exactly one of {@link ServicePlan.image} or {@link ServicePlan.build} must be
 * provided; this invariant is enforced by {@link servicePlanSchema}.
 */
export const servicePlanSchema = z
  .object({
    /** Logical, preview-unique service name (e.g. `web`, `api`, `postgres`). */
    name: z
      .string()
      .min(1)
      .regex(/^[a-z0-9][a-z0-9_-]*$/, "service name must be lowercase alphanumeric/_-"),
    /** Service role; drives defaults and dashboard grouping. */
    kind: z.enum(SERVICE_KINDS).default("custom"),
    /** Pre-built image reference (mutually exclusive with {@link build}). */
    image: z.string().min(1).optional(),
    /** Build instructions (mutually exclusive with {@link image}). */
    build: buildSpecSchema.optional(),
    /** Optional command override (argv form). */
    command: z.array(z.string()).optional(),
    /** Environment variables injected at runtime. */
    env: z.record(z.string()).default({}),
    /** Port mappings to expose/publish. */
    ports: z.array(portMappingSchema).default([]),
    /** Named volumes to mount as `name:/container/path`. */
    volumes: z
      .array(z.object({ name: z.string().min(1), mountPath: z.string().min(1) }))
      .default([]),
    /** Healthcheck configuration. */
    healthcheck: healthcheckSchema.optional(),
    /** Names of services that must be healthy before this one starts. */
    dependsOn: z.array(z.string().min(1)).default([]),
    /** Docker restart policy. Defaults to `unless-stopped` for long-lived services. */
    restart: z.enum(["no", "always", "on-failure", "unless-stopped"]).default("unless-stopped"),
  })
  .superRefine((plan, ctx) => {
    const hasImage = Boolean(plan.image);
    const hasBuild = Boolean(plan.build);
    if (hasImage === hasBuild) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "exactly one of `image` or `build` must be provided",
        path: ["image"],
      });
    }
  });
export type ServicePlan = z.infer<typeof servicePlanSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Preview plan (desired state of the whole stack)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The full desired state of a preview environment: a named Docker network plus
 * an ordered set of services and the labels used to discover/clean them up.
 */
export const previewPlanSchema = z.object({
  /** Owning preview id (cuid). */
  previewId: z.string().min(1),
  /** URL-safe slug used for routing (`<slug>.preview.domain`). */
  slug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9][a-z0-9-]*$/, "slug must be lowercase alphanumeric/-"),
  /** Name of the per-preview Docker network. */
  networkName: z.string().min(1),
  /** Project id this preview belongs to (for labelling/auditing). */
  projectId: z.string().min(1).optional(),
  /** Services that make up the stack, in declaration order. */
  services: z.array(servicePlanSchema).min(1),
  /** Labels applied to every resource (network + containers + volumes). */
  labels: z.record(z.string()).default({}),
  /** Logical service name whose URL is the preview's primary URL. */
  primaryServiceName: z.string().min(1).optional(),
});
export type PreviewPlan = z.infer<typeof previewPlanSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Runtime facts (observed state)
// ─────────────────────────────────────────────────────────────────────────────

/** Observed runtime facts about a single started service. */
export interface ServiceRuntime {
  /** Logical service name (matches {@link ServicePlan.name}). */
  name: string;
  /** Service kind. */
  kind: ServiceKind;
  /** Docker container id, if a container was created. */
  containerId?: string;
  /** Resolved image reference (pulled or built). */
  image?: string;
  /** Current observed state. */
  status: ServiceState;
  /** In-network host (the container/service name other services dial). */
  host: string;
  /** Published host port mappings as `containerPort -> hostPort`. */
  publishedPorts: Record<number, number>;
  /** Externally reachable URL for this service, when one applies. */
  url?: string;
  /** Most recent error message, if the service failed. */
  error?: string;
}

/** Result of a {@link PreviewOrchestrator.deploy} call. */
export interface DeployResult {
  /** Owning preview id. */
  previewId: string;
  /** Aggregate preview state after the deploy attempt. */
  status: PreviewState;
  /** Per-service runtime facts, in start order. */
  services: ServiceRuntime[];
  /** The Docker network the stack runs on. */
  networkName: string;
  /** Network id, when created/known. */
  networkId?: string;
  /** Primary externally reachable URL for the preview, if any. */
  url?: string;
  /** Wall-clock duration of the deploy, milliseconds. */
  durationMs: number;
}

/** A single resource-usage sample for one service (used for cost rollups). */
export interface ServiceStatsSample {
  /** Logical service name. */
  name: string;
  /** Container id sampled. */
  containerId: string;
  /** Instantaneous CPU usage as a fraction of one core (e.g. `1.5` = 1.5 cores). */
  cpuCores: number;
  /** Resident memory usage in bytes. */
  memoryBytes: number;
  /** Memory limit in bytes (`0` when unlimited). */
  memoryLimitBytes: number;
  /** Cumulative bytes received over the network. */
  rxBytes: number;
  /** Cumulative bytes transmitted over the network. */
  txBytes: number;
  /** Sample timestamp (epoch ms). */
  sampledAt: number;
}

/** A snapshot of preview state returned by {@link PreviewOrchestrator.status}. */
export interface PreviewStatusSnapshot {
  /** Owning preview id. */
  previewId: string;
  /** Aggregate preview state. */
  status: PreviewState;
  /** Per-service runtime facts. */
  services: ServiceRuntime[];
  /** Whether any Shipyard-managed resources for this preview still exist. */
  exists: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Log streaming
// ─────────────────────────────────────────────────────────────────────────────

/** A single demultiplexed line of container output. */
export interface LogLine {
  /** Logical service name the line came from. */
  service: string;
  /** Which stream the line was emitted on. */
  stream: "stdout" | "stderr";
  /** The (newline-stripped) log line. */
  line: string;
  /** Timestamp (epoch ms) the engine observed the line. */
  timestamp: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Lifecycle hooks (observability injection)
// ─────────────────────────────────────────────────────────────────────────────

/** A coarse progress phase emitted during a deploy. */
export type DeployPhase =
  | "planning"
  | "network"
  | "pulling"
  | "building"
  | "creating"
  | "starting"
  | "health"
  | "seeding"
  | "done"
  | "error";

/** A structured progress event. */
export interface ProgressEvent {
  /** The phase this event belongs to. */
  phase: DeployPhase;
  /** Optional service name the event concerns. */
  service?: string;
  /** Human-readable message. */
  message: string;
  /** Optional completion ratio in `[0, 1]`. */
  ratio?: number;
}

/**
 * Lifecycle hooks injected by the caller (e.g. the deploy worker) so that the
 * engine can stream logs, status changes, and progress without depending on any
 * persistence or transport. All hooks are optional and best-effort: a throwing
 * hook is caught and ignored so it cannot abort a deploy.
 */
export interface OrchestratorHooks {
  /** Called for every demultiplexed container log line. */
  onLog?: (line: LogLine) => void;
  /** Called whenever a service transitions state. */
  onServiceStatus?: (service: string, status: ServiceState, runtime: ServiceRuntime) => void;
  /** Called for coarse-grained deploy progress. */
  onProgress?: (event: ProgressEvent) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Orchestrator interface
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The contract every preview orchestrator implements. Two implementations ship:
 * {@link DockerOrchestrator} (real, dockerode-backed) and `MockOrchestrator`
 * (in-memory, for tests/CI without a Docker daemon).
 */
export interface PreviewOrchestrator {
  /**
   * Create and start the stack described by `plan`, in dependency order,
   * waiting for each service to become healthy before starting its dependents.
   *
   * @param plan  Desired preview state.
   * @param hooks Optional lifecycle hooks for logs/status/progress.
   * @returns The observed runtime + primary URL.
   */
  deploy(plan: PreviewPlan, hooks?: OrchestratorHooks): Promise<DeployResult>;

  /**
   * Stop (but do not remove) all containers for a preview. The network and
   * volumes are preserved so the preview can be resumed.
   */
  stop(previewId: string, hooks?: OrchestratorHooks): Promise<void>;

  /**
   * Remove all Shipyard-managed resources for a preview: containers, the
   * network, and named volumes — discovered by label.
   */
  destroy(previewId: string, hooks?: OrchestratorHooks): Promise<void>;

  /** Return the current observed state of a preview. */
  status(previewId: string): Promise<PreviewStatusSnapshot>;

  /** Sample resource usage for every running service of a preview. */
  collectStats(previewId: string): Promise<ServiceStatsSample[]>;
}
