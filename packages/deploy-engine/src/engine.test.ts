import { describe, expect, it } from "vitest";

import Docker from "dockerode";

import {
  ComposePlanner,
  DependencyCycleError,
  InvalidPlanError,
  MockOrchestrator,
  aggregatePreviewState,
  buildLabels,
  inferKind,
  networkNameFor,
  normalizeDependsOn,
  normalizeEnv,
  normalizeHealthcheck,
  normalizePorts,
  normalizeRestart,
  parseDuration,
  parsePortString,
  parseStats,
  portConfig,
  restartPolicy,
  topologicalOrder,
  type PreviewPlan,
  type ServicePlan,
  type ServiceState,
} from "./index.js";

/**
 * Unit tests for the deploy engine's pure, deterministic logic: the dependency
 * graph, compose normalization helpers, the {@link ComposePlanner}, Docker
 * option mapping, stats parsing, preview-state aggregation, and the in-memory
 * {@link MockOrchestrator} lifecycle. None of these require a Docker daemon.
 */

/** Build a minimal valid {@link ServicePlan} for graph/aggregation tests. */
function svc(name: string, dependsOn: string[] = []): ServicePlan {
  return {
    name,
    kind: "custom",
    image: `${name}:latest`,
    env: {},
    ports: [],
    volumes: [],
    dependsOn,
    restart: "unless-stopped",
  };
}

describe("topologicalOrder", () => {
  it("orders dependencies before dependents", () => {
    const services = [svc("web", ["api"]), svc("api", ["db"]), svc("db")];
    const order = topologicalOrder(services).map((s) => s.name);
    expect(order.indexOf("db")).toBeLessThan(order.indexOf("api"));
    expect(order.indexOf("api")).toBeLessThan(order.indexOf("web"));
  });

  it("preserves declaration order among independent services", () => {
    const services = [svc("a"), svc("b"), svc("c")];
    expect(topologicalOrder(services).map((s) => s.name)).toEqual(["a", "b", "c"]);
  });

  it("ignores references to unknown services (lenient like compose)", () => {
    const services = [svc("api", ["does-not-exist"]), svc("db")];
    expect(() => topologicalOrder(services)).not.toThrow();
    expect(topologicalOrder(services)).toHaveLength(2);
  });

  it("throws DependencyCycleError on a cycle and names the cycle", () => {
    const services = [svc("a", ["b"]), svc("b", ["a"])];
    expect(() => topologicalOrder(services)).toThrow(DependencyCycleError);
    try {
      topologicalOrder(services);
    } catch (error) {
      expect(error).toBeInstanceOf(DependencyCycleError);
      expect((error as DependencyCycleError).code).toBe("DEPENDENCY_CYCLE");
      expect((error as Error).message).toContain("a");
      expect((error as Error).message).toContain("b");
    }
  });
});

describe("parsePortString", () => {
  it("parses a bare container port", () => {
    expect(parsePortString("8080")).toEqual({ container: 8080, protocol: "tcp" });
  });

  it("parses host:container", () => {
    expect(parsePortString("3000:3000")).toEqual({
      container: 3000,
      host: 3000,
      protocol: "tcp",
    });
  });

  it("parses ip:host:container, keeping host+container", () => {
    expect(parsePortString("127.0.0.1:8080:80")).toEqual({
      container: 80,
      host: 8080,
      protocol: "tcp",
    });
  });

  it("parses a udp protocol suffix", () => {
    expect(parsePortString("53:53/udp")).toEqual({
      container: 53,
      host: 53,
      protocol: "udp",
    });
  });

  it("returns undefined for unparseable input", () => {
    expect(parsePortString("not-a-port")).toBeUndefined();
    expect(parsePortString("")).toBeUndefined();
  });
});

describe("normalizeEnv", () => {
  it("passes through a key/value map, coercing non-strings", () => {
    expect(normalizeEnv({ A: "1", B: 2, C: true, D: null })).toEqual({
      A: "1",
      B: "2",
      C: "true",
      D: "",
    });
  });

  it("splits KEY=VALUE array entries (value may contain '=')", () => {
    expect(normalizeEnv(["A=1", "B=x=y", "BARE"])).toEqual({
      A: "1",
      B: "x=y",
      BARE: "",
    });
  });

  it("returns {} for undefined", () => {
    expect(normalizeEnv(undefined)).toEqual({});
  });
});

