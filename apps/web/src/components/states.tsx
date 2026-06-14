"use client";

import * as React from "react";
import { AlertTriangle, Inbox, RefreshCw } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** Props for {@link EmptyState}. */
export interface EmptyStateProps {
  /** Leading icon (defaults to an inbox). */
  icon?: LucideIcon;
  /** Primary heading. */
  title: string;
  /** Supporting description. */
  description?: string;
  /** Optional call-to-action node (e.g. a button). */
  action?: React.ReactNode;
  /** Extra classes for the container. */
  className?: string;
}

/**
 * A centered empty-state placeholder for lists/sections with no data, with an
 * icon, title, description, and optional CTA.
 */
export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
}: EmptyStateProps): React.JSX.Element {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-dashed border-border px-6 py-14 text-center",
        className,
      )}
    >
      <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="size-6" />
      </div>
      <h3 className="text-sm font-semibold">{title}</h3>
      {description ? (
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

/** Props for {@link ErrorState}. */
export interface ErrorStateProps {
  /** Heading (defaults to a generic failure message). */
  title?: string;
  /** Detail message — typically `error.message`. */
  description?: string;
  /** Called when the user clicks "Try again" (omit to hide the button). */
  onRetry?: () => void;
  /** Extra classes for the container. */
  className?: string;
}

/**
 * A centered error-state placeholder with an optional retry action. Pass the
 * caught error's message as `description`.
 */
export function ErrorState({
  title = "Something went wrong",
  description,
  onRetry,
  className,
}: ErrorStateProps): React.JSX.Element {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-dashed border-destructive/40 bg-destructive/5 px-6 py-14 text-center",
        className,
      )}
    >
      <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertTriangle className="size-6" />
      </div>
      <h3 className="text-sm font-semibold">{title}</h3>
      {description ? (
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          {description}
        </p>
      ) : null}
      {onRetry ? (
        <Button variant="outline" size="sm" className="mt-5" onClick={onRetry}>
          <RefreshCw className="size-4" />
          Try again
        </Button>
      ) : null}
    </div>
  );
}

/** Props for {@link LoadingSkeleton}. */
export interface LoadingSkeletonProps {
  /** Number of skeleton rows to render (default 3). */
  rows?: number;
  /** Skeleton style: stacked bars or a card grid. */
  variant?: "rows" | "cards";
  /** Extra classes for the container. */
  className?: string;
}

/**
 * A reusable loading placeholder rendering either stacked bars or a grid of
 * card skeletons while data is fetching.
 */
export function LoadingSkeleton({
  rows = 3,
  variant = "rows",
  className,
}: LoadingSkeletonProps): React.JSX.Element {
  if (variant === "cards") {
    return (
      <div
        className={cn(
          "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3",
          className,
        )}
      >
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="rounded-lg border p-5">
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <Skeleton className="mt-4 h-4 w-full" />
            <Skeleton className="mt-2 h-4 w-2/3" />
            <Skeleton className="mt-5 h-8 w-24" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 rounded-lg border p-4"
        >
          <Skeleton className="size-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
      ))}
    </div>
  );
}
