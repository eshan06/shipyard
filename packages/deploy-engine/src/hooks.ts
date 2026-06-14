/**
 * Safe invocation helpers for {@link OrchestratorHooks}.
 *
 * Hooks are caller-provided and best-effort: a throwing hook must never abort a
 * deploy or leak its error into engine control flow. These helpers swallow hook
 * exceptions while still delivering events to all other hooks.
 */

import type {
  LogLine,
  OrchestratorHooks,
  ProgressEvent,
  ServiceRuntime,
  ServiceState,
} from "./types.js";

/** Invoke `onLog` defensively. */
export function emitLog(hooks: OrchestratorHooks | undefined, line: LogLine): void {
  try {
    hooks?.onLog?.(line);
  } catch {
    /* hook errors are non-fatal */
  }
}

/** Invoke `onServiceStatus` defensively. */
export function emitServiceStatus(
  hooks: OrchestratorHooks | undefined,
  service: string,
  status: ServiceState,
  runtime: ServiceRuntime,
): void {
  try {
    hooks?.onServiceStatus?.(service, status, runtime);
  } catch {
    /* hook errors are non-fatal */
  }
}

/** Invoke `onProgress` defensively. */
export function emitProgress(hooks: OrchestratorHooks | undefined, event: ProgressEvent): void {
  try {
    hooks?.onProgress?.(event);
  } catch {
    /* hook errors are non-fatal */
  }
}
