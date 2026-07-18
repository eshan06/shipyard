/**
 * Status state-machine helpers for previews and deployments.
 *
 * Centralizes the allowed transitions and dashboard display metadata so the
 * API, worker, and web app all agree on what is a legal status change and how
 * each status should be rendered.
 *
 * @module
 */

import type { DeploymentStatus, PreviewStatus } from "./schemas/enums.js";

/**
 * Visual/semantic metadata for a status, consumed by the dashboard.
 */
export interface StatusDisplay {
  /** Human-friendly label, e.g. `"Running"`. */
  label: string;
  /**
   * Design-system color token (not a raw hex) so the web app maps it to its
   * theme. One of a small, fixed palette.
   */
  color: StatusColorToken;
  /**
   * Whether this status represents an environment/job that is "live" or doing
   * work — used to drive spinners, polling, and active-count badges.
   */
  isActive: boolean;
}

/**
 * Fixed palette of color tokens the dashboard knows how to render.
 */
export type StatusColorToken =
  | "neutral"
  | "info"
  | "success"
  | "warning"
  | "danger";

// ─────────────────────────────────────────────────────────────────────────────
// Preview state machine
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Allowed {@link PreviewStatus} transitions.
 *
 * A preview moves QUEUED → BUILDING → DEPLOYING → RUNNING; from RUNNING it can
 * DEGRADE, be STOPPED, or be torn down. Failed/stopped previews can be
 * re-queued (redeploy/restart). DESTROYED is terminal.
 */
export const PREVIEW_TRANSITIONS: Readonly<
  Record<PreviewStatus, readonly PreviewStatus[]>
> = {
  QUEUED: ["BUILDING", "DEPLOYING", "FAILED", "DESTROYING"],
  BUILDING: ["DEPLOYING", "FAILED", "DESTROYING"],
  DEPLOYING: ["RUNNING", "DEGRADED", "FAILED", "DESTROYING"],
  RUNNING: ["DEGRADED", "STOPPED", "DESTROYING", "FAILED"],
  DEGRADED: ["RUNNING", "STOPPED", "FAILED", "DESTROYING"],
  STOPPED: ["QUEUED", "DEPLOYING", "DESTROYING"],
  FAILED: ["QUEUED", "DEPLOYING", "DESTROYING"],
  DESTROYING: ["DESTROYED", "FAILED"],
  DESTROYED: [],
};

/**
 * {@link PreviewStatus} display metadata for the dashboard.
 */
export const PREVIEW_STATUS_DISPLAY: Readonly<
  Record<PreviewStatus, StatusDisplay>
> = {
  QUEUED: { label: "Queued", color: "neutral", isActive: true },
  BUILDING: { label: "Building", color: "info", isActive: true },
  DEPLOYING: { label: "Deploying", color: "info", isActive: true },
  RUNNING: { label: "Running", color: "success", isActive: true },
  DEGRADED: { label: "Degraded", color: "warning", isActive: true },
  STOPPED: { label: "Stopped", color: "neutral", isActive: false },
  FAILED: { label: "Failed", color: "danger", isActive: false },
  DESTROYING: { label: "Destroying", color: "warning", isActive: true },
  DESTROYED: { label: "Destroyed", color: "neutral", isActive: false },
};

/**
 * Terminal {@link PreviewStatus} values (no outgoing transitions).
 */
const PREVIEW_TERMINAL: ReadonlySet<PreviewStatus> = new Set<PreviewStatus>([
  "DESTROYED",
]);

// ─────────────────────────────────────────────────────────────────────────────
// Deployment state machine
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Allowed {@link DeploymentStatus} transitions.
 *
 * QUEUED → BUILDING → DEPLOYING → SUCCEEDED, with FAILED/CANCELLED reachable
 * from any non-terminal state. SUCCEEDED/FAILED/CANCELLED are terminal.
 */
export const DEPLOYMENT_TRANSITIONS: Readonly<
  Record<DeploymentStatus, readonly DeploymentStatus[]>
> = {
  QUEUED: ["BUILDING", "DEPLOYING", "FAILED", "CANCELLED"],
  BUILDING: ["DEPLOYING", "FAILED", "CANCELLED"],
  DEPLOYING: ["SUCCEEDED", "FAILED", "CANCELLED"],
  SUCCEEDED: [],
  FAILED: [],
  CANCELLED: [],
};

/**
 * {@link DeploymentStatus} display metadata for the dashboard.
 */
