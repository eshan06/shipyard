"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Toaster as SonnerToaster } from "sonner";

/**
 * App toast host (sonner), theme-aware via `next-themes`.
 *
 * Mount once near the app root. Trigger toasts anywhere with
 * `import { toast } from "sonner"`.
 */
export function Toaster(): React.JSX.Element {
  const { resolvedTheme } = useTheme();
  return (
    <SonnerToaster
      theme={(resolvedTheme as "light" | "dark" | undefined) ?? "system"}
      position="bottom-right"
      richColors
      closeButton
      toastOptions={{
        classNames: {
          toast:
            "group rounded-lg border border-border bg-popover text-popover-foreground shadow-lg",
        },
      }}
    />
  );
}
