/**
 * Product-analytics sink: a small, pluggable abstraction for recording product
 * events ("preview_redeployed", "page_viewed", …) to a configurable destination.
 *
 * This is the server half of the `trackEvent` seam. The dashboard posts batches
 * of events to `POST /api/v1/telemetry`; that route stamps the authenticated
 * principal and forwards each event here. Server-side code can also emit events
 * directly via `app.analytics.track(...)`.
 *
 * Three drivers, selected by {@link AppConfig.ANALYTICS_DRIVER}:
 *  - `log`     — emit a structured pino event (a real, dependency-free sink that
 *                ships wherever the API's logs go). The default.
 *  - `http`    — POST the event as JSON to a collector endpoint.
 *  - `posthog` — send the event to PostHog's capture API.
 *
 * Dispatch is always best-effort and **non-blocking**: `track` returns
 * immediately and never throws, so analytics can never slow down or break a
 * product request. Network failures are logged, not propagated.
 *
 * @module
 */

import type { AppConfig } from "../config.js";
import type { FastifyBaseLogger } from "fastify";

/** Where an event originated. */
export type AnalyticsSource = "web" | "api" | "worker";

/** A single product-analytics event. */
export interface AnalyticsEvent {
  /** Event name in snake_case, e.g. `"preview_redeployed"`. */
  readonly name: string;
  /**
   * The user this event is attributed to. Server-stamped from the authenticated
   * principal — never trusted from the client — so identities cannot be spoofed.
   */
  readonly distinctId?: string;
  /** Optional team context (e.g. for a team-scoped API token). */
  readonly teamId?: string;
  /** Where the event originated. */
  readonly source?: AnalyticsSource;
  /** Arbitrary JSON-serializable event properties. */
  readonly properties?: Record<string, unknown>;
  /** ISO-8601 timestamp; defaults to record-time when omitted. */
  readonly timestamp?: string;
}

/** A destination that records {@link AnalyticsEvent}s. */
export interface AnalyticsSink {
  /**
   * Record one event. Best-effort and non-blocking: returns immediately and
   * never throws. Transport errors are logged by the sink.
   */
  track(event: AnalyticsEvent): void;
  /** Await any in-flight dispatches (used on graceful shutdown). */
  close(): Promise<void>;
}

/** Per-request timeout for network sinks, so a slow collector can't pile up. */
const SINK_TIMEOUT_MS = 5_000;

/** Normalize an event with a guaranteed timestamp. */
function withTimestamp(event: AnalyticsEvent): AnalyticsEvent & { timestamp: string } {
  return { ...event, timestamp: event.timestamp ?? new Date().toISOString() };
}

/**
 * The default sink: emit a structured pino log line per event. Durable and
 * dependency-free — operators consume it from the same place as all other API
 * logs (the `analytics: true` marker makes events trivial to route/index).
 */
class LogSink implements AnalyticsSink {
  constructor(private readonly log: FastifyBaseLogger) {}

  track(event: AnalyticsEvent): void {
    const e = withTimestamp(event);
    this.log.info(
      {
        analytics: true,
        event: e.name,
        distinctId: e.distinctId,
        teamId: e.teamId,
        source: e.source,
        properties: e.properties,
        ts: e.timestamp,
      },
      `analytics ${e.name}`,
    );
  }

  async close(): Promise<void> {
    /* nothing buffered */
  }
}

/** Base for network sinks: tracks in-flight sends so `close()` can drain them. */
abstract class NetworkSink implements AnalyticsSink {
  private readonly inflight = new Set<Promise<void>>();

  constructor(protected readonly log: FastifyBaseLogger) {}

  track(event: AnalyticsEvent): void {
    const p = this.dispatch(withTimestamp(event)).finally(() => {
      this.inflight.delete(p);
    });
    this.inflight.add(p);
  }

  async close(): Promise<void> {
    await Promise.allSettled([...this.inflight]);
  }

  /** Send one event. Must resolve (never reject) — log failures internally. */
  protected abstract dispatch(
    event: AnalyticsEvent & { timestamp: string },
  ): Promise<void>;