describe("normalizePorts / normalizeDependsOn / normalizeRestart", () => {
  it("merges ports and expose, de-duplicating exposed container ports", () => {
    const ports = normalizePorts(["3000:3000"], [3000, 9229]);
    expect(ports).toContainEqual({ container: 3000, host: 3000, protocol: "tcp" });
    expect(ports).toContainEqual({ container: 9229, protocol: "tcp" });
    // 3000 already present from `ports`, so expose must not duplicate it.
    expect(ports.filter((p) => p.container === 3000)).toHaveLength(1);
  });

  it("normalizes depends_on array and map forms", () => {
    expect(normalizeDependsOn(["db", "cache"])).toEqual(["db", "cache"]);
    expect(normalizeDependsOn({ db: { condition: "service_healthy" } })).toEqual(["db"]);
    expect(normalizeDependsOn(undefined)).toEqual([]);
  });

  it("maps restart policies and defaults unknowns to unless-stopped", () => {
    expect(normalizeRestart("always")).toBe("always");
    expect(normalizeRestart("on-failure")).toBe("on-failure");
    expect(normalizeRestart("no")).toBe("no");
    expect(normalizeRestart(undefined)).toBe("unless-stopped");
    expect(normalizeRestart("weird-value")).toBe("unless-stopped");
  });
});

describe("parseDuration (Go-style compose durations)", () => {
  it("parses single and compound units to milliseconds", () => {
    expect(parseDuration("5s")).toBe(5000);
    expect(parseDuration("500ms")).toBe(500);
    expect(parseDuration("1m30s")).toBe(90_000);
    expect(parseDuration("2h")).toBe(7_200_000);
  });

  it("returns undefined for empty/unparseable values", () => {
    expect(parseDuration(undefined)).toBeUndefined();
    expect(parseDuration("")).toBeUndefined();
    expect(parseDuration("abc")).toBeUndefined();
  });
});

describe("normalizeHealthcheck", () => {
  it("maps CMD-SHELL test and durations", () => {
    const hc = normalizeHealthcheck({
      test: ["CMD-SHELL", "curl -f http://localhost/health"],
      interval: "10s",
      timeout: "2s",
      retries: 5,
      start_period: "30s",
    });
    expect(hc).toEqual({
      command: "curl -f http://localhost/health",
      intervalMs: 10_000,
      timeoutMs: 2_000,
      retries: 5,
      startPeriodMs: 30_000,
    });
  });

  it("returns undefined for NONE or missing tests", () => {
    expect(normalizeHealthcheck({ test: ["NONE"] })).toBeUndefined();
    expect(normalizeHealthcheck({})).toBeUndefined();
    expect(normalizeHealthcheck(undefined)).toBeUndefined();
  });
});

describe("inferKind", () => {
  it("classifies services from name + image heuristics", () => {
    expect(inferKind("postgres", "postgres:16")).toBe("database");
    expect(inferKind("cache", "redis:7")).toBe("cache");
    // `web`/`api` are matched as whole, separator-bounded tokens, or via
    // framework/role keywords in the name or image.
    expect(inferKind("web-frontend", "node:20")).toBe("web");
    expect(inferKind("storefront", "nextjs")).toBe("web");
    expect(inferKind("api-server", "node:20")).toBe("api");
    expect(inferKind("backend", "node:20")).toBe("api");
    expect(inferKind("worker", "node:20")).toBe("worker");
    expect(inferKind("something", "alpine")).toBe("custom");
  });
});

describe("buildLabels / networkNameFor", () => {
  it("derives a deterministic network name from the slug", () => {
    expect(networkNameFor("storefront-pr-412")).toBe("shipyard-storefront-pr-412");
  });

  it("stamps the canonical Shipyard labels", () => {
    const labels = buildLabels({ previewId: "prev_1", slug: "demo", projectId: "proj_1" });
    expect(labels["shipyard.managed"]).toBe("true");
    expect(labels["shipyard.previewId"]).toBe("prev_1");
    expect(labels["shipyard.slug"]).toBe("demo");
    expect(labels["shipyard.projectId"]).toBe("proj_1");
    expect(typeof labels["shipyard.createdAt"]).toBe("string");
  });
});

