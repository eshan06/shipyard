import { describe, expect, it } from "vitest";


import { loadConfig } from "../config.js";
import { createFakePrisma, testLogger, type Row } from "../test-utils.js";

import {
  findPreviewsToCleanup,
  runCleanupTick,
  type CleanupCandidate,
} from "./cleanup.js";

import type { Queue } from "bullmq";

const NOW = new Date("2026-06-14T12:00:00.000Z");

/** Build a candidate with sensible defaults overridden per-case. */
function candidate(overrides: Partial<CleanupCandidate>): CleanupCandidate {
  return {
    id: "prev-1",
    status: "RUNNING",
    isPinned: false,
    lastActivityAt: NOW,
    autoStopMinutes: 120,
    destroyTtlMinutes: 60,
    pullRequestState: null,
    pullRequestUpdatedAt: null,
    ...overrides,
  };
}

describe("findPreviewsToCleanup", () => {
  it("stops a RUNNING preview idle past its autoStopMinutes", () => {
    const idleSince = new Date(NOW.getTime() - 121 * 60_000);
    const out = findPreviewsToCleanup(NOW, [
      candidate({ lastActivityAt: idleSince }),
    ]);
    expect(out).toEqual([{ previewId: "prev-1", reason: "idle" }]);
  });

  it("does not stop a preview still within its idle window", () => {
    const idleSince = new Date(NOW.getTime() - 60 * 60_000);
    const out = findPreviewsToCleanup(NOW, [
      candidate({ lastActivityAt: idleSince }),
    ]);
    expect(out).toEqual([]);
  });

  it("never auto-stops a pinned preview", () => {
    const idleSince = new Date(NOW.getTime() - 999 * 60_000);
    const out = findPreviewsToCleanup(NOW, [
      candidate({ isPinned: true, lastActivityAt: idleSince }),
    ]);
    expect(out).toEqual([]);
  });

  it("does not idle-stop a STOPPED/FAILED preview", () => {
    const idleSince = new Date(NOW.getTime() - 999 * 60_000);
    const out = findPreviewsToCleanup(NOW, [
      candidate({ status: "STOPPED", lastActivityAt: idleSince }),
      candidate({ id: "prev-2", status: "FAILED", lastActivityAt: idleSince }),
    ]);
    expect(out).toEqual([]);
  });

  it("destroys a preview whose closed PR is past the TTL", () => {
    const closedAt = new Date(NOW.getTime() - 61 * 60_000);
    const out = findPreviewsToCleanup(NOW, [
      candidate({
        status: "STOPPED",
        pullRequestState: "CLOSED",
        pullRequestUpdatedAt: closedAt,
      }),
    ]);
    expect(out).toEqual([{ previewId: "prev-1", reason: "ttl" }]);
  });

  it("destroys (ttl) even a pinned preview when its PR is merged past TTL", () => {
    const mergedAt = new Date(NOW.getTime() - 61 * 60_000);
    const out = findPreviewsToCleanup(NOW, [
      candidate({
        isPinned: true,
        pullRequestState: "MERGED",
        pullRequestUpdatedAt: mergedAt,
      }),
    ]);
    expect(out).toEqual([{ previewId: "prev-1", reason: "ttl" }]);
  });

  it("prefers ttl over idle for the same preview", () => {
    const old = new Date(NOW.getTime() - 999 * 60_000);
    const out = findPreviewsToCleanup(NOW, [
      candidate({
        lastActivityAt: old,
        pullRequestState: "CLOSED",
        pullRequestUpdatedAt: old,
      }),
    ]);
    expect(out).toEqual([{ previewId: "prev-1", reason: "ttl" }]);
  });

  it("skips previews already DESTROYING/DESTROYED", () => {
    const old = new Date(NOW.getTime() - 999 * 60_000);
    const out = findPreviewsToCleanup(NOW, [
      candidate({ status: "DESTROYING", lastActivityAt: old }),
      candidate({ id: "prev-2", status: "DESTROYED", lastActivityAt: old }),
    ]);
    expect(out).toEqual([]);
  });
});

describe("runCleanupTick", () => {
  const config = loadConfig({
    DATABASE_URL: "postgres://x",
    REDIS_URL: "redis://x",
    SECRETS_ENCRYPTION_KEY: Buffer.alloc(32).toString("base64"),
    PREVIEW_BASE_DOMAIN: "preview.test",
  });

  it("loads candidates, decides, and enqueues destroy jobs", async () => {
    const idleSince = new Date(NOW.getTime() - 999 * 60_000);
    const previews: Row[] = [
      {
        id: "prev-idle",
        status: "RUNNING",
        isPinned: false,
        lastActivityAt: idleSince,
        autoStopMinutes: 120,
        project: { destroyTtlMinutes: 60 },
        pullRequest: null,
      },
      {
        id: "prev-fresh",
        status: "RUNNING",
        isPinned: false,
        lastActivityAt: NOW,
        autoStopMinutes: 120,
        project: { destroyTtlMinutes: 60 },
        pullRequest: null,
      },
    ];
    const { client } = createFakePrisma({ previews });

    const added: Array<{ name: string; data: unknown }> = [];
    const destroyQueue = {
      add: async (name: string, data: unknown) => {
        added.push({ name, data });
        return { id: String(added.length) };
      },
    } as unknown as Queue;

    const decisions = await runCleanupTick(
      { prisma: client, destroyQueue, config, logger: testLogger() },
      NOW,
    );

    expect(decisions).toEqual([{ previewId: "prev-idle", reason: "idle" }]);
    expect(added).toHaveLength(1);
    expect(added[0]?.data).toEqual({ previewId: "prev-idle", reason: "idle" });
  });
});
