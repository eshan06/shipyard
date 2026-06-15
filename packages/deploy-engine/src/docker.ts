/**
 * {@link DockerDriver} — a thin, typed wrapper over `dockerode` that exposes the
 * exact primitives the orchestrator needs: networks, image pull/build,
 * container create/start, health polling, stats sampling, log streaming, and
 * label-scoped teardown.
 *
 * The driver translates dockerode's loosely-typed surface into the engine's
 * domain types and normalizes daemon-connectivity failures into a typed
 * {@link DaemonUnavailableError}.
 */

import { Buffer } from "node:buffer";
import { request as httpRequest } from "node:http";

import Docker from "dockerode";

import {
  ContainerStartError,
  DaemonUnavailableError,
  DeployEngineError,
  HealthcheckTimeoutError,
  ImageBuildError,
  ImagePullError,
  isDaemonUnavailable,
} from "./errors.js";
import {
  ShipyardLabel,
  type Healthcheck,
  type LogLine,
  type ServicePlan,
  type ServiceStatsSample,
} from "./types.js";

/** A line of build/pull progress streamed back to the caller. */
export interface BuildLogEvent {
  /** Raw progress text (one logical step). */
  message: string;
  /** Present when the daemon reports an error mid-build. */
  error?: string;
}

/** Options for creating a container. */
export interface CreateContainerOptions {
  /** Logical service name; becomes the container name suffix + a label. */
  service: ServicePlan;
  /** The resolved image reference to run. */
  image: string;
  /** Network to attach to. */
  networkName: string;
  /** Network alias other services use to reach this one (the service name). */
  networkAlias: string;
  /** Labels applied to the container (merged with per-service labels). */
  labels: Record<string, string>;
  /** Preview slug, used to derive the container name. */
  slug: string;
}

/** Construct-time options for {@link DockerDriver}. */
export interface DockerDriverOptions {
  /**
   * A pre-constructed dockerode instance. When omitted, a default instance is
   * created from the ambient environment (`DOCKER_HOST` / default socket).
   */
  docker?: Docker;
}

/**
 * Wrap an arbitrary dockerode rejection: if it indicates the daemon is
 * unreachable, rethrow as {@link DaemonUnavailableError}; otherwise rethrow as-is.
 */
function rethrowDaemon(error: unknown): never {
  if (isDaemonUnavailable(error)) throw new DaemonUnavailableError(error);
  throw error;
}

export class DockerDriver {
  private readonly docker: Docker;

  constructor(options: DockerDriverOptions = {}) {
    this.docker = options.docker ?? new Docker();
  }

  /** The underlying dockerode handle (escape hatch for advanced callers). */
  get client(): Docker {
    return this.docker;
  }

  /**
   * Verify the daemon is reachable. Resolves on success; rejects with
   * {@link DaemonUnavailableError} if the ping fails to connect.
   */
  async ping(): Promise<void> {
    try {
      await this.docker.ping();
    } catch (error) {
      rethrowDaemon(error);
    }
  }

  /**
   * Ensure a network with `name` and the given labels exists. Idempotent:
   * returns the existing network's id if one is already present.
   */
  async ensureNetwork(name: string, labels: Record<string, string>): Promise<string> {
    try {
      const existing = await this.docker.listNetworks({ filters: { name: [name] } });
      const exact = existing.find((n) => n.Name === name);
      if (exact?.Id) return exact.Id;
      const network = await this.docker.createNetwork({
        Name: name,
        Driver: "bridge",
        CheckDuplicate: true,
        Labels: labels,
      });
      return network.id;
    } catch (error) {
      rethrowDaemon(error);
    }
  }

  /**
   * Pull an image, invoking `onProgress` for each progress event. Resolves once
   * the pull stream completes; rejects with {@link ImagePullError} on failure.
   */
  async pullImage(
    image: string,
    onProgress?: (event: BuildLogEvent) => void,
    service?: string,
  ): Promise<void> {
    let stream: NodeJS.ReadableStream;
    try {
      stream = (await this.docker.pull(image)) as NodeJS.ReadableStream;
    } catch (error) {
      if (isDaemonUnavailable(error)) throw new DaemonUnavailableError(error);
      throw new ImagePullError(image, error, service);
    }
    await new Promise<void>((resolve, reject) => {
      this.docker.modem.followProgress(
        stream,
        (err: Error | null) => {
          if (err) reject(new ImagePullError(image, err, service));
          else resolve();
        },
        (event: { status?: string; progress?: string; error?: string }) => {
          if (onProgress) {
            const message = [event.status, event.progress].filter(Boolean).join(" ");
            onProgress({ message, ...(event.error ? { error: event.error } : {}) });
          }
        },
      );
    });
  }

