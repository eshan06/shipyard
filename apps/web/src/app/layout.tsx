import { JetBrains_Mono, Space_Grotesk } from "next/font/google";

import { Providers } from "@/components/providers";

import type { Metadata, Viewport } from "next";


import "./globals.css";
import "./shipyard.css";

/**
 * Self-hosted fonts via `next/font` (bundled at build, no runtime Google CDN
 * dependency / IP leak / CSP conflict). The CSS variables feed `--sans` /
 * `--mono` in `shipyard.css`.
 */
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-space-grotesk",
  display: "swap",
});
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

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
    <html
      lang="en"
      className={`dark ${spaceGrotesk.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
