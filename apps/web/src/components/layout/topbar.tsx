"use client";

import { Bell, Check, ChevronsUpDown, Moon, Plus, Search } from "lucide-react";
import { usePathname } from "next/navigation";
import * as React from "react";

import { useCommandPalette } from "@/components/command-palette";
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
 * The redesigned top bar: a terminal breadcrumb with a blinking caret, a ⌘K
 * search/command bar, a team switcher, a notifications panel, a (decorative)
 * theme toggle, and the user avatar.
 */
export function Topbar(): React.JSX.Element {
  const pathname = usePathname();
  const cmd = useCommandPalette();
  const me = useMe();
  const notifs = useNotifications();

  const [teamOpen, setTeamOpen] = React.useState(false);
  const [notifOpen, setNotifOpen] = React.useState(false);
  const teamRef = React.useRef<HTMLDivElement>(null);
  const notifRef = React.useRef<HTMLDivElement>(null);
  useOutside(teamRef, () => setTeamOpen(false), teamOpen);
  useOutside(notifRef, () => setNotifOpen(false), notifOpen);

  const teamName = me.data?.memberships[0]?.team?.name ?? "Acme";
  const teamInitials = teamName.slice(0, 2).toUpperCase();
  const userInitials = initials(me.data?.user.name ?? me.data?.user.email);
  const items = notifs.data?.data ?? [];
  const hasUnread = items.some((n) => n.readAt === null);

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

        <div
          ref={teamRef}
          style={{ position: "relative", display: "inline-flex" }}
        >
          <button className="teamswitch" onClick={() => setTeamOpen((o) => !o)}>
            <span className="ts-avatar">{teamInitials}</span>
            <span className="ts-name">{teamName}</span>
            <ChevronsUpDown size={14} />
          </button>
          {teamOpen ? (
            <div
              className="menu"
              style={{ top: "calc(100% + 6px)", right: 0, minWidth: 210 }}
            >
              <div className="menu-label">Teams</div>
              <div className="menu-item active">
                <span className="ts-avatar" style={{ width: 20, height: 20 }}>
                  {teamInitials}
                </span>
                <span>{teamName}</span>
                <Check size={15} className="chk" />
              </div>
              <div className="menu-sep" />
              <div className="menu-item">
                <Plus size={15} />
                <span>Create team</span>
              </div>
            </div>
          ) : null}
        </div>

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

        <button className="iconbtn" title="Theme">
          <Moon size={16} />
        </button>
        <div className="avatar">{userInitials}</div>
      </div>
    </header>
  );
}
