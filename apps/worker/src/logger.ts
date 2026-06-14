/**
 * Worker logger factory.
 *
 * Builds the root pino logger for the worker process. Outside production we
 * enable the `pino-pretty` transport for readable, colourised dev output; in
 * production we emit structured JSON (no transport) so logs ship cleanly to a
 * collector. Per-job/child loggers are derived from this root with `.child(...)`.
 *
 * @module
 */

import { pino, type Logger } from "pino";
import type { WorkerConfig } from "./config.js";

/**
 * Construct the root {@link Logger} from the validated {@link WorkerConfig}.
 *
 * @param config - The worker configuration (drives level + transport).
 * @returns A configured pino logger.
 */
export function createLogger(config: WorkerConfig): Logger {
  if (config.NODE_ENV !== "production") {
    return pino({
      level: config.LOG_LEVEL,
      transport: {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "HH:MM:ss.l",
          ignore: "pid,hostname",
        },
      },
    });
  }

  return pino({ level: config.LOG_LEVEL });
}
