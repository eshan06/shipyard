"use client";

import { Anchor } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";

import { NAV_ITEMS, isNavActive } from "@/components/layout/nav";
import { useDeployments, usePreviews } from "@/lib/hooks";

/**
 * The redesigned ("engineering terminal") sidebar: brand mark + wordmark, a
 * WORKSPACE nav group with live counts for Previews/Builds, and a footer status
 * line. The active route gets the magenta soft background + indicator bar.
 */
export function Sidebar(): React.JSX.Element {
  const pathname = usePathname();
  const previews = usePreviews({ limit: 100 });
  const failed = useDeployments({ status: "FAILED", limit: 100 });

  const counts: Record<string, number | undefined> = {
    "/previews": previews.data?.data.length,
    "/builds": failed.data?.data.length,
  };

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">
          <Anchor size={20} strokeWidth={1.9} />
        </div>
        <div className="brand-text">
          <span className="brand-name">Shipyard</span>
          <span className="brand-sub">Preview Envs</span>
        </div>
      </div>

      <nav className="nav">
        <div className="nav-label">Workspace</div>
        {NAV_ITEMS.map((item) => {
          const active = isNavActive(item, pathname);
          const Icon = item.icon;
          const count = counts[item.href];
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-item${active ? " active" : ""}`}
            >
              <Icon size={17} />
              <span>{item.label}</span>
              {count != null ? (
                <span className="nav-count tnum">{count}</span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div className="sidebar-foot">
        <div className="sysline">
          <span
            className="bdot pulse-dot"
            style={{
              background: "var(--green)",
              color: "var(--green)",
              width: 7,
              height: 7,
              borderRadius: "50%",
              display: "inline-block",
            }}
          />
          All systems operational
        </div>
        <div className="sysline-sub">region · iad1 · v2.8.0</div>
      </div>
    </aside>
  );
}
