/**
 * Unit tests for the client analytics buffer: batching, flush, transient-failure
 * re-queue, the disabled no-op, drain semantics, and the buffer cap.
 *
 * @module
 */

import { describe, expect, it, vi } from "vitest";

import {
  createAnalyticsClient,
  trackEvent,
  type AnalyticsClientEvent,
  type AnalyticsTransport,
} from "./analytics";

/** A transport that records every batch it is asked to send. */
function recordingTransport(): AnalyticsTransport & { batches: AnalyticsClientEvent[][] } {
  const batches: AnalyticsClientEvent[][] = [];
  return {
    batches,
    async send(events) {
      batches.push(events);
    },
  };
}

/** A fixed clock for deterministic timestamps. */
const fixedNow = () => new Date("2026-06-14T00:00:00.000Z");

describe("createAnalyticsClient", () => {
  it("buffers events and auto-flushes when the batch size is reached", async () => {
    const transport = recordingTransport();
    const client = createAnalyticsClient({ transport, batchSize: 3, now: fixedNow });

    client.track("a");
    client.track("b");
    expect(transport.batches).toHaveLength(0);
    expect(client.size).toBe(2);

    client.track("c"); // hits batchSize → auto-flush
    await client.flush();

    expect(transport.batches).toHaveLength(1);
    expect(transport.batches[0]!.map((e) => e.name)).toEqual(["a", "b", "c"]);
    expect(transport.batches[0]![0]!.ts).toBe("2026-06-14T00:00:00.000Z");
    expect(client.size).toBe(0);
  });

  it("attaches properties and is a no-op when disabled", async () => {
    const transport = recordingTransport();
    const client = createAnalyticsClient({ transport, enabled: false });
    client.track("nope", { a: 1 });
    await client.flush();
    expect(transport.batches).toHaveLength(0);
    expect(client.size).toBe(0);
  });

  it("re-queues a batch when the transport rejects, then sends it on the next flush", async () => {
    const send = vi
      .fn<AnalyticsTransport["send"]>()
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValue(undefined);
    const client = createAnalyticsClient({ transport: { send }, now: fixedNow });

    client.track("x", { id: 1 });
    await client.flush(); // first send rejects → re-queued
    expect(client.size).toBe(1);

    await client.flush(); // retry succeeds
    expect(client.size).toBe(0);
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[1]![0].map((e) => e.name)).toEqual(["x"]);
  });

  it("drain() removes and returns all buffered events", () => {
    const client = createAnalyticsClient({ transport: recordingTransport() });
    client.track("a");
    client.track("b");
    const drained = client.drain();
    expect(drained.map((e) => e.name)).toEqual(["a", "b"]);
    expect(client.size).toBe(0);
  });

  it("caps the buffer to maxBuffer, dropping the oldest events", () => {
    const client = createAnalyticsClient({ transport: recordingTransport(), maxBuffer: 2, batchSize: 999 });
    client.track("a");
    client.track("b");
    client.track("c");
    const drained = client.drain();
    expect(drained.map((e) => e.name)).toEqual(["b", "c"]);
  });
});

describe("trackEvent", () => {
  it("is SSR-safe (no-op without window, does not throw)", () => {
    // In the node test environment there is no `window`.
    expect(() => trackEvent("server_side", { a: 1 })).not.toThrow();
  });
});
