"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

import { NAV_ITEMS, isNavActive } from "./nav";

/** The Shipyard wordmark + anchor logo. */
function Wordmark(): React.JSX.Element {
  return (
    <Link
      href="/"
      className="flex items-center gap-2.5 px-2 text-lg font-semibold tracking-tight"
    >
      <span
        className="flex size-8 items-center justify-center rounded-lg bg-primary text-base text-primary-foreground shadow-sm"
        aria-hidden
      >
        ⚓
      </span>
      <span>Shipyard</span>
    </Link>
  );
}

/** Props for {@link SidebarNav}. */
interface SidebarNavProps {
  /** Called when a link is activated (used to close the mobile drawer). */
  onNavigate?: () => void;
}

/** The shared list of navigation links (used by desktop + mobile). */
export function SidebarNav({
  onNavigate,
}: SidebarNavProps): React.JSX.Element {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1" aria-label="Primary">
      {NAV_ITEMS.map((item) => {
        const active = isNavActive(item, pathname);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
            )}
          >
            <Icon className="size-4 shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * The desktop sidebar: the Shipyard wordmark, the primary navigation, and a
 * small footer note. Hidden below the `lg` breakpoint, where the {@link Topbar}
 * exposes a drawer instead.
 */
export function Sidebar(): React.JSX.Element {
  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r bg-card/40 lg:flex">
      <div className="flex h-16 items-center border-b px-4">
        <Wordmark />
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        <SidebarNav />
      </div>
      <div className="border-t p-4 text-xs text-muted-foreground">
        Preview environments, on demand.
      </div>
    </aside>
  );
}

export { Wordmark };
