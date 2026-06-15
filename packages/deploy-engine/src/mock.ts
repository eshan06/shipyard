/**
 * {@link MockOrchestrator} — an in-memory {@link PreviewOrchestrator} for
 * environments without a Docker daemon (CI, unit tests, local dashboard demos).
 *
 * It simulates the real lifecycle: services transition through
 * `pending → starting → healthy` in dependency order, fake build/runtime logs
 * are emitted, and per-preview state is held in memory so `status`, `stop`,
 * `destroy`, and `collectStats` behave consistently. No timers block by default
 * (`stepDelayMs` defaults to `0`) so tests run instantly.
 */

import { topologicalOrder } from "./graph.js";
import { emitLog, emitProgress, emitServiceStatus } from "./hooks.js";
import { aggregatePreviewState } from "./orchestrator.js";

import type {
  DeployResult,
  OrchestratorHooks,
  PreviewOrchestrator,
  PreviewPlan,
  PreviewStatusSnapshot,
  ServicePlan,
  ServiceRuntime,
  ServiceStatsSample,
} from "./types.js";

/** Construct-time options for {@link MockOrchestrator}. */
export interface MockOrchestratorOptions {
  /** Artificial delay (ms) between simulated lifecycle steps. Defaults to `0`. */
  stepDelayMs?: number;
  /**
   * Service names that should fail to become healthy (simulate a crash). The
   * deploy resolves with `status: "failed"` and the named services `crashed`.
   */
  failServices?: readonly string[];
  /** Deterministic base for fake published host ports. Defaults to `34000`. */
  basePort?: number;
  /** Injectable clock for deterministic timestamps. Defaults to `Date.now`. */
  now?: () => number;
}

/** Internal per-preview record held in memory. */
interface PreviewRecord {
  plan: PreviewPlan;
  runtimes: Map<string, ServiceRuntime>;
  stopped: boolean;
}

export class MockOrchestrator implements PreviewOrchestrator {
  private readonly stepDelayMs: number;
  private readonly failServices: Set<string>;
  private readonly basePort: number;
  private readonly now: () => number;
  private portCursor: number;
  private readonly previews = new Map<string, PreviewRecord>();

  constructor(options: MockOrchestratorOptions = {}) {
    this.stepDelayMs = options.stepDelayMs ?? 0;
    this.failServices = new Set(options.failServices ?? []);
    this.basePort = options.basePort ?? 34_000;
    this.portCursor = this.basePort;
    this.now = options.now ?? Date.now;
  }

  /** @inheritdoc */
  async deploy(plan: PreviewPlan, hooks?: OrchestratorHooks): Promise<DeployResult> {
    const startedAt = this.now();
    emitProgress(hooks, { phase: "planning", message: `Planning preview ${plan.slug}` });

    const order = topologicalOrder(plan.services);
    emitProgress(hooks, { phase: "network", message: `Ensuring network ${plan.networkName}` });

    const runtimes = new Map<string, ServiceRuntime>();
    for (const service of order) {
      const runtime = await this.simulateService(plan, service, hooks);
      runtimes.set(service.name, runtime);
    }

    this.previews.set(plan.previewId, { plan, runtimes, stopped: false });

    const ordered = order.map((s) => runtimes.get(s.name)!);
    const status = aggregatePreviewState(ordered.map((r) => r.status));
    const url = this.previewUrl(plan, ordered);

    emitProgress(hooks, {
      phase: status === "failed" ? "error" : "done",
      message: `Preview ${plan.slug} is ${status}`,
      ratio: 1,
    });

    return {
      previewId: plan.previewId,
      status,
      services: ordered,
      networkName: plan.networkName,
      networkId: `mock-net-${plan.slug}`,
      url,
      durationMs: Math.max(0, this.now() - startedAt),
    };
  }

  /** Run one service through the simulated `pending → starting → healthy` arc. */
  private async simulateService(
    plan: PreviewPlan,
    service: ServicePlan,
    hooks: OrchestratorHooks | undefined,
  ): Promise<ServiceRuntime> {
    const containerId = `mock-${plan.slug}-${service.name}`;
    const publishedPorts: Record<number, number> = {};
    for (const port of service.ports) {
      publishedPorts[port.container] = this.portCursor++;
    }

    const runtime: ServiceRuntime = {
      name: service.name,
      kind: service.kind,
      containerId,
      image: service.image ?? `shipyard/${plan.slug}-${service.name}:latest`,
      status: "pending",
      host: service.name,
      publishedPorts,
    };
    emitServiceStatus(hooks, service.name, "pending", runtime);

    if (service.build) {
      emitProgress(hooks, { phase: "building", service: service.name, message: `Building ${runtime.image}` });
      this.fakeBuildLogs(service.name, hooks);
    } else {
      emitProgress(hooks, { phase: "pulling", service: service.name, message: `Pulling ${runtime.image}` });
      emitLog(hooks, logLine(service.name, "stdout", `Pulled ${runtime.image}`, this.now()));
    }
    await this.tick();

    emitProgress(hooks, { phase: "creating", service: service.name, message: `Creating ${service.name}` });
    runtime.status = "starting";
    emitServiceStatus(hooks, service.name, "starting", runtime);
    emitProgress(hooks, { phase: "starting", service: service.name, message: `Started ${service.name}` });
    emitLog(hooks, logLine(service.name, "stdout", `${service.name} starting on ${service.kind}`, this.now()));
    await this.tick();

    emitProgress(hooks, { phase: "health", service: service.name, message: `Waiting for ${service.name}` });
    if (this.failServices.has(service.name)) {
      runtime.status = "crashed";
      runtime.error = `simulated failure for ${service.name}`;
      emitLog(hooks, logLine(service.name, "stderr", runtime.error, this.now()));
      emitServiceStatus(hooks, service.name, "crashed", runtime);
      return runtime;
    }

    runtime.status = "healthy";
    runtime.url = this.serviceUrl(service, runtime);
    emitLog(hooks, logLine(service.name, "stdout", `${service.name} is healthy`, this.now()));
    emitServiceStatus(hooks, service.name, "healthy", runtime);
    return runtime;
  }

