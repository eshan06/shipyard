import * as React from "react";

import { Skeleton } from "@/components/ui/skeleton";

/**
 * Route-segment loading UI for every dashboard page.
 *
 * Next renders this instantly when you navigate to a dashboard tab — while the
 * route compiles (dev) or its data loads (prod) — so a tab click feels
 * immediate instead of leaving the previous page frozen. Individual routes can
 * still override this with their own `loading.tsx`.
 */
export default function DashboardLoading(): React.JSX.Element {
  return (
    <div className="page" aria-busy="true" aria-label="Loading">
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-7 w-52" />
          <Skeleton className="h-4 w-80" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
        <Skeleton className="h-72 w-full" />
      </div>
    </div>
  );
}
