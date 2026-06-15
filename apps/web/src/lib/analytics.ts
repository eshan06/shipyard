/**
 * Client-side product analytics — the `trackEvent` seam.
 *
 * Components call {@link trackEvent} to record product events ("preview
 * redeployed", "page viewed", …). Events are buffered and flushed in small
 * batches to the API's `POST /api/v1/telemetry` ingestion route (same-origin, so
 * the `sy_session` cookie authenticates them); the API forwards them to whatever
 * real sink is configured server-side (`ANALYTICS_DRIVER`: log / http / posthog).
 *
 * The browser never decides identity — the API stamps the authenticated user —
 * so this module sends only event names + properties.
 *
 * Design notes:
 *  - The buffering/flush logic ({@link createAnalyticsClient}) is a pure unit
 *    with an injected transport + clock, so it is testable without a DOM.
 *  - Everything is best-effort: failures never throw into product code.
 *  - SSR-safe: no `window`/`navigator` access at module load.
 *
 * @module
 */

import { api, API_BASE, ApiError } from "./api";

/** A buffered client event (identity is added server-side). */
export interface AnalyticsClientEvent {
  /** Event name in snake_case. */
  name: string;
  /** Arbitrary JSON-serializable properties. */
  properties?: Record<string, unknown>;
  /** ISO-8601 timestamp the event occurred. */
  ts: string;
}

/** A destination the {@link AnalyticsClient} flushes batches to. */
export interface AnalyticsTransport {
  /**
   * Send a batch. Resolve to accept (the batch is dropped from the buffer);
   * reject to signal a transient failure (the batch is re-queued for retry).
   */
  send(events: AnalyticsClientEvent[]): Promise<void>;
}

/** Options for {@link createAnalyticsClient}. */
export interface AnalyticsClientOptions {
  /** Where batches are sent. */
  transport: AnalyticsTransport;
  /** When false, `track` is a no-op. Defaults to true. */
  enabled?: boolean;
  /** Auto-flush once the buffer reaches this size. Defaults to 10. */
  batchSize?: number;
  /**
   * Cap on buffered events (oldest dropped past this). Defaults to 50 — the
   * server's `/telemetry` batch limit — so a single drained payload is always
   * within what the route accepts.
   */
  maxBuffer?: number;
  /** Injectable clock (tests). Defaults to `() => new Date()`. */
  now?: () => Date;
  /** Optional observer invoked for every tracked event (e.g. debug logging). */
  onTrack?: (event: AnalyticsClientEvent) => void;
}

/** A buffering analytics client. */
export interface AnalyticsClient {
  /** Buffer an event; auto-flushes when the batch size is reached. */
  track(name: string, properties?: Record<string, unknown>): void;
  /** Flush the buffer now. Resolves once the in-flight send settles. */
  flush(): Promise<void>;
  /** Remove and return all buffered events (used for `sendBeacon` on unload). */
  drain(): AnalyticsClientEvent[];
  /**
   * Push already-stamped events back onto the front of the buffer, preserving
   * their original timestamps. Used to re-queue a drained batch when a beacon
   * send fails (so occurrence time isn't rewritten).
   */
  enqueue(events: AnalyticsClientEvent[]): void;
  /** The current number of buffered events (for tests/diagnostics). */
  readonly size: number;
}

/**
 * Create a buffering analytics client. Pure: no DOM or network coupling beyond
 * the injected {@link AnalyticsTransport}.
 *
 * @param options - Transport plus tuning/injection hooks.
 * @returns A ready {@link AnalyticsClient}.
 */
export function createAnalyticsClient(
  options: AnalyticsClientOptions,
): AnalyticsClient {
  const {
    transport,
    enabled = true,
    batchSize = 10,
    maxBuffer = 50,
    now = () => new Date(),
    onTrack,
  } = options;

  let buffer: AnalyticsClientEvent[] = [];
  let inFlight: Promise<void> | null = null;

  function trim(): void {
    if (buffer.length > maxBuffer) {
      buffer = buffer.slice(buffer.length - maxBuffer);
    }
  }

  async function doFlush(): Promise<void> {
    if (buffer.length === 0) return;
    const batch = buffer;
    buffer = [];
    try {
      await transport.send(batch);
    } catch {
      // Transient failure: re-queue the batch ahead of newer events, capped.
      buffer = [...batch, ...buffer];
      trim();
    }
  }

  const client: AnalyticsClient = {
    track(name, properties): void {
      if (!enabled) return;
      buffer.push({ name, properties, ts: now().toISOString() });
      trim();
      onTrack?.(buffer[buffer.length - 1]!);
      if (buffer.length >= batchSize) {
        void client.flush();
      }
    },
    flush(): Promise<void> {
      // Serialize flushes so a batch is never sent twice concurrently.
      const next = (inFlight ?? Promise.resolve()).then(doFlush);
      inFlight = next;
      const settled = next.finally(() => {
        if (inFlight === settled) inFlight = null;
      });
      return settled;
    },
    drain(): AnalyticsClientEvent[] {
      const events = buffer;
      buffer = [];
      return events;
    },
    enqueue(events): void {
      if (!enabled || events.length === 0) return;
      buffer = [...events, ...buffer];
      trim();
    },
    get size(): number {
      return buffer.length;
    },
  };
  return client;
}

