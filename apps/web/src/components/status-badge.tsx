import * as React from "react";

import {
  DEPLOYMENT_STATUS_DISPLAY,
  PREVIEW_STATUS_DISPLAY,
  type DeploymentStatus,
  type PreviewStatus,
  type ServiceStatus,
  type StatusColorToken,
  type StatusDisplay,
} from "@shipyard/core";

import { Badge, type BadgeProps } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

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

/** Map a core {@link StatusColorToken} to a {@link Badge} variant. */
const TOKEN_TO_VARIANT: Record<StatusColorToken, BadgeProps["variant"]> = {
  neutral: "muted",
  info: "info",
  success: "success",
  warning: "warning",
  danger: "destructive",
};

/** Map a token to the dot color used in the badge. */
const TOKEN_TO_DOT: Record<StatusColorToken, string> = {
  neutral: "bg-muted-foreground",
  info: "bg-info",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-destructive",
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
function resolveDisplay(
  status: string,
  kind: StatusKind,
): StatusDisplay {
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

/**
 * A status pill that renders the human label and themed color for a preview,
 * deployment, or service status — sourced from `@shipyard/core`'s display maps
 * mapped onto the dashboard color tokens. Active statuses pulse their dot.
 */
export function StatusBadge({
  status,
  kind,
  showDot = true,
  className,
}: StatusBadgeProps): React.JSX.Element {
  const display = resolveDisplay(String(status), kind);
  const variant = TOKEN_TO_VARIANT[display.color];

  return (
    <Badge variant={variant} className={cn("gap-1.5", className)}>
      {showDot ? (
        <span
          className={cn(
            "size-1.5 rounded-full",
            TOKEN_TO_DOT[display.color],
            display.isActive && "animate-pulse",
          )}
          aria-hidden
        />
      ) : null}
      {display.label}
    </Badge>
  );
}
