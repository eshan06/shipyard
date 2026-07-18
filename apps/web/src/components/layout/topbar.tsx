"use client";

import { Bell, LogOut, Search } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import * as React from "react";
import { mutate } from "swr";

import { useCommandPalette } from "@/components/command-palette";
import { ANALYTICS_EVENTS, flushAnalytics, trackEvent } from "@/lib/analytics";
import { api } from "@/lib/api";
import { useMe, useNotifications } from "@/lib/hooks";
import { initials } from "@/lib/utils";

/** Derive the lowercase terminal-breadcrumb segment from the pathname. */
function crumbFor(pathname: string): string {
  if (pathname === "/") return "overview";
  return pathname.split("/").filter(Boolean)[0] ?? "overview";
}

/** Close-on-outside-click + Escape for a popover. */
function useOutside(
  ref: React.RefObject<HTMLElement | null>,
  onClose: () => void,
  active: boolean,
): void {
  React.useEffect(() => {
    if (!active) return;
    function h(e: MouseEvent): void {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function k(e: KeyboardEvent): void {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", h);
    document.addEventListener("keydown", k);
    return () => {
      document.removeEventListener("mousedown", h);
      document.removeEventListener("keydown", k);
    };
  }, [ref, onClose, active]);
}

/**
 * The top bar: a terminal breadcrumb with a blinking caret, a ⌘K search/command
 * bar, a truthful active-team indicator, a notifications panel, and a user menu
 * with a working "Sign out" action.
 */
export function Topbar(): React.JSX.Element {
  const pathname = usePathname();
  const router = useRouter();
  const cmd = useCommandPalette();
  const me = useMe();
  const notifs = useNotifications();

  const [notifOpen, setNotifOpen] = React.useState(false);
  const [userOpen, setUserOpen] = React.useState(false);
  const notifRef = React.useRef<HTMLDivElement>(null);
  const userRef = React.useRef<HTMLDivElement>(null);
  useOutside(notifRef, () => setNotifOpen(false), notifOpen);
  useOutside(userRef, () => setUserOpen(false), userOpen);

  // Real active team from the current user's memberships (no fabricated data).
  const team = me.data?.memberships[0]?.team;
  const teamName = team?.name ?? null;
  const teamInitials = teamName ? teamName.slice(0, 2).toUpperCase() : "";
  const userName = me.data?.user.name ?? null;
  const userEmail = me.data?.user.email ?? null;
  const userInitials = initials(userName ?? userEmail);
  const items = notifs.data?.data ?? [];
  const hasUnread = items.some((n) => n.readAt === null);

  const onSignOut = React.useCallback(async (): Promise<void> => {
    setUserOpen(false);
    // Record + flush the event *before* the session cookie is cleared (the
    // telemetry route is auth-gated, so a buffered post-logout event would 401).
    trackEvent(ANALYTICS_EVENTS.signedOut);
    await flushAnalytics().catch(() => undefined);
    await api.logout().catch(() => undefined);
    // Clear the cached identity so no stale user leaks into the next session.
    await mutate("/me", undefined, { revalidate: false });
    router.replace("/login");
  }, [router]);

  return (
    <header className="topbar">
      <div className="crumb">
        <span className="tilde">~/</span>
        <span className="seg">{crumbFor(pathname)}</span>
        <span className="caret" />
      </div>
      <div className="topbar-right">
        <button className="kbar" onClick={cmd.open}>
          <Search size={15} />
          <span>Search or jump to…</span>
          <span className="kbar-hint">
            <span className="kbd">⌘K</span>
          </span>
        </button>

        {teamName ? (
          <div className="teamswitch static" title={teamName}>
            <span className="ts-avatar">{teamInitials}</span>
            <span className="ts-name">{teamName}</span>
          </div>
        ) : null}

        <div ref={notifRef} style={{ position: "relative" }}>
          <button className="iconbtn" onClick={() => setNotifOpen((o) => !o)}>
            <Bell size={16} />
            {hasUnread ? <span className="ind" /> : null}
          </button>
          {notifOpen ? (
            <div className="menu notif">
              <div className="menu-label">Notifications</div>
              {items.length === 0 ? (
                <div className="notif-item">
                  <div className="notif-tx" style={{ color: "var(--tx-dim)" }}>
                    You&apos;re all caught up.
                  </div>
                </div>
              ) : (
                items.slice(0, 6).map((n) => (
                  <div key={n.id} className="notif-item">
                    <div
                      className="notif-ic"
                      style={{
                        background: "var(--panel-3)",
                        color: "var(--tx-mid)",
                        border: "1px solid var(--line)",
                      }}
                    >
                      <Bell size={15} />
                    </div>
                    <div>
                      <div className="notif-tx">
                        <b>{n.title}</b>
                        {n.body ? ` — ${n.body}` : ""}
                      </div>
                      <div className="notif-time">
                        {n.createdAt.slice(0, 10)}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : null}
        </div>

        <div ref={userRef} style={{ position: "relative" }}>
          <button
            className="avatar"
            style={{ border: "none", padding: 0, font: "inherit" }}
            onClick={() => setUserOpen((o) => !o)}
            aria-label="User menu"
            aria-haspopup="menu"
            aria-expanded={userOpen}
          >
            {userInitials}
          </button>
          {userOpen ? (
            <div
              className="menu"
              style={{ top: "calc(100% + 6px)", right: 0, minWidth: 220 }}
            >
              <div className="menu-label">Signed in</div>
              <div className="menu-item" style={{ cursor: "default" }}>
                <div style={{ minWidth: 0 }}>
                  {userName ? (
                    <div style={{ fontSize: 13, color: "var(--tx)" }}>
                      {userName}
                    </div>
                  ) : null}
                  {userEmail ? (
                    <div
                      className="mono"
                      style={{
                        fontSize: 11,
                        color: "var(--tx-dim)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {userEmail}
                    </div>
                  ) : null}
                </div>
              </div>
              <div className="menu-sep" />
              <div
                className="menu-item danger"
                role="menuitem"
                onClick={() => void onSignOut()}
              >
                <LogOut size={15} />
                <span>Sign out</span>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
