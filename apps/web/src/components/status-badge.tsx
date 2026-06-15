import * as React from "react";

import {
  DEPLOYMENT_STATUS_DISPLAY,
  PREVIEW_STATUS_DISPLAY,
  type StatusColorToken,
  type StatusDisplay,
} from "@shipyard/core/status";

import { cn } from "@/lib/utils";

import type {
  DeploymentStatus,
  PreviewStatus,
  ServiceStatus,
} from "@shipyard/core";

/**
 * Service-status display metadata. `@shipyard/core` ships preview/deployment
 * display maps; services are mapped here using the same token palette so the
 * dashboard renders all three kinds consistently.
 */
const SERVICE_STATUS_DISPLAY: Readonly<Record<ServiceStatus, StatusDisplay>> = {
  PENDING: { label: "Pending", color: "neutral", isActive: true },
  STARTING: { label: "Starting", color: "info", isActive: true },
  HEALTHY: { label: "Healthy", color: "success", isActive: true },
  UNHEALTHY: { label: "Unhealthy", color: "warning", isActive: true },
  STOPPED: { label: "Stopped", color: "neutral", isActive: false },
  CRASHED: { label: "Crashed", color: "danger", isActive: false },
};

/** Design-system status tone (drives the `badge b-*` classes + `--*` colors). */
export type StatusTone = "green" | "blue" | "red" | "amber" | "gray";

/** Map a core {@link StatusColorToken} to a design-system tone. */
const TOKEN_TO_TONE: Record<StatusColorToken, StatusTone> = {
  neutral: "gray",
  info: "blue",
  success: "green",
  warning: "amber",
  danger: "red",
};

/** What kind of status the {@link StatusBadge} should resolve. */
export type StatusKind = "preview" | "deployment" | "service";

/** Props for {@link StatusBadge}. */
export interface StatusBadgeProps {
  /** The raw status value (its type matches `kind`). */
  status: PreviewStatus | DeploymentStatus | ServiceStatus | string;
  /** Which display map to resolve the status against. */
  kind: StatusKind;
  /** Render a small leading status dot (default true). */
  showDot?: boolean;
  /** Extra classes. */
  className?: string;
}

/** Resolve the display metadata for a status + kind. */
function resolveDisplay(status: string, kind: StatusKind): StatusDisplay {
  if (kind === "preview" && status in PREVIEW_STATUS_DISPLAY) {
    return PREVIEW_STATUS_DISPLAY[status as PreviewStatus];
  }
  if (kind === "deployment" && status in DEPLOYMENT_STATUS_DISPLAY) {
    return DEPLOYMENT_STATUS_DISPLAY[status as DeploymentStatus];
  }
  if (kind === "service" && status in SERVICE_STATUS_DISPLAY) {
    return SERVICE_STATUS_DISPLAY[status as ServiceStatus];
  }
  return { label: status, color: "neutral", isActive: false };
}

/** The design tone (`green`/`blue`/…) for a status — e.g. for card stripes. */
export function statusTone(
  status: PreviewStatus | DeploymentStatus | ServiceStatus | string,
  kind: StatusKind,
): StatusTone {
  return TOKEN_TO_TONE[resolveDisplay(String(status), kind).color];
}

/** The CSS color var (`var(--green)` …) for a status — e.g. a left stripe. */
export function statusColorVar(
  status: PreviewStatus | DeploymentStatus | ServiceStatus | string,
  kind: StatusKind,
): string {
  return `var(--${statusTone(status, kind)})`;
}

/**
 * A status pill in the "engineering terminal" design language: a mono label +
 * tinted soft background/border, with a colored dot that pulses for live states
 * (building/deploying/running/healthy). Sourced from `@shipyard/core`'s display
 * maps so labels + semantics stay the single source of truth.
 */
export function StatusBadge({
  status,
  kind,
  showDot = true,
  className,
}: StatusBadgeProps): React.JSX.Element {
  const display = resolveDisplay(String(status), kind);
  const tone = TOKEN_TO_TONE[display.color];
  const live = display.isActive && (tone === "green" || tone === "blue");

  return (
    <span className={cn("badge", `b-${tone}`, live && "live", className)}>
      {showDot ? <span className="bdot" /> : null}
      {display.label}
    </span>
  );
}