export const DEPLOYMENT_STATUS_DISPLAY: Readonly<
  Record<DeploymentStatus, StatusDisplay>
> = {
  QUEUED: { label: "Queued", color: "neutral", isActive: true },
  BUILDING: { label: "Building", color: "info", isActive: true },
  DEPLOYING: { label: "Deploying", color: "info", isActive: true },
  SUCCEEDED: { label: "Succeeded", color: "success", isActive: false },
  FAILED: { label: "Failed", color: "danger", isActive: false },
  CANCELLED: { label: "Cancelled", color: "neutral", isActive: false },
};

/**
 * Terminal {@link DeploymentStatus} values (no outgoing transitions).
 */
const DEPLOYMENT_TERMINAL: ReadonlySet<DeploymentStatus> =
  new Set<DeploymentStatus>(["SUCCEEDED", "FAILED", "CANCELLED"]);

// ─────────────────────────────────────────────────────────────────────────────
// Generic helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Determine whether moving a preview from `from` to `to` is allowed.
 *
 * A no-op transition (`from === to`) is treated as allowed (idempotent writes).
 *
 * @param from - Current status.
 * @param to - Desired status.
 * @returns `true` if the transition is permitted.
 */
export function canTransitionPreview(
  from: PreviewStatus,
  to: PreviewStatus,
): boolean {
  if (from === to) return true;
  return PREVIEW_TRANSITIONS[from].includes(to);
}

/**
 * Determine whether moving a deployment from `from` to `to` is allowed.
 *
 * A no-op transition (`from === to`) is treated as allowed (idempotent writes).
 *
 * @param from - Current status.
 * @param to - Desired status.
 * @returns `true` if the transition is permitted.
 */
export function canTransitionDeployment(
  from: DeploymentStatus,
  to: DeploymentStatus,
): boolean {
  if (from === to) return true;
  return DEPLOYMENT_TRANSITIONS[from].includes(to);
}

/**
 * Every {@link PreviewStatus} from which a transition to `to` is legal
 * (including `to` itself, since a same-state write is idempotent). Use this to
 * turn a status write into an atomic compare-and-swap:
 * `updateMany({ where: { id, status: { in: previewFromsFor(to) } }, data: { status: to } })`
 * — a `count` of 0 means the row moved underneath you (lost the race).
 *
 * @param to - The desired target status.
 * @returns The set of source statuses that may legally reach `to`.
 */
export function previewFromsFor(to: PreviewStatus): PreviewStatus[] {
  const froms = (Object.keys(PREVIEW_TRANSITIONS) as PreviewStatus[]).filter((from) =>
    PREVIEW_TRANSITIONS[from].includes(to),
  );
  return [to, ...froms];
}

/**
 * Every {@link DeploymentStatus} from which a transition to `to` is legal
 * (including `to`). The deployment analogue of {@link previewFromsFor}.
 *
 * @param to - The desired target status.
 * @returns The set of source statuses that may legally reach `to`.
 */
export function deploymentFromsFor(to: DeploymentStatus): DeploymentStatus[] {
  const froms = (Object.keys(DEPLOYMENT_TRANSITIONS) as DeploymentStatus[]).filter((from) =>
    DEPLOYMENT_TRANSITIONS[from].includes(to),
  );
  return [to, ...froms];
}

/**
 * Whether a {@link PreviewStatus} is terminal (no further transitions).
 *
 * @param status - The status to check.
 * @returns `true` if terminal.
 */
export function isPreviewTerminal(status: PreviewStatus): boolean {
  return PREVIEW_TERMINAL.has(status);
}

/**
 * Whether a {@link DeploymentStatus} is terminal (no further transitions).
 *
 * @param status - The status to check.
 * @returns `true` if terminal.
 */
export function isDeploymentTerminal(status: DeploymentStatus): boolean {
  return DEPLOYMENT_TERMINAL.has(status);
}

/**
 * Get dashboard display metadata for a {@link PreviewStatus}.
 *
 * @param status - The status to describe.
 * @returns Its {@link StatusDisplay}.
 */
export function previewStatusDisplay(status: PreviewStatus): StatusDisplay {
  return PREVIEW_STATUS_DISPLAY[status];
}

/**
 * Get dashboard display metadata for a {@link DeploymentStatus}.
 *
 * @param status - The status to describe.
 * @returns Its {@link StatusDisplay}.
 */
export function deploymentStatusDisplay(
  status: DeploymentStatus,
): StatusDisplay {
  return DEPLOYMENT_STATUS_DISPLAY[status];
}
