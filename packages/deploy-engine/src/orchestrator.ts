/**
 * {@link DockerOrchestrator} — the real, dockerode-backed implementation of
 * {@link PreviewOrchestrator}.
 *
 * Given a {@link PreviewPlan} it: ensures the network exists, resolves each
 * service's image (pull or build), creates+starts containers in dependency
 * order, waits for each to become healthy before starting its dependents, and
 * reports per-service runtime facts plus a primary URL. Teardown and status are
 * driven entirely off the deterministic Shipyard labels stamped by the planner,
 * so they work even across process restarts.
 */

import { DockerDriver, type BuildLogEvent, type RegistryAuth } from "./docker.js";
import { ContainerStartError, DaemonUnavailableError } from "./errors.js";
import { topologicalOrder } from "./graph.js";
import { emitLog, emitProgress, emitServiceStatus } from "./hooks.js";
import {
  ShipyardLabel,
  type DeployResult,
  type OrchestratorHooks,
  type PreviewPlan,
  type PreviewState,
  type PreviewStatusSnapshot,
  type PreviewOrchestrator,
  type ServicePlan,
  type ServiceRuntime,
  type ServiceState,
  type ServiceStatsSample,
} from "./types.js";

import type { DeployEngineError } from "./errors.js";

/** Construct-time options for {@link DockerOrchestrator}. */
export interface DockerOrchestratorOptions {
  /** Inject a pre-configured driver (mainly for testing). */
  driver?: DockerDriver;
  /**
   * Public hostname used to render service URLs (`<slug>.<baseDomain>`). When
   * omitted, URLs fall back to `http://127.0.0.1:<hostPort>`.
   */
  baseDomain?: string;
  /**
   * Name of the shared edge/proxy Docker network. When set, the preview's
   * ingress service is attached to it and stamped with reverse-proxy routing
   * labels so `<slug>.<baseDomain>` resolves to it. See `infra/docker/preview-proxy.yml`.
   */
  edgeNetworkName?: string;
  /** Registry credentials for private image pulls/builds (forwarded to the driver). */
  registryAuth?: RegistryAuth[];
}

/** Map a dockerode container state string onto a {@link ServiceState}. */
function mapContainerState(status: string | undefined, health?: string): ServiceState {
  if (health === "healthy") return "healthy";
  if (health === "unhealthy") return "unhealthy";
  switch (status) {
    case "created":
      return "pending";
    case "running":
      return health === "starting" ? "starting" : "healthy";
    case "restarting":
      return "starting";
    case "paused":
      return "stopped";
    case "exited":
    case "dead":
      return "crashed";
    case "removing":
      return "stopped";
    default:
      return "pending";
  }
}

/** Aggregate per-service states into a single {@link PreviewState}. */
export function aggregatePreviewState(states: ServiceState[]): PreviewState {
  if (states.length === 0) return "stopped";
  if (states.some((s) => s === "crashed")) return "failed";
  if (states.every((s) => s === "stopped")) return "stopped";
  if (states.some((s) => s === "unhealthy")) return "degraded";
  if (states.every((s) => s === "healthy")) return "running";
  if (states.some((s) => s === "starting" || s === "pending")) return "deploying";
  return "degraded";
}

export class DockerOrchestrator implements PreviewOrchestrator {
  private readonly driver: DockerDriver;
  private readonly baseDomain?: string;
  private readonly edgeNetworkName?: string;

  constructor(options: DockerOrchestratorOptions = {}) {
    this.driver =
      options.driver ?? new DockerDriver({ registryAuth: options.registryAuth });
    this.baseDomain = options.baseDomain;
    this.edgeNetworkName = options.edgeNetworkName;
  }

