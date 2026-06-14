import { describe, expect, it } from "vitest";

import { MockOrchestrator } from "@shipyard/deploy-engine";

import { loadConfig } from "../config.js";
import {
  createFakePrisma,
  recordingEvents,
  testLogger,
  type FakeData,
  type Row,
} from "../test-utils.js";

import { processDeployJob, type DeployWorkerDeps } from "./deploy.js";

import type { DeployJob } from "@shipyard/core";

const config = loadConfig({
  DATABASE_URL: "postgres://x",
  REDIS_URL: "redis://x",
  SECRETS_ENCRYPTION_KEY: Buffer.alloc(32).toString("base64"),
  PREVIEW_BASE_DOMAIN: "preview.test",
});

const JOB: DeployJob = {
  deploymentId: "dep-1",
  previewId: "prev-1",
  projectId: "proj-1",
  commitSha: "abcdef0123456789",
  trigger: "PR_SYNC",
};

/** Seed a coherent deployment/preview/project (+ optional PR author + seed). */
function seed(extra: Partial<FakeData> = {}): FakeData {
  const deployments: Row[] = [
    { id: "dep-1", previewId: "prev-1", status: "QUEUED", commitSha: JOB.commitSha },
  ];
  const previews: Row[] = [
    {
      id: "prev-1",
      projectId: "proj-1",
      slug: "feature-login-abc123",
      status: "QUEUED",
      url: null,
      pullRequest: { authorLogin: "octocat" },
    },
  ];
  const projects: Row[] = [
    {
      id: "proj-1",
      teamId: "team-1",
      framework: "next",
      rootDirectory: ".",
      // Force a single-service stack (web only) so the mock deploy is small.
      config: { withDatabase: false, withCache: false },
    },
  ];
  return { deployments, previews, projects, ...extra };
}

function buildDeps(
  data: FakeData,
  orchestrator = new MockOrchestrator(),
): { deps: DeployWorkerDeps; tables: ReturnType<typeof createFakePrisma>["tables"]; events: ReturnType<typeof recordingEvents> } {
  const { client, tables } = createFakePrisma(data);
  const events = recordingEvents();
  const deps: DeployWorkerDeps = {
    prisma: client,
    orchestrator,
    events,
    config,
    logger: testLogger(),
  };
  return { deps, tables, events };
}

describe("processDeployJob (happy path)", () => {
  it("drives the deployment to SUCCEEDED and the preview to RUNNING", async () => {
    const { deps, tables } = buildDeps(seed());

    await processDeployJob(JOB, deps);

    const deployment = tables.deployments[0]!;
    expect(deployment.status).toBe("SUCCEEDED");
    expect(deployment.startedAt).toBeInstanceOf(Date);
    expect(deployment.finishedAt).toBeInstanceOf(Date);
    expect(typeof deployment.durationMs).toBe("number");

    const preview = tables.previews[0]!;
    expect(preview.status).toBe("RUNNING");
    expect(preview.url).toBe("https://feature-login-abc123.preview.test");
    expect(preview.lastActivityAt).toBeInstanceOf(Date);

    const build = tables.builds[0]!;
    expect(build.status).toBe("SUCCEEDED");
    expect(build.deploymentId).toBe("dep-1");
  });

  it("creates Service rows for the reported services as HEALTHY", async () => {
    const { deps, tables } = buildDeps(seed());
    await processDeployJob(JOB, deps);

    // withDatabase/withCache disabled → api + web only.
    const names = tables.services.map((s) => s.name).sort();
    expect(names).toEqual(["api", "web"]);
    for (const svc of tables.services) {
      expect(svc.status).toBe("HEALTHY");
      expect(svc.previewId).toBe("prev-1");
    }
  });

  it("publishes status transitions and logs", async () => {
    const { deps, events } = buildDeps(seed());
    await processDeployJob(JOB, deps);

    const statuses = events.statuses.map((s) => s.status);
    expect(statuses).toContain("BUILDING");
    expect(statuses).toContain("DEPLOYING");
    expect(statuses).toContain("RUNNING");

    // The final RUNNING status carries the resolved URL.
    const running = events.statuses.find((s) => s.status === "RUNNING");
    expect(running?.url).toBe("https://feature-login-abc123.preview.test");

    // A "Preview ready" deploy log is emitted.
    expect(events.logs.some((l) => l.message.includes("Preview ready"))).toBe(true);
  });

  it("notifies the resolvable PR author with PREVIEW_READY", async () => {
    const users: Row[] = [{ id: "user-1", githubLogin: "octocat" }];
    const { deps, tables } = buildDeps(seed({ users }));
    await processDeployJob(JOB, deps);

    const notif = tables.notifications.find((n) => n.type === "PREVIEW_READY");
    expect(notif).toBeDefined();
    expect(notif?.userId).toBe("user-1");
  });

  it("emits a seeding log when a healthy DB service + default seed exist", async () => {
    const projects: Row[] = [
      {
        id: "proj-1",
        teamId: "team-1",
        framework: "next",
        rootDirectory: ".",
        config: { withCache: false }, // keep postgres, drop redis
      },
    ];
    const seedTemplates: Row[] = [
      { id: "seed-1", projectId: "proj-1", name: "demo", kind: "SQL", isDefault: true },
    ];
    const { deps, events } = buildDeps(seed({ projects, seedTemplates }));
    await processDeployJob(JOB, deps);

    expect(events.logs.some((l) => l.message.includes("Seeding"))).toBe(true);
    expect(events.logs.some((l) => l.message.includes('Seed "demo" applied'))).toBe(true);
  });
});

describe("processDeployJob (failure path)", () => {
  it("marks Build/Deployment/Preview FAILED when a service crashes", async () => {
    const orchestrator = new MockOrchestrator({ failServices: ["web"] });
    const { deps, tables } = buildDeps(seed(), orchestrator);

    await processDeployJob(JOB, deps);

    expect(tables.deployments[0]!.status).toBe("FAILED");
    expect(tables.deployments[0]!.errorSummary).toBeTruthy();
    expect(tables.builds[0]!.status).toBe("FAILED");
    expect(tables.builds[0]!.exitCode).toBe(1);
    expect(tables.previews[0]!.status).toBe("FAILED");
  });

  it("publishes a FAILED status and a BUILD_FAILED notification", async () => {
    const orchestrator = new MockOrchestrator({ failServices: ["web"] });
    const users: Row[] = [{ id: "user-1", githubLogin: "octocat" }];
    const { deps, tables, events } = buildDeps(seed({ users }), orchestrator);

    await processDeployJob(JOB, deps);

    expect(events.statuses.some((s) => s.status === "FAILED")).toBe(true);
    expect(tables.notifications.some((n) => n.type === "BUILD_FAILED")).toBe(true);
    expect(events.logs.some((l) => l.message.includes("Deploy failed"))).toBe(true);
  });
});

describe("processDeployJob (robustness)", () => {
  it("drops the job gracefully when the deployment row is missing", async () => {
    const { deps, tables } = buildDeps({ deployments: [], previews: [], projects: [] });
    await expect(processDeployJob(JOB, deps)).resolves.toBeUndefined();
    expect(tables.builds).toHaveLength(0);
  });
});
