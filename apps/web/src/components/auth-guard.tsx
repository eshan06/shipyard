"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { useMe } from "@/lib/hooks";

/** A full-screen branded splash shown while auth is resolving. */
function Splash(): React.JSX.Element {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
      <div className="flex items-center gap-3 text-xl font-semibold tracking-tight">
        <span
          className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground"
          aria-hidden
        >
          ⚓
        </span>
        Shipyard
      </div>
      <div
        className="size-6 animate-spin rounded-full border-2 border-muted border-t-primary"
        role="status"
        aria-label="Loading"
      />
    </div>
  );
}

/**
 * Client-side auth guard for the dashboard.
 *
 * Calls {@link useMe}; while loading it renders a splash. On a 401 (or any auth
 * failure) it redirects to `/login`. Once authenticated it renders `children`.
 *
 * @param props.children - The protected subtree.
 */
export function AuthGuard({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const router = useRouter();
  const { data, error, isLoading } = useMe();

  React.useEffect(() => {
    if (error) router.replace("/login");
  }, [error, router]);

  if (isLoading) return <Splash />;
  if (error || !data) return <Splash />;

  return <>{children}</>;
}