describe("ComposePlanner", () => {
  const planner = new ComposePlanner();

  it("synthesizes a default web+api+postgres+redis stack", () => {
    const plan = planner.plan({ previewId: "prev_1", slug: "demo", framework: "next" });
    const names = plan.services.map((s) => s.name).sort();
    expect(names).toEqual(["api", "postgres", "redis", "web"]);
    expect(plan.networkName).toBe("shipyard-demo");
    expect(plan.primaryServiceName).toBe("web");

    // api depends on db + cache; web depends on api.
    const api = plan.services.find((s) => s.name === "api")!;
    expect(api.dependsOn).toEqual(expect.arrayContaining(["postgres", "redis"]));
    const web = plan.services.find((s) => s.name === "web")!;
    expect(web.dependsOn).toContain("api");

    // The synthesized plan must be a valid topological graph.
    expect(() => topologicalOrder(plan.services)).not.toThrow();
  });

  it("can omit the database and cache services", () => {
    const plan = planner.plan({
      previewId: "p",
      slug: "lean",
      config: { withDatabase: false, withCache: false },
    });
    expect(plan.services.map((s) => s.name).sort()).toEqual(["api", "web"]);
  });

  it("merges caller env over compose-declared env (caller wins)", () => {
    const composeFile = [
      "services:",
      "  api:",
      "    image: node:20-alpine",
      "    environment:",
      "      NODE_ENV: development",
      "      KEEP: yes",
      "    ports:",
      '      - "4000:4000"',
    ].join("\n");

    const plan = planner.plan({
      previewId: "p",
      slug: "demo",
      config: { composeFile },
      env: { NODE_ENV: "production", EXTRA: "1" },
    });
    const api = plan.services.find((s) => s.name === "api")!;
    expect(api.env.NODE_ENV).toBe("production"); // caller override wins
    expect(api.env.KEEP).toBe("yes"); // compose value preserved
    expect(api.env.EXTRA).toBe("1"); // caller addition present
    expect(api.ports).toContainEqual({ container: 4000, host: 4000, protocol: "tcp" });
  });

  it("throws InvalidPlanError for an empty compose document", () => {
    expect(() => planner.plan({ previewId: "p", slug: "demo", config: { composeFile: "{}" } })).toThrow(
      InvalidPlanError,
    );
  });

  it("throws InvalidPlanError for malformed YAML", () => {
    expect(() =>
      planner.plan({ previewId: "p", slug: "demo", config: { composeFile: "services: [unclosed" } }),
    ).toThrow(InvalidPlanError);
  });
});

describe("portConfig / restartPolicy", () => {
  it("builds dockerode ExposedPorts + PortBindings, ephemeral when host omitted", () => {
    const service = svc("api");
    service.ports = [
      { container: 3001, host: 8080, protocol: "tcp" },
      { container: 9229, protocol: "tcp" },
    ];
    const { exposed, bindings } = portConfig(service);
    expect(exposed).toHaveProperty("3001/tcp");
    expect(bindings["3001/tcp"]).toEqual([{ HostPort: "8080" }]);
    // No explicit host port → empty string lets the daemon assign one.
    expect(bindings["9229/tcp"]).toEqual([{ HostPort: "" }]);
  });

  it("maps the restart enum onto dockerode RestartPolicy", () => {
    expect(restartPolicy("always")).toEqual({ Name: "always" });
    expect(restartPolicy("on-failure")).toEqual({ Name: "on-failure", MaximumRetryCount: 3 });
    expect(restartPolicy("unless-stopped")).toEqual({ Name: "unless-stopped" });
    expect(restartPolicy("no")).toEqual({ Name: "no" });
  });
});

describe("parseStats", () => {
  it("derives CPU cores from the delta and subtracts cache from memory", () => {
    const raw = {
      cpu_stats: {
        cpu_usage: { total_usage: 2_000 },
        system_cpu_usage: 10_000,
        online_cpus: 2,
      },
      precpu_stats: {
        cpu_usage: { total_usage: 1_000 },
        system_cpu_usage: 8_000,
      },
      memory_stats: { usage: 200, limit: 1_000, stats: { cache: 50 } },
      networks: { eth0: { rx_bytes: 111, tx_bytes: 222 } },
    } as unknown as Docker.ContainerStats;

    const sample = parseStats(raw, "cid", "api");
    // cpuDelta=1000, systemDelta=2000, onlineCpus=2 → (1000/2000)*2 = 1.0 cores
    expect(sample.cpuCores).toBeCloseTo(1.0, 5);
    expect(sample.memoryBytes).toBe(150); // 200 usage - 50 cache
    expect(sample.memoryLimitBytes).toBe(1_000);
    expect(sample.rxBytes).toBe(111);
    expect(sample.txBytes).toBe(222);
    expect(sample.name).toBe("api");
    expect(sample.containerId).toBe("cid");
  });

  it("reports 0 cores when there is no positive CPU/system delta", () => {
    const raw = {
      // Identical cpu/system usage across reads → zero delta → 0 cores.
      cpu_stats: { cpu_usage: { total_usage: 5_000 }, system_cpu_usage: 9_000 },
      precpu_stats: { cpu_usage: { total_usage: 5_000 }, system_cpu_usage: 9_000 },
      memory_stats: { usage: 0, limit: 0 },
    } as unknown as Docker.ContainerStats;
    expect(parseStats(raw, "cid", "x").cpuCores).toBe(0);
  });
});

