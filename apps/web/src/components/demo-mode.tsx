"use client";

/**
 * Demo-mode bootstrap + badge.
 *
 * The backend is installed at **module scope** (not in an effect) so the
 * `fetch`/`EventSource` patches are in place before React renders and any SWR
 * hook fires its first request. In a normal build `IS_DEMO` is a compile-time
 * `false`, so this whole file's runtime work is skipped and the demo dataset
 * is tree-shaken out of the bundle.
 *
 * @module
 */

import { Github } from "lucide-react";
import * as React from "react";

import { IS_DEMO } from "@/demo";
// Aliased to `@/demo/backend.stub` (a no-op) unless NEXT_PUBLIC_DEMO=true, so
// the demo dataset never reaches a production bundle. See next.config.mjs.
import { installDemoBackend } from "@/demo/backend";

if (IS_DEMO) installDemoBackend();

/** Public repo shown in the demo badge. */
const REPO_URL = "https://github.com/eshan06/shipyard";

/**
 * A small fixed badge marking the build as a demo and linking to the source.
 *
 * Renders nothing outside demo builds. Anchored bottom-LEFT: toasts stack in
 * the bottom-right, and a badge there would sit underneath every one of them.
 */
export function DemoBadge(): React.JSX.Element | null {
  if (!IS_DEMO) return null;

  return (
    <div className="pointer-events-none fixed bottom-4 left-4 z-50 print:hidden">
      <a
        href={REPO_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="pointer-events-auto flex items-center gap-2.5 rounded-full border border-border/80 bg-card/95 px-3.5 py-2 text-xs shadow-lg backdrop-blur transition-colors hover:border-primary/60 hover:bg-card"
      >
        <span className="relative flex size-2">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60" />
          <span className="relative inline-flex size-2 rounded-full bg-success" />
        </span>
        <span className="font-medium">Interactive demo</span>
        <span className="text-muted-foreground">· simulated data</span>
        <Github className="size-3.5 text-muted-foreground" />
      </a>
    </div>
  );
}
