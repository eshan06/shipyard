"use client";

import * as React from "react";

import { AnalyticsProvider } from "@/components/analytics-provider";
import { AuthGuard } from "@/components/auth-guard";
import { CommandPaletteProvider } from "@/components/command-palette";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { RoutePrewarm } from "@/components/route-prewarm";

/**
 * The authenticated dashboard shell ("engineering terminal" redesign): a fixed
 * two-column app grid — persistent sidebar + a main column with the top bar and
 * a scrollable, dotted-grid content canvas. Wraps every dashboard route, guards
 * access, and hosts the global ⌘K command palette.
 *
 * @param props.children - The routed dashboard page.
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <AuthGuard>
      <AnalyticsProvider>
        <CommandPaletteProvider>
          <RoutePrewarm />
          <div className="app">
            <Sidebar />
            <div className="main">
              <Topbar />
              <div className="content">{children}</div>
            </div>
          </div>
        </CommandPaletteProvider>
      </AnalyticsProvider>
    </AuthGuard>
  );
}
