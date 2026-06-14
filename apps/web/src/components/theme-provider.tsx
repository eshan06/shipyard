"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * App-wide theme provider (light/dark/system) built on `next-themes`.
 *
 * Wrap the app once near the root. Theme is persisted to `localStorage` and
 * applied as a `class` on `<html>` (matching our Tailwind `darkMode: "class"`).
 *
 * @param props - `next-themes` provider props (children + config).
 */
export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>): React.JSX.Element {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