  /** @inheritdoc */
  async deploy(plan: PreviewPlan, hooks?: OrchestratorHooks): Promise<DeployResult> {
    const startedAt = Date.now();
    emitProgress(hooks, { phase: "planning", message: `Planning preview ${plan.slug}` });

    // Fail fast & clearly if the daemon is unreachable.
    await this.driver.ping().catch((error) => {
      if (error instanceof DaemonUnavailableError) {
        emitProgress(hooks, { phase: "error", message: error.message });
      }
      throw error;
    });

    const order = topologicalOrder(plan.services);

    emitProgress(hooks, { phase: "network", message: `Ensuring network ${plan.networkName}` });
    const networkId = await this.driver.ensureNetwork(plan.networkName, plan.labels);

    const runtimes = new Map<string, ServiceRuntime>();
    // Bounds every follow-mode log stream started during this deploy: aborted in
    // the finally below so healthy previews don't leak an open daemon stream per
    // service (and the worker stops ingesting runtime logs once the deploy ends).
    const logAbort = new AbortController();

    try {
      for (const service of order) {
        const runtime = await this.deployService(plan, service, hooks, logAbort.signal);
        runtimes.set(service.name, runtime);
      }
    } catch (error) {
      // Surface a failed result with whatever runtimes we managed to gather.
      const services = order.map((s) => runtimes.get(s.name) ?? failedRuntime(s, error));
      emitProgress(hooks, {
        phase: "error",
        message: error instanceof Error ? error.message : String(error),
      });
      const result: DeployResult = {
        previewId: plan.previewId,
        status: "failed",
        services,
        networkName: plan.networkName,
        networkId,
        durationMs: Date.now() - startedAt,
      };
      // Re-throw the typed error but attach the partial result for callers that
      // want it (worker persists partial state then re-throws to retry).
      (error as DeployEngineError & { partialResult?: DeployResult }).partialResult = result;
      throw error;
    } finally {
      logAbort.abort();
    }

    const ordered = order.map((s) => runtimes.get(s.name)!);
    const status = aggregatePreviewState(ordered.map((r) => r.status));
    const url = this.previewUrl(plan, ordered);

    emitProgress(hooks, { phase: "done", message: `Preview ${plan.slug} is ${status}`, ratio: 1 });

    return {
      previewId: plan.previewId,
      status,
      services: ordered,
      networkName: plan.networkName,
      networkId,
      url,
      durationMs: Date.now() - startedAt,
    };
  }

  /** Resolve image, create+start, and wait-for-health for a single service. */
  private async deployService(
    plan: PreviewPlan,
    service: ServicePlan,
    hooks: OrchestratorHooks | undefined,
    logSignal: AbortSignal,
  ): Promise<ServiceRuntime> {
    const runtime: ServiceRuntime = {
      name: service.name,
      kind: service.kind,
      status: "pending",
      host: service.name,
      publishedPorts: {},
    };
    emitServiceStatus(hooks, service.name, "pending", runtime);

    const image = await this.resolveImage(plan, service, hooks);
    runtime.image = image;

    // Wire the ingress service to the shared edge/proxy network + routing labels.
    const isIngress = service.ingress && this.edgeNetworkName != null && this.baseDomain != null;
    const containerLabels = isIngress
      ? { ...plan.labels, ...this.proxyLabels(plan, service) }
      : plan.labels;
    const extraNetworks = isIngress
      ? [{ name: this.edgeNetworkName!, aliases: [`${plan.slug}`] }]
      : undefined;

    emitProgress(hooks, { phase: "creating", service: service.name, message: `Creating ${service.name}` });
    const containerId = await this.driver.createAndStart({
      service,
      image,
      networkName: plan.networkName,
      networkAlias: service.name,
      labels: containerLabels,
      slug: plan.slug,
      ...(extraNetworks ? { extraNetworks } : {}),
    });
    runtime.containerId = containerId;
    runtime.status = "starting";
    emitServiceStatus(hooks, service.name, "starting", runtime);
    emitProgress(hooks, { phase: "starting", service: service.name, message: `Started ${service.name}` });

    // Discover the daemon-assigned published ports.
    runtime.publishedPorts = await this.resolvePublishedPorts(containerId);

    // Begin streaming logs; bounded by the deploy-scoped abort signal so the
    // stream is torn down when the deploy resolves (not held for the container's
    // multi-day lifetime).
    if (hooks?.onLog) {
      void this.pumpLogs(containerId, service.name, hooks, logSignal);
    }

    emitProgress(hooks, { phase: "health", service: service.name, message: `Waiting for ${service.name}` });
    try {
      await this.driver.waitForHealthy(
        containerId,
        service.healthcheck,
        runtime.publishedPorts,
        service.name,
      );
      runtime.status = "healthy";
    } catch (error) {
      runtime.status = error instanceof ContainerStartError ? "crashed" : "unhealthy";
      runtime.error = error instanceof Error ? error.message : String(error);
      emitServiceStatus(hooks, service.name, runtime.status, runtime);
      throw error;
    }

    runtime.url = this.serviceUrl(plan, service, runtime);
    emitServiceStatus(hooks, service.name, "healthy", runtime);
    return runtime;
  }