  /** @inheritdoc */
  async stop(previewId: string, hooks?: OrchestratorHooks): Promise<void> {
    const record = this.previews.get(previewId);
    if (!record) return;
    record.stopped = true;
    for (const runtime of record.runtimes.values()) {
      runtime.status = "stopped";
      emitServiceStatus(hooks, runtime.name, "stopped", runtime);
    }
    emitProgress(hooks, { phase: "done", message: `Stopped preview ${previewId}` });
  }

  /** @inheritdoc */
  async destroy(previewId: string, hooks?: OrchestratorHooks): Promise<void> {
    this.previews.delete(previewId);
    emitProgress(hooks, { phase: "done", message: `Destroyed preview ${previewId}` });
  }

  /** @inheritdoc */
  async status(previewId: string): Promise<PreviewStatusSnapshot> {
    const record = this.previews.get(previewId);
    if (!record) {
      return { previewId, status: "destroyed", services: [], exists: false };
    }
    const services = [...record.runtimes.values()].map((r) => ({ ...r }));
    return {
      previewId,
      status: record.stopped ? "stopped" : aggregatePreviewState(services.map((s) => s.status)),
      services,
      exists: true,
    };
  }

  /** @inheritdoc */
  async collectStats(previewId: string): Promise<ServiceStatsSample[]> {
    const record = this.previews.get(previewId);
    if (!record || record.stopped) return [];
    const sampledAt = this.now();
    const samples: ServiceStatsSample[] = [];
    let i = 0;
    for (const runtime of record.runtimes.values()) {
      if (runtime.status !== "healthy") continue;
      i++;
      samples.push({
        name: runtime.name,
        containerId: runtime.containerId ?? `mock-${runtime.name}`,
        // Deterministic, plausible synthetic metrics.
        cpuCores: 0.05 * i,
        memoryBytes: 64 * 1024 * 1024 * i,
        memoryLimitBytes: 512 * 1024 * 1024,
        rxBytes: 1024 * i,
        txBytes: 2048 * i,
        sampledAt,
      });
    }
    return samples;
  }

  /** Emit a few deterministic fake build log lines. */
  private fakeBuildLogs(service: string, hooks: OrchestratorHooks | undefined): void {
    const steps = [
      "Step 1/3 : FROM node:20-alpine",
      "Step 2/3 : COPY . .",
      "Step 3/3 : CMD [\"node\", \"server.js\"]",
      "Successfully built (mock)",
    ];
    for (const step of steps) {
      emitLog(hooks, logLine(service, "stdout", step, this.now()));
    }
  }

  /** Optionally pause between lifecycle steps (no-op when `stepDelayMs` is 0). */
  private async tick(): Promise<void> {
    if (this.stepDelayMs > 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, this.stepDelayMs));
    }
  }

  /** Render a deterministic local URL for a mock service. */
  private serviceUrl(
    service: ServicePlan,
    runtime: ServiceRuntime,
  ): string | undefined {
    if (service.ports.length === 0) return undefined;
    const port = runtime.publishedPorts[service.ports[0]!.container];
    return port != null ? `http://127.0.0.1:${port}` : undefined;
  }

  /** Render the preview's primary URL from its primary service. */
  private previewUrl(plan: PreviewPlan, runtimes: ServiceRuntime[]): string | undefined {
    const primaryName = plan.primaryServiceName ?? runtimes[0]?.name;
    const primary = runtimes.find((r) => r.name === primaryName) ?? runtimes[0];
    return primary?.url;
  }
}

/** Construct a {@link LogLine}. */
function logLine(
  service: string,
  stream: "stdout" | "stderr",
  line: string,
  timestamp: number,
): {
  service: string;
  stream: "stdout" | "stderr";
  line: string;
  timestamp: number;
} {
  return { service, stream, line, timestamp };
}