  /** Shared resilient POST: timeout-bounded, errors logged not thrown. */
  protected async post(
    url: string,
    body: unknown,
    headers: Record<string, string>,
    eventName: string,
  ): Promise<void> {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(SINK_TIMEOUT_MS),
      });
      if (!res.ok) {
        this.log.warn(
          { analyticsSink: this.constructor.name, status: res.status, event: eventName },
          "analytics sink returned a non-2xx status",
        );
      }
    } catch (err) {
      this.log.warn(
        { analyticsSink: this.constructor.name, err, event: eventName },
        "analytics sink request failed",
      );
    }
  }
}

/** POST each event as JSON to an arbitrary collector endpoint. */
class HttpSink extends NetworkSink {
  constructor(
    log: FastifyBaseLogger,
    private readonly endpoint: string,
    private readonly authHeader: string | undefined,
  ) {
    super(log);
  }

  protected async dispatch(
    event: AnalyticsEvent & { timestamp: string },
  ): Promise<void> {
    const headers: Record<string, string> = this.authHeader
      ? { Authorization: this.authHeader }
      : {};
    await this.post(this.endpoint, event, headers, event.name);
  }
}

/** Send events to PostHog's capture API (`POST <host>/capture/`). */
class PostHogSink extends NetworkSink {
  constructor(
    log: FastifyBaseLogger,
    private readonly host: string,
    private readonly apiKey: string,
  ) {
    super(log);
  }

  protected async dispatch(
    event: AnalyticsEvent & { timestamp: string },
  ): Promise<void> {
    const url = `${this.host.replace(/\/+$/, "")}/capture/`;
    // Strip client-controlled PostHog-reserved (`$`-prefixed) keys so a client
    // can't override $lib, $ip, $set, etc. via event properties.
    const safeProps = Object.fromEntries(
      Object.entries(event.properties ?? {}).filter(([k]) => !k.startsWith("$")),
    );
    const payload = {
      api_key: this.apiKey,
      event: event.name,
      // PostHog requires a distinct_id; group anonymous events under one bucket.
      distinct_id: event.distinctId ?? "anonymous",
      timestamp: event.timestamp,
      properties: {
        ...safeProps,
        teamId: event.teamId,
        source: event.source,
        $lib: "shipyard",
      },
    };
    await this.post(url, payload, {}, event.name);
  }
}

/**
 * Build the configured analytics sink.
 *
 * Falls back to the {@link LogSink} (with a warning) if a network driver is
 * selected but its required configuration is missing — analytics must never
 * prevent the API from booting. Startup validation in `config.ts` normally
 * catches that earlier; this is defence in depth.
 *
 * @param config - The validated application configuration.
 * @param log - The Fastify base logger (used by every sink).
 * @returns A ready {@link AnalyticsSink}.
 */
export function createAnalyticsSink(
  config: AppConfig,
  log: FastifyBaseLogger,
): AnalyticsSink {
  switch (config.ANALYTICS_DRIVER) {
    case "http": {
      if (!config.ANALYTICS_HTTP_ENDPOINT) {
        log.warn("ANALYTICS_DRIVER=http but ANALYTICS_HTTP_ENDPOINT is unset; using the log sink");
        return new LogSink(log);
      }
      log.info({ analyticsDriver: "http" }, "product analytics → http sink");
      return new HttpSink(log, config.ANALYTICS_HTTP_ENDPOINT, config.ANALYTICS_HTTP_AUTH_HEADER);
    }
    case "posthog": {
      if (!config.ANALYTICS_POSTHOG_API_KEY) {
        log.warn("ANALYTICS_DRIVER=posthog but ANALYTICS_POSTHOG_API_KEY is unset; using the log sink");
        return new LogSink(log);
      }
      log.info({ analyticsDriver: "posthog" }, "product analytics → posthog sink");
      return new PostHogSink(log, config.ANALYTICS_POSTHOG_HOST, config.ANALYTICS_POSTHOG_API_KEY);
    }
    default:
      return new LogSink(log);
  }
}
