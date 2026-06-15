/**
 * Application logger factory.
 *
 * Builds the pino logger options Fastify uses for its request/server logger.
 * Outside production we enable the `pino-pretty` transport for readable,
 * colourised dev output; in production we emit structured JSON (no transport)
 * so logs ship cleanly to a collector.
 *
 * @module
 */

import type { AppConfig } from "./config.js";
import type { PinoLoggerOptions } from "fastify/types/logger.js";

/**
 * Construct pino logger options from the validated {@link AppConfig}.
 *
 * @param config - The application configuration (drives level + transport).
 * @returns Logger options suitable for Fastify's `logger` server option.
 */
export function buildLoggerOptions(config: AppConfig): PinoLoggerOptions {
  const options: PinoLoggerOptions = { level: config.LOG_LEVEL };

  // Defence-in-depth: censor common secret-ish keys if they ever reach a log
  // line (e.g. via analytics event `properties`). Upstream schemas should keep
  // these out; this is a backstop so a stray secret is never logged in clear.
  options.redact = {
    paths: [
      "properties.password",
      "properties.token",
      "properties.secret",
      "properties.apiKey",
      "properties.authorization",
      "*.password",
      "*.token",
      "*.secret",
      "*.authorization",
    ],
    censor: "[redacted]",
  };

  if (config.NODE_ENV !== "production") {
    options.transport = {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "HH:MM:ss.l",
        ignore: "pid,hostname",
      },
    };
  }

  return options;
}
