"use client";

import { usePathname } from "next/navigation";
import * as React from "react";

import {
  ANALYTICS_EVENTS,
  flushAnalytics,
  flushAnalyticsBeacon,
  trackEvent,
} from "@/lib/analytics";

/** How often buffered events are flushed to the API while the tab is open. */
const FLUSH_INTERVAL_MS = 15_000;

/**
 * Drives the product-analytics lifecycle for the authenticated app:
 *  - records a `page_viewed` event on every client-side route change,
 *  - flushes the event buffer on an interval, and
 *  - flushes via `navigator.sendBeacon` when the tab is hidden/unloaded so the
 *    last events aren't lost.
 *
 * Mount once inside the authenticated layout (events post to an auth-gated
 * route, so anonymous pages are intentionally not instrumented).
 *
 * @param props.children - The app subtree.
 */
export function AnalyticsProvider({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const pathname = usePathname();

  React.useEffect(() => {
    if (!pathname) return;
    trackEvent(ANALYTICS_EVENTS.pageViewed, { path: pathname });
  }, [pathname]);

  React.useEffect(() => {
    const interval = window.setInterval(() => {
      void flushAnalytics();
    }, FLUSH_INTERVAL_MS);

    const onVisibility = (): void => {
      if (document.visibilityState === "hidden") flushAnalyticsBeacon();
    };
    const onPageHide = (): void => flushAnalyticsBeacon();

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      void flushAnalytics();
    };
  }, []);

  return <>{children}</>;
}