  /**
   * Build an image from a context directory + Dockerfile, streaming build log
   * lines to `onLog`. Returns the resolved image tag.
   *
   * @throws {@link ImageBuildError} when the daemon reports a build error.
   */
  async buildImage(
    options: {
      context: string;
      dockerfile: string;
      tag: string;
      args?: Record<string, string>;
      target?: string;
      labels?: Record<string, string>;
    },
    onLog?: (event: BuildLogEvent) => void,
    service?: string,
  ): Promise<string> {
    let stream: NodeJS.ReadableStream;
    try {
      stream = (await this.docker.buildImage(
        { context: options.context, src: ["."] },
        {
          t: options.tag,
          dockerfile: options.dockerfile,
          ...(options.target ? { target: options.target } : {}),
          ...(options.args ? { buildargs: options.args } : {}),
          ...(options.labels ? { labels: options.labels } : {}),
        },
      )) as NodeJS.ReadableStream;
    } catch (error) {
      if (isDaemonUnavailable(error)) throw new DaemonUnavailableError(error);
      throw new ImageBuildError(`Failed to start build for "${options.tag}".`, error, service);
    }

    await new Promise<void>((resolve, reject) => {
      this.docker.modem.followProgress(
        stream,
        (err: Error | null) => {
          if (err) reject(new ImageBuildError(`Build of "${options.tag}" failed.`, err, service));
          else resolve();
        },
        (event: { stream?: string; error?: string; errorDetail?: { message?: string } }) => {
          if (event.error || event.errorDetail?.message) {
            const msg = event.error ?? event.errorDetail?.message ?? "build error";
            if (onLog) onLog({ message: msg, error: msg });
            reject(new ImageBuildError(`Build of "${options.tag}" failed: ${msg}`, event, service));
            return;
          }
          if (onLog && typeof event.stream === "string") {
            const line = event.stream.replace(/\r?\n$/, "");
            if (line.length > 0) onLog({ message: line });
          }
        },
      );
    });
    return options.tag;
  }

  /**
   * Create and start a container for `options.service` on the given network.
   * Returns the container id.
   *
   * @throws {@link ContainerStartError} on create/start failure.
   */
  async createAndStart(options: CreateContainerOptions): Promise<string> {
    const { service, image, networkName, networkAlias, labels } = options;
    const containerName = `shipyard-${options.slug}-${service.name}`;

    // Idempotent on retry: a partially-succeeded deploy (some services created,
    // a later one failed) is re-run from scratch by BullMQ. Without this, the
    // first already-existing container would fail create with HTTP 409
    // ("name already in use") and the retry could never make progress. Remove
    // any leftover container with this deterministic name first (best-effort).
    await this.removeByName(containerName);

    const env = Object.entries(service.env).map(([k, v]) => `${k}=${v}`);
    const { exposed, bindings } = portConfig(service);
    const serviceLabels: Record<string, string> = {
      ...labels,
      [ShipyardLabel.service]: service.name,
      [ShipyardLabel.serviceType]: service.kind,
    };

    try {
      const container = await this.docker.createContainer({
        name: containerName,
        Image: image,
        Labels: serviceLabels,
        Env: env,
        ...(service.command ? { Cmd: service.command } : {}),
        ExposedPorts: exposed,
        ...(service.healthcheck?.command
          ? { Healthcheck: dockerHealthcheck(service.healthcheck) }
          : {}),
        HostConfig: {
          NetworkMode: networkName,
          PortBindings: bindings,
          RestartPolicy: restartPolicy(service.restart),
          Binds: service.volumes.map((v) => `${v.name}:${v.mountPath}`),
        },
        NetworkingConfig: {
          EndpointsConfig: {
            [networkName]: { Aliases: [networkAlias] },
          },
        },
      });
      await container.start();
      return container.id;
    } catch (error) {
      if (isDaemonUnavailable(error)) throw new DaemonUnavailableError(error);
      throw new ContainerStartError(service.name, error);
    }
  }

