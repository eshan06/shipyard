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

import { processDestroyJob, type DestroyWorkerDeps } from "./destroy.js";

import type { DestroyJob } from "@shipyard/core";

const config = loadConfig({
  DATABASE_URL: "postgres://x",
  REDIS_URL: "redis://x",
  SECRETS_ENCRYPTION_KEY: Buffer.alloc(32).toString("base64"),
  PREVIEW_BASE_DOMAIN: "preview.test",
});

function seed(status = "RUNNING"): FakeData {
  const previews: Row[] = [
    { id: "prev-1", projectId: "proj-1", status, url: "https://x.preview.test", destroyedAt: null },
  ];
  const projects: Row[] = [{ id: "proj-1", teamId: "team-1" }];
  const services: Row[] = [
    { id: "svc-1", previewId: "prev-1", name: "web", status: "HEALTHY", containerId: "c1" },
  ];
  return { previews, projects, services };
}

function buildDeps(data: FakeData) {
  const { client, tables } = createFakePrisma(data);
  const events = recordingEvents();
  const deps: DestroyWorkerDeps = {
    prisma: client,
    orchestrator: new MockOrchestrator(),
    events,
    config,
    logger: testLogger(),
  };
  return { deps, tables, events };
}

describe("processDestroyJob", () => {
  it("parks an idle preview at STOPPED (no destroyedAt)", async () => {
    const { deps, tables, events } = buildDeps(seed());
    const job: DestroyJob = { previewId: "prev-1", reason: "idle" };

    await processDestroyJob(job, deps);

    expect(tables.previews[0]!.status).toBe("STOPPED");
    expect(tables.previews[0]!.destroyedAt).toBeNull();
    expect(tables.services[0]!.status).toBe("STOPPED");
    expect(tables.services[0]!.containerId).toBeNull();
    // Idle stop goes RUNNING → STOPPED directly (the state machine forbids
    // DESTROYING → STOPPED), so only the STOPPED transition is published.
    expect(events.statuses.map((s) => s.status)).toEqual(["STOPPED"]);
  });

  it("destroys a preview (DESTROYED + destroyedAt) for pr_closed", async () => {
    const { deps, tables, events } = buildDeps(seed());
    const job: DestroyJob = { previewId: "prev-1", reason: "pr_closed" };

    await processDestroyJob(job, deps);

    expect(tables.previews[0]!.status).toBe("DESTROYED");
    expect(tables.previews[0]!.destroyedAt).toBeInstanceOf(Date);
    expect(tables.services[0]!.status).toBe("STOPPED");
    expect(events.statuses.map((s) => s.status)).toEqual(["DESTROYING", "DESTROYED"]);
  });

  it("destroys a preview for the ttl reason", async () => {
    const { deps, tables } = buildDeps(seed());
    await processDestroyJob({ previewId: "prev-1", reason: "ttl" }, deps);
    expect(tables.previews[0]!.status).toBe("DESTROYED");
  });

  it("is a no-op when the preview is already DESTROYED", async () => {
    const { deps, tables, events } = buildDeps(seed("DESTROYED"));
    await processDestroyJob({ previewId: "prev-1", reason: "manual" }, deps);
    expect(tables.previews[0]!.status).toBe("DESTROYED");
    expect(events.statuses).toHaveLength(0);
  });

  it("drops the job gracefully when the preview row is missing", async () => {
    const { deps } = buildDeps({ previews: [], projects: [], services: [] });
    await expect(
      processDestroyJob({ previewId: "missing", reason: "manual" }, deps),
    ).resolves.toBeUndefined();
  });
});
