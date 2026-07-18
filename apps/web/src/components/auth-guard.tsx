"use client";

import { usePathname, useRouter } from "next/navigation";
import * as React from "react";

import { ApiError } from "@/lib/api";
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
 * A full-screen retryable panel for transient `/me` failures (network blip,
 * 500, API restart). Unlike a 401 this does NOT log the user out — their
 * session may still be valid — so we offer a retry instead of bouncing them to
 * `/login` and discarding their deep link.
 */
function ApiUnreachable({
  onRetry,
}: {
  onRetry: () => void;
}): React.JSX.Element {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
      <div className="flex items-center gap-3 text-xl font-semibold tracking-tight">
        <span
          className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground"
          aria-hidden
        >
          ⚓
        </span>
        Shipyard
      </div>
      <div className="panel" style={{ padding: "20px 22px", maxWidth: 360 }}>
        <div style={{ fontSize: 14.5, fontWeight: 600, marginBottom: 6 }}>
          Couldn&apos;t reach the API
        </div>
        <div
          className="mono"
          style={{
            fontSize: 12,
            color: "var(--tx-dim)",
            marginBottom: 16,
          }}
        >
          The dashboard couldn&apos;t load your session. This is usually
          temporary.
        </div>
        <button className="btn btn-primary" onClick={onRetry}>
          Retry
        </button>
      </div>
    </div>
  );
}

/**
 * Client-side auth guard for the dashboard.
 *
 * Calls {@link useMe}; while loading it renders a splash. On a **401** it
 * redirects to `/login`, carrying a `?next=<pathname>` param so the deep link
 * is honoured after sign-in. On any **other** error (network/5xx) it renders a
 * retryable panel instead of logging the user out. Once authenticated it
 * renders `children`.
 *
 * @param props.children - The protected subtree.
 */
export function AuthGuard({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const router = useRouter();
  const pathname = usePathname();
  const { data, error, isLoading, mutate } = useMe();

  const isUnauthorized = error instanceof ApiError && error.isUnauthorized;

  React.useEffect(() => {
    if (!isUnauthorized) return;
    const next =
      pathname && pathname !== "/"
        ? `?next=${encodeURIComponent(pathname)}`
        : "";
    router.replace(`/login${next}`);
  }, [isUnauthorized, pathname, router]);

  if (isLoading) return <Splash />;
  // 401 → redirecting to /login (show splash meanwhile).
  if (isUnauthorized) return <Splash />;
  // Transient failure → offer retry instead of a logout bounce.
  if (error) return <ApiUnreachable onRetry={() => void mutate()} />;
  if (!data) return <Splash />;

  return <>{children}</>;
}
