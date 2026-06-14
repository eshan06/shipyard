import type { Metadata, Viewport } from "next";

import { Providers } from "@/components/providers";

import "./globals.css";

/** Static document metadata for the dashboard. */
export const metadata: Metadata = {
  title: {
    default: "Shipyard",
    template: "%s · Shipyard",
  },
  description:
    "Shipyard — disposable, full-stack preview environments for every pull request.",
};

/** Viewport + theme color configuration. */
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0e1a" },
  ],
};

/**
 * The root layout: sets up the HTML shell, wires the global client providers
 * (theme, tooltips, toasts, SWR), and applies the base font stack. Uses
 * `suppressHydrationWarning` because `next-themes` mutates the `class` on
 * `<html>` before React hydrates.
 *
 * @param props.children - The routed page subtree.
 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans text-foreground">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
