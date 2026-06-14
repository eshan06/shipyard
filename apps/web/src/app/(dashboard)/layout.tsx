"use client";

import { usePathname } from "next/navigation";
import * as React from "react";

import { AuthGuard } from "@/components/auth-guard";
import { NAV_ITEMS, isNavActive } from "@/components/layout/nav";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";

/** Derive a human page title from the current pathname. */
function titleForPath(pathname: string): string {
  // Detail routes get a generic-but-sensible title.
  if (pathname.startsWith("/previews/") && pathname !== "/previews") {
    return "Preview";
  }
  if (pathname.startsWith("/deployments/") && pathname !== "/deployments") {
    return "Deployment";
  }
  if (pathname.startsWith("/projects/") && pathname !== "/projects") {
    return "Project";
  }
  const match = NAV_ITEMS.find((item) => isNavActive(item, pathname));
  return match?.label ?? "Shipyard";
}

/**
 * The authenticated dashboard layout: a persistent sidebar (desktop) + top bar,
 * wrapping every dashboard route. Guards access via {@link AuthGuard} and scrolls
 * the main content area independently of the chrome.
 *
 * @param props.children - The routed dashboard page.
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const pathname = usePathname();
  const title = titleForPath(pathname);

  return (
    <AuthGuard>
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar title={title} />
          <main className="flex-1 overflow-x-hidden px-4 py-6 md:px-8 md:py-8">
            <div className="mx-auto w-full max-w-7xl animate-fade-in">
              {children}
            </div>
          </main>
        </div>
      </div>
    </AuthGuard>
  );
}
