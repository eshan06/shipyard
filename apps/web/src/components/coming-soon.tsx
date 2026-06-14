"use client";

import * as React from "react";
import type { LucideIcon } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/states";

/** Props for {@link ComingSoon}. */
export interface ComingSoonProps {
  /** The page title. */
  title: string;
  /** Short description of what the page will do. */
  description: string;
  /** The icon to show in the placeholder. */
  icon: LucideIcon;
  /** The empty-state body text. */
  body: string;
}

/**
 * A polished placeholder page for routes a later wave will flesh out. Renders
 * the standard page header plus a "Coming soon" empty state, so navigation and
 * the build are complete today.
 */
export function ComingSoon({
  title,
  description,
  icon,
  body,
}: ComingSoonProps): React.JSX.Element {
  return (
    <div className="space-y-6">
      <PageHeader title={title} description={description} />
      <EmptyState
        icon={icon}
        title="Coming soon"
        description={body}
        className="py-20"
      />
    </div>
  );
}
