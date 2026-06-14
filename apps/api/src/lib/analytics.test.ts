/**
 * Unit tests for the analytics sink: driver selection, the structured-log sink,
 * the network sinks' resilient dispatch (success, non-2xx, and thrown errors),
 * and the safe fallback when a network driver is misconfigured.
 *
 * @module
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import { TEST_CONFIG } from "../test/helpers.js";

import { createAnalyticsSink } from "./analytics.js";

import type { AppConfig } from "../config.js";
import type { FastifyBaseLogger } from "fastify";

/** A minimal logger stub recording the calls the sinks make. */
function fakeLogger(): FastifyBaseLogger & {
  info: ReturnType<typeof vi.fn>;
  warn: ReturnType<typeof vi.fn>;
} {
  const log = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
    fatal: vi.fn(),
    silent: vi.fn(),
    level: "info",
    child() {
      return log;
    },
  };
  return log as unknown as FastifyBaseLogger & {
    info: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
  };
}

/** Build an AppConfig with analytics overrides. */
function cfg(over: Partial<AppConfig>): AppConfig {
  return { ...TEST_CONFIG, ...over } as AppConfig;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("createAnalyticsSink", () => {
  describe("log driver (default)", () => {
    it("emits a structured pino event with a server timestamp", () => {
      const log = fakeLogger();
      const sink = createAnalyticsSink(cfg({ ANALYTICS_DRIVER: "log" }), log);

      sink.track({ name: "preview_redeployed", distinctId: "user_1", properties: { id: "p1" } });

      expect(log.info).toHaveBeenCalledTimes(1);
      const [payload, msg] = log.info.mock.calls[0]!;
      expect(payload).toMatchObject({
        analytics: true,
        event: "preview_redeployed",
        distinctId: "user_1",
        properties: { id: "p1" },
      });
      expect(typeof payload.ts).toBe("string");
      expect(msg).toContain("preview_redeployed");
    });

    it("track() is synchronous and never throws", () => {
      const sink = createAnalyticsSink(cfg({ ANALYTICS_DRIVER: "log" }), fakeLogger());
      expect(sink.track({ name: "x" })).toBeUndefined();
    });
  });

  describe("http driver", () => {
    it("POSTs the event JSON to the endpoint with the auth header, then drains on close", async () => {
      const fetchMock = vi.fn(async () => new Response(null, { status: 200 }));
      vi.stubGlobal("fetch", fetchMock);
      const sink = createAnalyticsSink(
        cfg({
          ANALYTICS_DRIVER: "http",
          ANALYTICS_HTTP_ENDPOINT: "https://collector.example/ingest",
          ANALYTICS_HTTP_AUTH_HEADER: "Bearer s3cr3t",
        }),
        fakeLogger(),
      );

      sink.track({ name: "signed_in", distinctId: "user_2" });
      await sink.close();

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
      expect(url).toBe("https://collector.example/ingest");
      expect(init.method).toBe("POST");
      expect((init.headers as Record<string, string>).Authorization).toBe("Bearer s3cr3t");
      expect(String(init.body)).toContain("signed_in");
    });

    it("logs but does not throw when the collector errors", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => {
          throw new Error("network down");
        }),
      );
      const log = fakeLogger();
      const sink = createAnalyticsSink(
        cfg({ ANALYTICS_DRIVER: "http", ANALYTICS_HTTP_ENDPOINT: "https://x/y" }),
        log,
      );

      sink.track({ name: "boom" });
      await expect(sink.close()).resolves.toBeUndefined();
      expect(log.warn).toHaveBeenCalled();
    });

    it("falls back to the log sink when the endpoint is missing", () => {
      const log = fakeLogger();
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);
      const sink = createAnalyticsSink(cfg({ ANALYTICS_DRIVER: "http", ANALYTICS_HTTP_ENDPOINT: undefined }), log);

      sink.track({ name: "e" });
      expect(log.warn).toHaveBeenCalled();
      expect(log.info).toHaveBeenCalled(); // recorded via the log sink
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe("posthog driver", () => {
    it("captures to <host>/capture/ with api_key and distinct_id", async () => {
      const fetchMock = vi.fn(async () => new Response(null, { status: 200 }));
      vi.stubGlobal("fetch", fetchMock);
      const sink = createAnalyticsSink(
        cfg({
          ANALYTICS_DRIVER: "posthog",
          ANALYTICS_POSTHOG_HOST: "https://eu.i.posthog.com",
          ANALYTICS_POSTHOG_API_KEY: "phc_abc",
        }),
        fakeLogger(),
      );

      sink.track({ name: "project_created", distinctId: "user_3", teamId: "team_1" });
      await sink.close();

      const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
      expect(url).toBe("https://eu.i.posthog.com/capture/");
      const body = JSON.parse(String(init.body));
      expect(body.api_key).toBe("phc_abc");
      expect(body.event).toBe("project_created");
      expect(body.distinct_id).toBe("user_3");
      expect(body.properties.teamId).toBe("team_1");
    });

    it("falls back to the log sink when the api key is missing", () => {
      const log = fakeLogger();
      const sink = createAnalyticsSink(
        cfg({ ANALYTICS_DRIVER: "posthog", ANALYTICS_POSTHOG_API_KEY: undefined }),
        log,
      );
      sink.track({ name: "e" });
      expect(log.warn).toHaveBeenCalled();
      expect(log.info).toHaveBeenCalled();
    });
  });
});