  /** Pull or build the image for a service, returning the resolved reference. */
  private async resolveImage(
    plan: PreviewPlan,
    service: ServicePlan,
    hooks: OrchestratorHooks | undefined,
  ): Promise<string> {
    const onBuildLog = (event: BuildLogEvent): void => {
      emitLog(hooks, {
        service: service.name,
        stream: event.error ? "stderr" : "stdout",
        line: event.error ?? event.message,
        timestamp: Date.now(),
      });
    };

    if (service.image) {
      emitProgress(hooks, { phase: "pulling", service: service.name, message: `Pulling ${service.image}` });
      await this.driver.pullImage(service.image, onBuildLog, service.name);
      return service.image;
    }

    const build = service.build!;
    const tag = build.tag ?? `shipyard/${plan.slug}-${service.name}:latest`;
    emitProgress(hooks, { phase: "building", service: service.name, message: `Building ${tag}` });
    return this.driver.buildImage(
      {
        context: build.context,
        dockerfile: build.dockerfile,
        tag,
        args: build.args,
        ...(build.target ? { target: build.target } : {}),
        labels: { ...plan.labels, [ShipyardLabel.service]: service.name },
      },
      onBuildLog,
      service.name,
    );
  }

  /** Inspect the container to learn its daemon-assigned published host ports. */
  private async resolvePublishedPorts(containerId: string): Promise<Record<number, number>> {
    const info = await this.driver.client.getContainer(containerId).inspect();
    const out: Record<number, number> = {};
    const ports = info.NetworkSettings?.Ports ?? {};
    for (const [key, bindings] of Object.entries(ports)) {
      const containerPort = Number.parseInt(key.split("/")[0] ?? "", 10);
      const hostPort = bindings?.[0]?.HostPort;
      if (Number.isFinite(containerPort) && hostPort) {
        out[containerPort] = Number.parseInt(hostPort, 10);
      }
    }
    return out;
  }

  /** Drain a container's log stream into the `onLog` hook until the deploy ends. */
  private async pumpLogs(
    containerId: string,
    serviceName: string,
    hooks: OrchestratorHooks,
    signal: AbortSignal,
  ): Promise<void> {
    try {
      for await (const line of this.driver.streamLogs(containerId, serviceName, {
        follow: true,
        signal,
      })) {
        emitLog(hooks, line);
      }
    } catch {
      // Log streaming is best-effort; never let it crash the deploy.
    }
  }

  /**
   * Reverse-proxy (Traefik) routing labels for the ingress service, so the
   * shared edge proxy routes `<slug>.<baseDomain>` to it over the edge network.
   */
  private proxyLabels(plan: PreviewPlan, service: ServicePlan): Record<string, string> {
    const router = `sy-${plan.slug}`;
    const port = service.ports[0]?.container ?? 80;
    const host = `${plan.slug}.${this.baseDomain}`;
    return {
      "traefik.enable": "true",
      "traefik.docker.network": this.edgeNetworkName!,
      [`traefik.http.routers.${router}.rule`]: `Host(\`${host}\`)`,
      [`traefik.http.routers.${router}.entrypoints`]: "web",
      [`traefik.http.services.${router}.loadbalancer.server.port`]: String(port),
    };
  }