  /**
   * Poll a container until it is healthy or the budget is exhausted.
   *
   * Strategy, in priority order:
   *  1. If an HTTP `httpPath` is configured, GET it on the published host port
   *     and treat any `< 500` response as healthy.
   *  2. Else if the container declares a Docker HEALTHCHECK, poll its health.
   *  3. Else treat "running" as healthy.
   *
   * @throws {@link HealthcheckTimeoutError} when the budget is exhausted.
   */
  async waitForHealthy(
    containerId: string,
    healthcheck: Healthcheck | undefined,
    publishedPorts: Record<number, number>,
    serviceName: string,
  ): Promise<void> {
    const intervalMs = healthcheck?.intervalMs ?? 3_000;
    const retries = healthcheck?.retries ?? 10;
    const timeoutMs = healthcheck?.timeoutMs ?? 3_000;
    const startPeriodMs = healthcheck?.startPeriodMs ?? 0;
    if (startPeriodMs > 0) await delay(startPeriodMs);

    const container = this.docker.getContainer(containerId);

    for (let attempt = 0; attempt < retries; attempt++) {
      let inspect: Docker.ContainerInspectInfo;
      try {
        inspect = await container.inspect();
      } catch (error) {
        rethrowDaemon(error);
      }

      const state = inspect.State;
      if (state.Status === "exited" || state.Status === "dead") {
        throw new ContainerStartError(serviceName, new Error(`container exited (code ${state.ExitCode})`));
      }

      // HTTP probe takes precedence when configured.
      if (healthcheck?.httpPath) {
        const port = healthcheck.port ?? firstContainerPort(publishedPorts);
        const hostPort = port != null ? publishedPorts[port] : undefined;
        if (hostPort != null && (await httpProbe(hostPort, healthcheck.httpPath, timeoutMs))) {
          return;
        }
      } else if (state.Health) {
        if (state.Health.Status === "healthy") return;
        if (state.Health.Status === "unhealthy") {
          throw new ContainerStartError(serviceName, new Error("container reported unhealthy"));
        }
      } else if (state.Running) {
        // No probe configured and no Docker healthcheck: running is good enough.
        return;
      }

      await delay(intervalMs);
    }
    throw new HealthcheckTimeoutError(serviceName);
  }

  /**
   * Sample a single resource-usage snapshot for a container. CPU is derived
   * from the delta between the two stat reads dockerode returns; memory and net
   * counters are read directly.
   */
  async getStats(containerId: string, serviceName: string): Promise<ServiceStatsSample> {
    let raw: Docker.ContainerStats;
    try {
      raw = (await this.docker
        .getContainer(containerId)
        .stats({ stream: false })) as unknown as Docker.ContainerStats;
    } catch (error) {
      rethrowDaemon(error);
    }
    return parseStats(raw, containerId, serviceName);
  }

  /**
   * Stream demultiplexed log lines for a container as an async iterator of
   * {@link LogLine}. Honours `since` (epoch seconds) and stops when the stream
   * ends (or, for `follow`, when the consumer breaks out of the loop).
   */
  async *streamLogs(
    containerId: string,
    serviceName: string,
    options: { follow?: boolean; since?: number; tail?: number } = {},
  ): AsyncGenerator<LogLine, void, void> {
    const container = this.docker.getContainer(containerId);
    let stream: NodeJS.ReadableStream;
    // dockerode discriminates `logs()`'s return type (Buffer vs ReadableStream)
    // on a *literal* `follow`, so a `boolean` value does not match either
    // overload. We always consume the result as a stream (demuxed below), so the
    // options are typed explicitly and the call is asserted to the stream overload.
    const logOptions: Docker.ContainerLogsOptions & { follow: boolean } = {
      follow: options.follow ?? false,
      stdout: true,
      stderr: true,
      timestamps: false,
      ...(options.since != null ? { since: options.since } : {}),
      ...(options.tail != null ? { tail: options.tail } : {}),
    };
    try {
      stream = (await container.logs(
        logOptions as Docker.ContainerLogsOptions & { follow: true },
      )) as unknown as NodeJS.ReadableStream;
    } catch (error) {
      rethrowDaemon(error);
    }

    // Multiplexed Docker log frames: 8-byte header [stream, 0,0,0, size(4 BE)].
    const queue: LogLine[] = [];
    let buffer = Buffer.alloc(0);
    let ended = false;
    let errored: unknown;
    let notify: (() => void) | undefined;

    const wake = () => {
      notify?.();
      notify = undefined;
    };

    stream.on("data", (chunk: Buffer) => {
      buffer = Buffer.concat([buffer, chunk]);
      while (buffer.length >= 8) {
        const streamType = buffer[0];
        const size = buffer.readUInt32BE(4);
        if (buffer.length < 8 + size) break;
        const payload = buffer.subarray(8, 8 + size).toString("utf8");
        buffer = buffer.subarray(8 + size);
        for (const line of payload.split("\n")) {
          if (line.length === 0) continue;
          queue.push({
            service: serviceName,
            stream: streamType === 2 ? "stderr" : "stdout",
            line,
            timestamp: Date.now(),
          });
        }
      }
      wake();
    });
    stream.on("end", () => {
      ended = true;
      wake();
    });
    stream.on("error", (err) => {
      errored = err;
      ended = true;
      wake();
    });

    while (true) {
      if (queue.length > 0) {
        yield queue.shift()!;
        continue;
      }
      if (ended) {
        if (errored && isDaemonUnavailable(errored)) throw new DaemonUnavailableError(errored);
        if (errored) throw errored;
        return;
      }
      await new Promise<void>((resolve) => {
        notify = resolve;
      });
    }
  }

