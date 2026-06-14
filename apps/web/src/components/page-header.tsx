import * as React from "react";

import { cn } from "@/lib/utils";

/** Props for {@link PageHeader}. */
export interface PageHeaderProps {
  /** The section heading. */
  title: string;
  /** Supporting description below the title. */
  description?: string;
  /** Optional actions rendered on the right (buttons, filters, etc.). */
  actions?: React.ReactNode;
  /** Extra classes. */
  className?: string;
}

/**
 * A consistent in-page section header: a title, optional description, and an
 * optional right-aligned action cluster. Wraps responsively on small screens.
 */
export function PageHeader({
  title,
  description,
  actions,
  className,
}: PageHeaderProps): React.JSX.Element {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div className="space-y-1">
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}
