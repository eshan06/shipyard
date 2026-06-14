/**
 * Server-Sent Events (SSE) bridge from Redis pub/sub.
 *
 * The worker publishes live log/status messages on Redis channels (see
 * `@shipyard/core` `CHANNEL`). This helper subscribes a dedicated Redis
 * connection to one channel and relays each message to the browser as an SSE
 * `data:` event, with periodic heartbeats to keep proxies from idling the
 * connection out. Subscriptions are cleaned up when the client disconnects.
 *
 * @module
 */

import type { FastifyInstance, FastifyReply } from "fastify";

/** Heartbeat interval (ms) — a comment line keeps the connection warm. */
const HEARTBEAT_MS = 15_000;

/** Options for {@link streamRedisChannel}. */
export interface StreamRedisChannelOptions {
  /** Optional callback invoked once when the stream is torn down. */
  onClose?: () => void;
}

/**
 * Subscribe to a Redis channel and forward its messages to the client as SSE.
 *
 * Sets the SSE response headers, subscribes `app.redisSub` to `channel`, writes
 * each received message as a `data:` event, emits a heartbeat comment every
 * {@link HEARTBEAT_MS}, and tears everything down when the client disconnects.
 * The returned promise resolves once the connection has been fully cleaned up.
 *
 * @param app - The Fastify instance (provides `app.redisSub`).
 * @param reply - The reply to stream into. Its `raw` socket is written directly.
 * @param channel - The Redis channel name to subscribe to.
 * @param options - Optional `onClose` cleanup callback.
 * @returns A promise that resolves when the SSE stream is closed.
 */
export async function streamRedisChannel(
  app: FastifyInstance,
  reply: FastifyReply,
  channel: string,
  options: StreamRedisChannelOptions = {},
): Promise<void> {
  const { raw } = reply;

  reply.hijack();
  raw.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  // Prime the stream so the client's EventSource fires `open` immediately.
  raw.write(`: subscribed to ${channel}\n\n`);

  /** Forward only messages for our channel (Redis fans all out per connection). */
  const onMessage = (incoming: string, message: string): void => {
    if (incoming !== channel) return;
    raw.write(`data: ${message}\n\n`);
  };

  const heartbeat = setInterval(() => {
    raw.write(`: heartbeat ${Date.now()}\n\n`);
  }, HEARTBEAT_MS);
  // Don't let the heartbeat timer keep the event loop alive at shutdown.
  heartbeat.unref?.();

  app.redisSub.on("message", onMessage);
  await app.redisSub.subscribe(channel);

  await new Promise<void>((resolve) => {
    let settled = false;
    const cleanup = (): void => {
      if (settled) return;
      settled = true;
      clearInterval(heartbeat);
      app.redisSub.off("message", onMessage);
      // Best-effort unsubscribe; ignore errors (connection may be gone).
      void app.redisSub.unsubscribe(channel).catch(() => undefined);
      options.onClose?.();
      resolve();
    };

    raw.on("close", cleanup);
    raw.on("error", cleanup);
  });
}
