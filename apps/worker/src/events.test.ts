import { describe, expect, it, vi, beforeEach } from "vitest";

import { CHANNEL } from "@shipyard/core";

import { createEventPublisher } from "./events.js";
import { testLogger } from "./test-utils.js";

// The events module imports the real prisma singleton; intercept it so no DB is
// touched. Each `logChunk.create` is captured, and `findFirst` returns the
// current max seq so the in-process counter seeds correctly.
const created: Array<Record<string, unknown>> = [];
let maxSeq: number | null = null;

vi.mock("@shipyard/db", () => ({
  prisma: {
    logChunk: {
      create: vi.fn(async (args: { data: Record<string, unknown> }) => {
        created.push(args.data);
        return { id: `log-${created.length}`, ...args.data };
      }),
      findFirst: vi.fn(async () =>
        maxSeq === null ? null : { seq: maxSeq },
      ),
    },
  },
}));

interface FakeConn {
  publish: ReturnType<typeof vi.fn>;
}

function fakeConnection(): FakeConn {
  return { publish: vi.fn(async () => 1) };
}

beforeEach(() => {
  created.length = 0;
  maxSeq = null;
});

describe("createEventPublisher.log", () => {
  it("persists a LogChunk and publishes a live line with a monotonic seq", async () => {
    const connection = fakeConnection();
    const events = createEventPublisher({
      connection: connection as never,
      logger: testLogger(),
    });

    const s0 = await events.log({ deploymentId: "dep-1", message: "first" });
    const s1 = await events.log({ deploymentId: "dep-1", message: "second" });

    expect(s0).toBe(0);
    expect(s1).toBe(1);
    expect(created).toHaveLength(2);
    expect(created[0]).toMatchObject({ deploymentId: "dep-1", seq: 0, message: "first" });

    // Two publishes on the deploy-logs channel for this deployment.
    expect(connection.publish).toHaveBeenCalledTimes(2);
    const [channel, payload] = connection.publish.mock.calls[0]!;
    expect(channel).toBe(CHANNEL.deployLogs("dep-1"));
    expect(JSON.parse(payload as string)).toMatchObject({ seq: 0, message: "first" });
  });

  it("continues the seq from the database max on first use", async () => {
    maxSeq = 4;
    const connection = fakeConnection();
    const events = createEventPublisher({
      connection: connection as never,
      logger: testLogger(),
    });

    const seq = await events.log({ deploymentId: "dep-2", message: "resumed" });
    expect(seq).toBe(5);
  });

  it("never throws when redis publish fails", async () => {
    const connection = { publish: vi.fn(async () => { throw new Error("redis down"); }) };
    const events = createEventPublisher({
      connection: connection as never,
      logger: testLogger(),
    });
    await expect(
      events.log({ deploymentId: "dep-3", message: "still recorded" }),
    ).resolves.toBe(0);
    expect(created).toHaveLength(1);
  });
});

describe("createEventPublisher.previewStatus", () => {
  it("publishes to both the per-preview channel and the global firehose", async () => {
    const connection = fakeConnection();
    const events = createEventPublisher({
      connection: connection as never,
      logger: testLogger(),
    });

    await events.previewStatus({
      previewId: "prev-1",
      status: "RUNNING",
      url: "https://x.preview.test",
      projectId: "proj-1",
      teamId: "team-1",
    });

    expect(connection.publish).toHaveBeenCalledTimes(2);
    const channels = connection.publish.mock.calls.map((c) => c[0]);
    expect(channels).toContain(CHANNEL.previewStatus("prev-1"));
    expect(channels).toContain(CHANNEL.previewEvents);
  });
});
