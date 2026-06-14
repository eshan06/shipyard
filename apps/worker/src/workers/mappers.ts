/**
 * Small pure mappers between `@shipyard/deploy-engine` runtime vocabulary and
 * the Prisma enums persisted in the database.
 *
 * The engine deliberately uses lowercase string unions that mirror the Prisma
 * enums (`ServiceKind` ↔ `ServiceType`, `ServiceState` ↔ `ServiceStatus`,
 * `PreviewState` ↔ `PreviewStatus`); these helpers do the uppercasing safely and
 * in one place so the workers never sprinkle `.toUpperCase()` casts.
 *
 * @module
 */

import type {
  PreviewStatus,
  ServiceStatus,
  ServiceType,
} from "@shipyard/db";
import type {
  PreviewState,
  ServiceKind,
  ServiceState,
} from "@shipyard/deploy-engine";

/** Map an engine {@link ServiceKind} onto the Prisma `ServiceType` enum. */
export function serviceTypeFromKind(kind: ServiceKind): ServiceType {
  switch (kind) {
    case "web":
      return "WEB";
    case "api":
      return "API";
    case "worker":
      return "WORKER";
    case "database":
      return "DATABASE";
    case "cache":
      return "CACHE";
    case "custom":
    default:
      return "CUSTOM";
  }
}

/** Map an engine {@link ServiceState} onto the Prisma `ServiceStatus` enum. */
export function serviceStatusFromState(state: ServiceState): ServiceStatus {
  switch (state) {
    case "pending":
      return "PENDING";
    case "starting":
      return "STARTING";
    case "healthy":
      return "HEALTHY";
    case "unhealthy":
      return "UNHEALTHY";
    case "stopped":
      return "STOPPED";
    case "crashed":
      return "CRASHED";
    default:
      return "PENDING";
  }
}

/**
 * Map an engine {@link PreviewState} onto the Prisma `PreviewStatus` enum.
 *
 * The engine reports `deploying` while a stack is starting up; the worker has
 * its own QUEUED→BUILDING→DEPLOYING progression, so callers generally derive the
 * preview status from the deploy outcome rather than this raw mapping — but it is
 * provided for status snapshots.
 */
export function previewStatusFromState(state: PreviewState): PreviewStatus {
  switch (state) {
    case "queued":
      return "QUEUED";
    case "building":
      return "BUILDING";
    case "deploying":
      return "DEPLOYING";
    case "running":
      return "RUNNING";
    case "degraded":
      return "DEGRADED";
    case "stopped":
      return "STOPPED";
    case "failed":
      return "FAILED";
    case "destroying":
      return "DESTROYING";
    case "destroyed":
      return "DESTROYED";
    default:
      return "QUEUED";
  }
}