  /** @inheritdoc */
  async stop(previewId: string, hooks?: OrchestratorHooks): Promise<void> {
    emitProgress(hooks, { phase: "done", message: `Stopping preview ${previewId}` });
    const containers = await this.driver.listContainers(previewId);
    for (const info of containers) {
      await this.driver.stop(info.Id);
      const name = info.Labels?.[ShipyardLabel.service] ?? info.Id;
      emitServiceStatus(hooks, name, "stopped", {
        name,
        kind: "custom",
        containerId: info.Id,
        status: "stopped",
        host: name,
        publishedPorts: {},
      });
    }
  }

  /** @inheritdoc */
  async destroy(previewId: string, hooks?: OrchestratorHooks): Promise<void> {
    emitProgress(hooks, { phase: "done", message: `Destroying preview ${previewId}` });
    await this.driver.pruneByLabel(previewId);
  }

  /** @inheritdoc */
  async status(previewId: string): Promise<PreviewStatusSnapshot> {
    const containers = await this.driver.listContainers(previewId);
    if (containers.length === 0) {
      return { previewId, status: "destroyed", services: [], exists: false };
    }
    const services: ServiceRuntime[] = [];
    for (const info of containers) {
      const name = info.Labels?.[ShipyardLabel.service] ?? info.Names?.[0] ?? info.Id;
      const kind = (info.Labels?.[ShipyardLabel.serviceType] as ServiceRuntime["kind"]) ?? "custom";
      const publishedPorts: Record<number, number> = {};
      for (const p of info.Ports ?? []) {
        if (p.PublicPort != null) publishedPorts[p.PrivatePort] = p.PublicPort;
      }
      services.push({
        name,
        kind,
        containerId: info.Id,
        image: info.Image,
        status: mapContainerState(info.State),
        host: name,
        publishedPorts,
      });
    }
    return {
      previewId,
      status: aggregatePreviewState(services.map((s) => s.status)),
      services,
      exists: true,
    };
  }

  /** @inheritdoc */
  async collectStats(previewId: string): Promise<ServiceStatsSample[]> {
    const containers = await this.driver.listContainers(previewId);
    const samples: ServiceStatsSample[] = [];
    for (const info of containers) {
      if (info.State !== "running") continue;
      const name = info.Labels?.[ShipyardLabel.service] ?? info.Id;
      samples.push(await this.driver.getStats(info.Id, name));
    }
    return samples;
  }

  // ── URL rendering ──────────────────────────────────────────────────────────

  /** Render the externally reachable URL for a single service, if any. */
  private serviceUrl(
    plan: PreviewPlan,
    service: ServicePlan,
    runtime: ServiceRuntime,
  ): string | undefined {
    if (service.ports.length === 0) return undefined;
    if (this.baseDomain) {
      const sub = service.name === plan.primaryServiceName ? plan.slug : `${service.name}.${plan.slug}`;
      return `https://${sub}.${this.baseDomain}`;
    }
    const firstPort = service.ports[0]!.container;
    const hostPort = runtime.publishedPorts[firstPort];
    return hostPort != null ? `http://127.0.0.1:${hostPort}` : undefined;
  }

  /** Render the preview's primary URL (from its primary service). */
  private previewUrl(plan: PreviewPlan, runtimes: ServiceRuntime[]): string | undefined {
    const primaryName = plan.primaryServiceName ?? runtimes[0]?.name;
    const primary = runtimes.find((r) => r.name === primaryName) ?? runtimes[0];
    return primary?.url;
  }
}

/** Build a placeholder failed runtime for a service we never finished starting. */
function failedRuntime(service: ServicePlan, error: unknown): ServiceRuntime {
  return {
    name: service.name,
    kind: service.kind,
    status: "crashed",
    host: service.name,
    publishedPorts: {},
    error: error instanceof Error ? error.message : String(error),
  };
}
