"use client";

import * as React from "react";

import { NAV_ITEMS } from "@/components/layout/nav";

/**
 * Dev-only route pre-warmer.
 *
 * Next's dev server compiles each route on its FIRST request, so the first
 * click on a side tab pays a one-off compile (~1s even with Turbopack) while
 * warm navigations are ~60ms. This quietly fetches the other dashboard routes
 * in the background shortly after the dashboard mounts — staggered so it never
 * competes with what the user is actually doing — so by the time they click a
 * tab it's already compiled and the navigation is instant.
 *
 * It is a strict no-op in production (where routes are prebuilt and `<Link>`
 * prefetch already handles this), renders nothing, and only ever issues GETs to
 * same-origin route URLs.
 */
export function RoutePrewarm(): null {
  React.useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    if (typeof window === "undefined") return;

    // Warm every nav route, oldest-first. Runs once: the dashboard layout
    // persists across route changes, so this effect mounts a single time.
    const targets = NAV_ITEMS.map((n) => n.href);
    let i = 0;
    let timer: ReturnType<typeof setTimeout>;

    const warmNext = (): void => {
      const href = targets[i];
      i += 1;
      if (href === undefined) return;
      // A bare GET to the route URL is enough to make the dev server compile it;
      // the HTML response is discarded. Failures (auth redirect, abort) are fine.
      void fetch(href, {
        method: "GET",
        credentials: "same-origin",
        headers: { purpose: "prefetch" },
      }).catch(() => undefined);
      timer = setTimeout(warmNext, 700);
    };

    // Let the current page settle first, then warm the rest one at a time.
    timer = setTimeout(warmNext, 1200);
    return () => clearTimeout(timer);
  }, []);

  return null;
}
