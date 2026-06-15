"use client";

import * as React from "react";
import { SWRConfig } from "swr";

import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

/**
 * Root client providers: theme (next-themes), Radix tooltips, the sonner toast
 * host, and a global SWR config (dedupe + sane revalidation). Wrap the app body
 * once in the root layout.
 *
 * @param props.children - The app subtree.
 */
export function Providers({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      forcedTheme="dark"
      enableSystem={false}
      disableTransitionOnChange
    >
      <SWRConfig
        value={{
          dedupingInterval: 2000,
          revalidateOnReconnect: true,
          keepPreviousData: true,
          // Don't refetch every active hook each time the window regains focus
          // (alt-tabbing back fired a burst of requests that felt laggy). Data
          // still revalidates on mount, navigation, and reconnect; live views
          // (logs/status) use their own SSE streams, not focus polling.
          revalidateOnFocus: false,
        }}
      >
        <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
      </SWRConfig>
      <Toaster />
    </ThemeProvider>
  );
}