describe("aggregatePreviewState", () => {
  const cases: Array<[ServiceState[], string]> = [
    [[], "stopped"],
    [["healthy", "healthy"], "running"],
    [["healthy", "unhealthy"], "degraded"],
    [["healthy", "crashed"], "failed"],
    [["stopped", "stopped"], "stopped"],
    [["healthy", "starting"], "deploying"],
    [["pending", "pending"], "deploying"],
  ];
  it.each(cases)("aggregates %j → %s", (states, expected) => {
    expect(aggregatePreviewState(states)).toBe(expected);
  });
});

describe("MockOrchestrator", () => {
  function plan(overrides: Partial<PreviewPlan> = {}): PreviewPlan {
    return new ComposePlanner().plan({
      previewId: "prev_mock",
      slug: "demo",
      ...(overrides as Record<string, unknown>),
    });
  }

  it("deploys a stack to running and reports a primary URL", async () => {
    const orch = new MockOrchestrator({ now: () => 1_000 });
    const result = await orch.deploy(plan());
    expect(result.status).toBe("running");
    expect(result.previewId).toBe("prev_mock");
    expect(result.services.every((s) => s.status === "healthy")).toBe(true);
    // web is primary and publishes port 3000 → it should have a URL.
    expect(result.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
  });

  it("emits lifecycle hooks (logs, status, progress)", async () => {
    const statuses: ServiceState[] = [];
    const phases: string[] = [];
    let logCount = 0;
    const orch = new MockOrchestrator();
    await orch.deploy(plan(), {
      onLog: () => {
        logCount += 1;
      },
      onServiceStatus: (_s, status) => statuses.push(status),
      onProgress: (e) => phases.push(e.phase),
    });
    expect(logCount).toBeGreaterThan(0);
    expect(statuses).toContain("pending");
    expect(statuses).toContain("starting");
    expect(statuses).toContain("healthy");
    expect(phases).toContain("done");
  });

  it("marks named services crashed and the preview failed", async () => {
    const orch = new MockOrchestrator({ failServices: ["api"] });
    const result = await orch.deploy(plan());
    expect(result.status).toBe("failed");
    expect(result.services.find((s) => s.name === "api")?.status).toBe("crashed");
  });

  it("never lets a throwing hook abort the deploy", async () => {
    const orch = new MockOrchestrator();
    const result = await orch.deploy(plan(), {
      onLog: () => {
        throw new Error("boom");
      },
    });
    expect(result.status).toBe("running");
  });

  it("supports the status → stop → destroy lifecycle", async () => {
    const orch = new MockOrchestrator();
    await orch.deploy(plan());

    const running = await orch.status("prev_mock");
    expect(running.exists).toBe(true);
    expect(running.status).toBe("running");

    await orch.stop("prev_mock");
    const stopped = await orch.status("prev_mock");
    expect(stopped.status).toBe("stopped");
    // Stopped services produce no stats samples.
    expect(await orch.collectStats("prev_mock")).toEqual([]);

    await orch.destroy("prev_mock");
    const gone = await orch.status("prev_mock");
    expect(gone.exists).toBe(false);
    expect(gone.status).toBe("destroyed");
  });

  it("collects deterministic stats for healthy services", async () => {
    const orch = new MockOrchestrator();
    await orch.deploy(plan());
    const samples = await orch.collectStats("prev_mock");
    expect(samples.length).toBeGreaterThan(0);
    for (const s of samples) {
      expect(s.cpuCores).toBeGreaterThan(0);
      expect(s.memoryBytes).toBeGreaterThan(0);
    }
  });
});