  /** Stop a container (graceful, with `timeoutSec` before SIGKILL). No-op if absent. */
  async stop(containerId: string, timeoutSec = 10): Promise<void> {
    try {
      await this.docker.getContainer(containerId).stop({ t: timeoutSec });
    } catch (error) {
      if (isDaemonUnavailable(error)) throw new DaemonUnavailableError(error);
      if (!isNotModifiedOrMissing(error)) throw error;
    }
  }

  /** Remove a container (force + volumes). No-op if already gone. */
  async remove(containerId: string): Promise<void> {
    try {
      await this.docker.getContainer(containerId).remove({ force: true, v: true });
    } catch (error) {
      if (isDaemonUnavailable(error)) throw new DaemonUnavailableError(error);
      if (!isNotModifiedOrMissing(error)) throw error;
    }
  }

  /**
   * Force-remove a container by its exact name, if one exists. Used to make
   * {@link createAndStart} idempotent across retries (deterministic names would
   * otherwise collide with HTTP 409). No-op when no such container exists.
   */
  async removeByName(name: string): Promise<void> {
    let existing: Docker.ContainerInfo[];
    try {
      existing = await this.docker.listContainers({
        all: true,
        // Docker matches the `name` filter as a substring/regex; the exact-name
        // check below makes this precise.
        filters: { name: [name] },
      });
    } catch (error) {
      rethrowDaemon(error);
    }
    for (const info of existing) {
      // dockerode prefixes container names with "/"; match either form.
      if (info.Names?.some((n) => n === name || n === `/${name}`)) {
        await this.remove(info.Id);
      }
    }
  }

  /** List Shipyard containers for a preview (running or stopped). */
  async listContainers(previewId: string): Promise<Docker.ContainerInfo[]> {
    try {
      return await this.docker.listContainers({
        all: true,
        filters: { label: [`${ShipyardLabel.previewId}=${previewId}`] },
      });
    } catch (error) {
      rethrowDaemon(error);
    }
  }