/** Canonical product-event names (use these constants to avoid typos). */
export const ANALYTICS_EVENTS = {
  signedIn: "signed_in",
  signedOut: "signed_out",
  pageViewed: "page_viewed",
  previewRedeployed: "preview_redeployed",
  previewStopped: "preview_stopped",
  previewDestroyed: "preview_destroyed",
  previewPinned: "preview_pinned",
  apiTokenCreated: "api_token_created",
  apiTokenRevoked: "api_token_revoked",
  onboardingStepCompleted: "onboarding_step_completed",
  onboardingCompleted: "onboarding_completed",
  onboardingDismissed: "onboarding_dismissed",
} as const;

/** Whether client analytics is enabled (default on; set the env to "false"/"0"). */
export function analyticsEnabled(): boolean {
  const raw = process.env.NEXT_PUBLIC_ANALYTICS_ENABLED;
  return raw !== "false" && raw !== "0";
}

/** Whether to log events to the console (dev aid). */
function analyticsDebug(): boolean {
  return process.env.NEXT_PUBLIC_ANALYTICS_DEBUG === "true";
}

/** Transport backed by the same-origin telemetry route. */
const browserTransport: AnalyticsTransport = {
  async send(events) {
    try {
      await api.post("/telemetry", { events });
    } catch (err) {
      // Client errors (401 when logged out, 422 bad payload) are not
      // retryable — accept (drop). Network/5xx → reject so the client retries.
      if (err instanceof ApiError && err.status >= 400 && err.status < 500) {
        return;
      }
      throw err;
    }
  },
};

let singleton: AnalyticsClient | null = null;

/** The lazily-created browser analytics singleton. */
function getClient(): AnalyticsClient {
  if (!singleton) {
    singleton = createAnalyticsClient({
      transport: browserTransport,
      enabled: analyticsEnabled(),
      onTrack: analyticsDebug()
        ? (e) => console.debug("[analytics]", e.name, e.properties ?? {})
        : undefined,
    });
  }
  return singleton;
}

/**
 * Record a product event. Safe to call anywhere on the client; buffered and
 * flushed by {@link flushAnalytics} / the analytics provider.
 *
 * @param name - Event name (prefer an {@link ANALYTICS_EVENTS} constant).
 * @param properties - Optional JSON-serializable properties.
 */
export function trackEvent(
  name: string,
  properties?: Record<string, unknown>,
): void {
  if (typeof window === "undefined") return;
  getClient().track(name, properties);
}

/** Flush buffered events via the normal transport (awaitable). */
export function flushAnalytics(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  return getClient().flush();
}

/**
 * Best-effort flush on page unload using `navigator.sendBeacon`, which survives
 * the page going away (a normal `fetch` would be cancelled). Falls back to a
 * regular flush when the Beacon API is unavailable or rejects the payload.
 */
export function flushAnalyticsBeacon(): void {
  if (typeof window === "undefined") return;
  const client = getClient();
  if (client.size === 0) return;

  const beacon =
    typeof navigator !== "undefined" ? navigator.sendBeacon?.bind(navigator) : undefined;
  if (!beacon) {
    void client.flush();
    return;
  }

  const events = client.drain();
  try {
    const blob = new Blob([JSON.stringify({ events })], {
      type: "application/json",
    });
    const ok = beacon(`${API_BASE}/telemetry`, blob);
    if (!ok) {
      // Beacon rejected (e.g. payload too large): re-queue (preserving the
      // original timestamps) and retry via fetch.
      client.enqueue(events);
      void client.flush();
    }
  } catch {
    client.enqueue(events);
    void client.flush();
  }
}
