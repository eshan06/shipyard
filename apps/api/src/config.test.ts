/**
 * Tests for {@link loadConfig}: it parses/coerces a valid environment and fails
 * fast with a clear, aggregated message on invalid input.
 *
 * @module
 */

import { describe, expect, it } from "vitest";

import { loadConfig } from "./config.js";

/** A complete, valid environment map for the happy path. */
function validEnv(): NodeJS.ProcessEnv {
  return {
    NODE_ENV: "development",
    LOG_LEVEL: "info",
    DATABASE_URL: "postgresql://u:p@localhost:5432/db",
    REDIS_URL: "redis://localhost:6379",
    SECRETS_ENCRYPTION_KEY: Buffer.alloc(32).toString("base64"),
    API_HOST: "0.0.0.0",
    API_PORT: "4000",
    PUBLIC_APP_URL: "http://localhost:3000",
    PUBLIC_API_URL: "http://localhost:4000",
    PREVIEW_BASE_DOMAIN: "preview.localhost",
    SESSION_SECRET: "0123456789abcdef0123456789abcdef",
    DEV_AUTH: "true",
    RATE_LIMIT_MAX: "200",
    RATE_LIMIT_WINDOW: "1 minute",
  };
}

describe("loadConfig", () => {
  it("parses and coerces a valid environment", () => {
    const config = loadConfig(validEnv());
    expect(config.API_PORT).toBe(4000); // coerced to number
    expect(config.DEV_AUTH).toBe(true); // coerced to boolean
    expect(config.RATE_LIMIT_MAX).toBe(200);
    expect(config.PREVIEW_BASE_DOMAIN).toBe("preview.localhost");
  });

  it("applies defaults for optional fields", () => {
    const env = validEnv();
    delete env.DEV_AUTH;
    delete env.RATE_LIMIT_MAX;
    delete env.RATE_LIMIT_WINDOW;
    delete env.API_PORT;
    delete env.NODE_ENV;
    const config = loadConfig(env);
    expect(config.DEV_AUTH).toBe(false);
    expect(config.RATE_LIMIT_MAX).toBe(200);
    expect(config.RATE_LIMIT_WINDOW).toBe("1 minute");
    expect(config.API_PORT).toBe(4000);
    expect(config.NODE_ENV).toBe("development");
  });

  it("rejects a too-short SESSION_SECRET", () => {
    const env = validEnv();
    env.SESSION_SECRET = "short";
    expect(() => loadConfig(env)).toThrow(/SESSION_SECRET/);
  });

  it("defaults TRUST_PROXY to true and parses booleans/hops/subnets", () => {
    expect(loadConfig(validEnv()).TRUST_PROXY).toBe(true);

    const asFalse = loadConfig({ ...validEnv(), TRUST_PROXY: "false" });
    expect(asFalse.TRUST_PROXY).toBe(false);

    const asHops = loadConfig({ ...validEnv(), TRUST_PROXY: "1" });
    expect(asHops.TRUST_PROXY).toBe(1);

    const asSubnet = loadConfig({ ...validEnv(), TRUST_PROXY: "10.0.0.0/8" });
    expect(asSubnet.TRUST_PROXY).toBe("10.0.0.0/8");
  });

  it("rejects an invalid SECRETS_ENCRYPTION_KEY (wrong length)", () => {
    const env = validEnv();
    env.SECRETS_ENCRYPTION_KEY = Buffer.alloc(16).toString("base64");
    expect(() => loadConfig(env)).toThrow(/SECRETS_ENCRYPTION_KEY/);
  });

  it("aggregates multiple errors into one message", () => {
    const env = validEnv();
    delete env.DATABASE_URL;
    env.PUBLIC_APP_URL = "not-a-url";
    let message = "";
    try {
      loadConfig(env);
    } catch (err) {
      message = (err as Error).message;
    }
    expect(message).toMatch(/DATABASE_URL/);
    expect(message).toMatch(/PUBLIC_APP_URL/);
  });
});