  /**
   * Tear down every Shipyard-managed resource for a preview: containers (force
   * + volumes), then the per-preview network, then any leftover labelled
   * volumes. Best-effort and idempotent.
   */
  async pruneByLabel(previewId: string): Promise<void> {
    const selector = `${ShipyardLabel.previewId}=${previewId}`;
    try {
      const containers = await this.docker.listContainers({
        all: true,
        filters: { label: [selector] },
      });
      for (const info of containers) {
        await this.remove(info.Id);
      }

      const networks = await this.docker.listNetworks({ filters: { label: [selector] } });
      for (const net of networks) {
        try {
          await this.docker.getNetwork(net.Id).remove();
        } catch (error) {
          if (!isNotModifiedOrMissing(error)) throw error;
        }
      }

      const volumes = await this.docker.listVolumes({ filters: { label: [selector] } });
      for (const vol of volumes.Volumes ?? []) {
        try {
          await this.docker.getVolume(vol.Name).remove({ force: true });
        } catch (error) {
          if (!isNotModifiedOrMissing(error)) throw error;
        }
      }
    } catch (error) {
      if (error instanceof DeployEngineError) throw error;
      rethrowDaemon(error);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Pure helpers (exported for unit testing)
// ─────────────────────────────────────────────────────────────────────────────

/** Build dockerode `ExposedPorts` + `PortBindings` from a service plan. */
export function portConfig(service: ServicePlan): {
  exposed: Record<string, Record<string, never>>;
  bindings: Record<string, Array<{ HostPort: string }>>;
} {
  const exposed: Record<string, Record<string, never>> = {};
  const bindings: Record<string, Array<{ HostPort: string }>> = {};
  for (const port of service.ports) {
    const key = `${port.container}/${port.protocol}`;
    exposed[key] = {};
    // Empty HostPort lets the daemon assign an ephemeral published port.
    bindings[key] = [{ HostPort: port.host != null ? String(port.host) : "" }];
  }
  return { exposed, bindings };
}

/** Map the engine restart enum onto a dockerode RestartPolicy. */
export function restartPolicy(restart: ServicePlan["restart"]): Docker.HostConfig["RestartPolicy"] {
  switch (restart) {
    case "always":
      return { Name: "always" };
    case "on-failure":
      return { Name: "on-failure", MaximumRetryCount: 3 };
    case "unless-stopped":
      return { Name: "unless-stopped" };
    case "no":
    default:
      return { Name: "no" };
  }
}

/** Translate the engine healthcheck into a dockerode container Healthcheck. */
export function dockerHealthcheck(hc: Healthcheck): Docker.HealthConfig {
  return {
    Test: hc.command ? ["CMD-SHELL", hc.command] : ["NONE"],
    Interval: hc.intervalMs * 1_000_000, // ns
    Timeout: hc.timeoutMs * 1_000_000,
    Retries: hc.retries,
    StartPeriod: hc.startPeriodMs * 1_000_000,
  };
}

/**
 * Parse a dockerode stats blob into a {@link ServiceStatsSample}. CPU usage is
 * the standard `(cpuDelta / systemDelta) * onlineCPUs` formula; on the first
 * read (no precpu baseline) it reports `0`.
 */
export function parseStats(
  raw: Docker.ContainerStats,
  containerId: string,
  serviceName: string,
): ServiceStatsSample {
  const cpu = raw.cpu_stats;
  const precpu = raw.precpu_stats;
  const cpuDelta = (cpu?.cpu_usage?.total_usage ?? 0) - (precpu?.cpu_usage?.total_usage ?? 0);
  const systemDelta = (cpu?.system_cpu_usage ?? 0) - (precpu?.system_cpu_usage ?? 0);
  const onlineCpus =
    cpu?.online_cpus ?? cpu?.cpu_usage?.percpu_usage?.length ?? 1;
  const cpuCores =
    systemDelta > 0 && cpuDelta > 0 ? (cpuDelta / systemDelta) * onlineCpus : 0;

  const memory = raw.memory_stats;
  const cache = memory?.stats?.cache ?? 0;
  const memoryBytes = Math.max(0, (memory?.usage ?? 0) - cache);
  const memoryLimitBytes = memory?.limit ?? 0;

  let rxBytes = 0;
  let txBytes = 0;
  for (const iface of Object.values(raw.networks ?? {})) {
    rxBytes += iface.rx_bytes ?? 0;
    txBytes += iface.tx_bytes ?? 0;
  }

  return {
    name: serviceName,
    containerId,
    cpuCores: Number.isFinite(cpuCores) ? cpuCores : 0,
    memoryBytes,
    memoryLimitBytes,
    rxBytes,
    txBytes,
    sampledAt: Date.now(),
  };
}

/** Return the lowest container port that has a published host port. */
function firstContainerPort(published: Record<number, number>): number | undefined {
  const keys = Object.keys(published)
    .map((k) => Number.parseInt(k, 10))
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b);
  return keys[0];
}

/** Perform a single HTTP GET probe against `127.0.0.1:port`. Resolves true if `< 500`. */
function httpProbe(port: number, path: string, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const req = httpRequest(
      { host: "127.0.0.1", port, path, method: "GET", timeout: timeoutMs },
      (res) => {
        res.resume(); // drain
        resolve((res.statusCode ?? 500) < 500);
      },
    );
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
    req.on("error", () => resolve(false));
    req.end();
  });
}

/** True for dockerode 304 ("not modified") and 404 ("no such") responses. */
function isNotModifiedOrMissing(error: unknown): boolean {
  const status = (error as { statusCode?: number }).statusCode;
  return status === 304 || status === 404;
}

/** Promise-based sleep. */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
