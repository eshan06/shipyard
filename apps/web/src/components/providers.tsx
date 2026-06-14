"use client";

import * as React from "react";
import { SWRConfig } from "swr";

import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";

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
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <SWRConfig
        value={{
          dedupingInterval: 2000,
          revalidateOnReconnect: true,
          keepPreviousData: true,
        }}
      >
        <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
      </SWRConfig>
      <Toaster />
    </ThemeProvider>
  );
}
