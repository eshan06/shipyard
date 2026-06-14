/**
 * Server-Sent Events (SSE) bridge from Redis pub/sub.
 *
 * The worker publishes live log/status messages on Redis channels (see
 * `@shipyard/core` `CHANNEL`). The whole API process shares a SINGLE Redis
 * subscriber connection (`app.redisSub`), so naively letting every SSE request
 * `subscribe`/`unsubscribe` and attach its own `message` listener to that one
 * connection is buggy in two ways:
 *
 *  1. **Premature unsubscribe.** When two clients tail the same channel, the
 *     first to disconnect would `unsubscribe(channel)` the shared connection,
 *     silently killing the live tail for every other client on that channel.
 *  2. **Listener accumulation.** Each request adds a `message` listener; past
 *     the EventEmitter default of 10 this logs MaxListeners warnings, and every
 *     published message is fanned out to all N listeners (O(N) per message).
 *
 * {@link SseHub} fixes both: it installs exactly ONE `message` listener on the
 * shared connection and dispatches by channel to the interested handlers only,
 * and it refcounts subscriptions per channel so the connection is unsubscribed
 * from a channel only once its last client has gone away.
 *
 * @module
 */

import type { FastifyInstance, FastifyReply } from "fastify";
import type Redis from "ioredis";

/** Heartbeat interval (ms) — a comment line keeps the connection warm. */
const HEARTBEAT_MS = 15_000;

/** A handler invoked with the raw message payload for a subscribed channel. */
type ChannelHandler = (message: string) => void;

/**
 * Multiplexes many SSE subscribers over a single shared Redis subscriber
 * connection, with per-channel refcounting and a single dispatching listener.
 */
export class SseHub {
  /** Per-channel set of interested handlers (the refcount is `set.size`). */
  readonly #handlers = new Map<string, Set<ChannelHandler>>();

  /**
   * @param sub - The shared Redis subscriber connection (`app.redisSub`).
   */
  constructor(private readonly sub: Redis) {
    // One listener for the whole process; dispatch by channel to the handlers
    // that actually care, so message fan-out is O(handlers-on-this-channel).
    this.sub.on("message", (channel: string, message: string) => {
      const set = this.#handlers.get(channel);
      if (!set) return;
      for (const handler of set) handler(message);
    });
    // The shared connection legitimately carries many channels at once; the
    // single dispatching listener above means we never exceed one listener, but
    // disable the cap defensively in case other code attaches to it.
    this.sub.setMaxListeners(0);
  }

  /**
   * Subscribe `handler` to `channel`, subscribing the shared connection lazily
   * on the first handler and returning a disposer that unsubscribes it (and the
   * connection, once the last handler for the channel is gone).
   *
   * @param channel - The Redis channel to receive messages from.
   * @param handler - Invoked with each message published on `channel`.
   * @returns An async disposer to call on teardown.
   */
  async subscribe(
    channel: string,
    handler: ChannelHandler,
  ): Promise<() => Promise<void>> {
    let set = this.#handlers.get(channel);
    if (!set) {
      set = new Set();
      this.#handlers.set(channel, set);
      // First subscriber for this channel — subscribe the shared connection.
      await this.sub.subscribe(channel);
    }
    set.add(handler);

    let disposed = false;
    return async () => {
      if (disposed) return;
      disposed = true;
      const current = this.#handlers.get(channel);
      if (!current) return;
      current.delete(handler);
      if (current.size === 0) {
        this.#handlers.delete(channel);
        // Last subscriber for this channel left — release it on the shared
        // connection. Best-effort: the connection may already be gone.
        await this.sub.unsubscribe(channel).catch(() => undefined);
      }
    };
  }
}

/** Symbol-free cache of the per-app hub so we build exactly one per instance. */
const hubByApp = new WeakMap<FastifyInstance, SseHub>();

/**
 * Get (or lazily create) the {@link SseHub} for an app, bound to its shared
 * `app.redisSub` connection.
 *
 * @param app - The Fastify instance (provides `app.redisSub`).
 * @returns The app's singleton SSE hub.
 */
export function sseHub(app: FastifyInstance): SseHub {
  let hub = hubByApp.get(app);
  if (!hub) {
    hub = new SseHub(app.redisSub);
    hubByApp.set(app, hub);
  }
  return hub;
}

/** Options for {@link streamRedisChannel}. */
export interface StreamRedisChannelOptions {
  /** Pre-serialized SSE `data` payloads to replay before going live. */
  prime?: readonly string[];
  /** Optional callback invoked once when the stream is torn down. */
  onClose?: () => void;
}

/**
 * Subscribe to a Redis channel and forward its messages to the client as SSE.
 *
 * Sets the SSE response headers, (optionally) replays `prime` events, subscribes
 * to `channel` via the shared {@link SseHub}, writes each received message as a
 * `data:` event, emits a heartbeat comment every {@link HEARTBEAT_MS}, and tears
 * everything down when the client disconnects. The returned promise resolves
 * once the connection has been fully cleaned up.
 *
 * @param app - The Fastify instance (provides `app.redisSub`).
 * @param reply - The reply to stream into. Its `raw` socket is written directly.
 * @param channel - The Redis channel name to subscribe to.
 * @param options - Optional `prime` backfill and `onClose` cleanup callback.
 * @returns A promise that resolves when the SSE stream is closed.
 */
export async function streamRedisChannel(
  app: FastifyInstance,
  reply: FastifyReply,
  channel: string,
  options: StreamRedisChannelOptions = {},
): Promise<void> {
  const { raw } = reply;

  /** Write to the socket only while it is still open; never throw on teardown. */
  const safeWrite = (chunk: string): void => {
    if (!raw.writable || raw.destroyed) return;
    try {
      raw.write(chunk);
    } catch {
      // The socket raced into a closed state between the guard and the write;
      // the 'close'/'error' handlers below will run cleanup.
    }
  };

  reply.hijack();
  raw.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  // Prime the stream so the client's EventSource fires `open` immediately.
  safeWrite(`: subscribed to ${channel}\n\n`);
  for (const payload of options.prime ?? []) {
    safeWrite(`data: ${payload}\n\n`);
  }

  const onMessage = (message: string): void => {
    safeWrite(`data: ${message}\n\n`);
  };

  const heartbeat = setInterval(() => {
    safeWrite(`: heartbeat ${Date.now()}\n\n`);
  }, HEARTBEAT_MS);
  // Don't let the heartbeat timer keep the event loop alive at shutdown.
  heartbeat.unref?.();

  const unsubscribe = await sseHub(app).subscribe(channel, onMessage);

  await new Promise<void>((resolve) => {
    let settled = false;
    const cleanup = (): void => {
      if (settled) return;
      settled = true;
      clearInterval(heartbeat);
      // Refcounted: only unsubscribes the shared connection when WE are the
      // last client on this channel.
      void unsubscribe().finally(() => {
        options.onClose?.();
        resolve();
      });
    };

    raw.on("close", cleanup);
    raw.on("error", cleanup);
  });
}
