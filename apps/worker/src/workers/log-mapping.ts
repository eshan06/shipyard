/**
 * Pure mappers from deploy-engine progress phases to log metadata.
 *
 * The engine emits coarse {@link DeployPhase} progress events; the dashboard's
 * log stream is grouped by {@link LogSource} and coloured by {@link LogLevel}.
 * These helpers translate one into the other in a single, testable place.
 *
 * @module
 */

import type { LogLevel, LogSource } from "@shipyard/db";
import type { DeployPhase } from "@shipyard/deploy-engine";

/**
 * Map a {@link DeployPhase} to the {@link LogSource} bucket it belongs in.
 *
 * Image build phases are `BUILD`; everything from network creation through
 * health and seeding is the `DEPLOY` lifecycle.
 *
 * @param phase - The progress phase.
 * @returns The log source bucket.
 */
export function logSourceForPhase(phase: DeployPhase): LogSource {
  switch (phase) {
    case "building":
    case "pulling":
      return "BUILD";
    case "planning":
    case "network":
    case "creating":
    case "starting":
    case "health":
    case "seeding":
    case "done":
    case "error":
    default:
      return "DEPLOY";
  }
}

/**
 * Map a {@link DeployPhase} to a {@link LogLevel}. Only the `error` phase is
 * elevated; everything else is informational.
 *
 * @param phase - The progress phase.
 * @returns The log level.
 */
export function mapLogLevel(phase: DeployPhase): LogLevel {
  return phase === "error" ? "ERROR" : "INFO";
}
