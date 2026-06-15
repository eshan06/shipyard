"use client";

import {
  CircleDollarSign,
  KeyRound,
  Layers,
  Plus,
  RefreshCw,
  Search,
  type LucideIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import { NAV_ITEMS } from "@/components/layout/nav";
import { usePreviews } from "@/lib/hooks";

interface CmdItem {
  id: string;
  name: string;
  desc: string;
  icon: LucideIcon;
  to: string;
  group: "Navigation" | "Actions" | "Previews";
  hint: string;
}

interface CommandPaletteContextValue {
  open: () => void;
}

const CommandPaletteContext =
  React.createContext<CommandPaletteContextValue | null>(null);

/** Open the global command palette from anywhere under the provider. */
export function useCommandPalette(): CommandPaletteContextValue {
  const ctx = React.useContext(CommandPaletteContext);
  if (!ctx) throw new Error("useCommandPalette outside provider");
  return ctx;
}

const ACTIONS: readonly CmdItem[] = [
  {
    id: "new-preview",
    name: "New preview",
    desc: "Spin up a preview env",
    icon: Plus,
    to: "/previews",
    group: "Actions",
    hint: "→",
  },
  {
    id: "retry",
    name: "Retry failed builds",
    desc: "Re-run failed container builds",
    icon: RefreshCw,
    to: "/builds",
    group: "Actions",
    hint: "→",
  },
  {
    id: "tokens",
    name: "Create API token",
    desc: "Programmatic access",
    icon: KeyRound,
    to: "/settings/team",
    group: "Actions",
    hint: "→",
  },
  {
    id: "costs",
    name: "View this month's spend",
    desc: "Billing overview",
    icon: CircleDollarSign,
    to: "/costs",
    group: "Actions",
    hint: "→",
  },
];

function Palette({ onClose }: { onClose: () => void }): React.JSX.Element {
  const router = useRouter();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [q, setQ] = React.useState("");
  const [sel, setSel] = React.useState(0);
  const previews = usePreviews({ limit: 6 });

  React.useEffect(() => {
    inputRef.current?.focus();
  }, []);
  React.useEffect(() => {
    setSel(0);
  }, [q]);

  const navItems: CmdItem[] = NAV_ITEMS.map((n) => ({
    id: `nav-${n.href}`,
    name: n.label,
    desc: `Go to ${n.label}`,
    icon: n.icon,
    to: n.href,
    group: "Navigation",
    hint: "↵",
  }));
  const previewItems: CmdItem[] = (previews.data?.data ?? [])
    .slice(0, 6)
    .map((p) => ({
      id: `pv-${p.id}`,
      name: `PR #${p.pullRequest?.number ?? "—"} ${p.slug}`,
      desc: `${p.project.name} · ${p.statusDisplay.label}`,
      icon: Layers,
      to: `/previews/${p.id}`,
      group: "Previews",
      hint: "→",
    }));

  const all = [...navItems, ...ACTIONS, ...previewItems];
  const ql = q.trim().toLowerCase();
  const filtered = ql
    ? all.filter((i) => (i.name + i.desc).toLowerCase().includes(ql))
    : all;
  const groups = (["Navigation", "Actions", "Previews"] as const)
    .map((label) => ({ label, items: filtered.filter((i) => i.group === label) }))
    .filter((g) => g.items.length);
  const flat = groups.flatMap((g) => g.items);

  const choose = React.useCallback(
    (item: CmdItem | undefined) => {
      if (!item) return;
      router.push(item.to);
      onClose();
    },
    [router, onClose],
  );

  function onKey(e: React.KeyboardEvent): void {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSel((s) => Math.min(s + 1, flat.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSel((s) => Math.max(s - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      choose(flat[sel]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  }

  let idx = -1;
  return (
    <div
      className="overlay"
      onMouseDown={(e) => {
        if ((e.target as HTMLElement).classList.contains("overlay")) onClose();
      }}
    >
      <div className="cmd" onKeyDown={onKey}>
        <div className="cmd-input">
          <Search size={18} />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search pages, previews, actions…"
          />
          <span className="esc">ESC</span>
        </div>
        <div className="cmd-list">
          {flat.length === 0 ? (
            <div className="empty" style={{ padding: "36px 0" }}>
              No results for &ldquo;{q}&rdquo;.
            </div>
          ) : null}
          {groups.map((g) => (
            <div key={g.label}>
              <div className="cmd-grp">{g.label}</div>
              {g.items.map((item) => {
                idx += 1;
                const myIdx = idx;
                const Icon = item.icon;
                return (
                  <div
                    key={item.id}
                    className={`cmd-item${myIdx === sel ? " sel" : ""}`}
                    onMouseEnter={() => setSel(myIdx)}
                    onClick={() => choose(item)}
                  >
                    <span className="ci-ic">
                      <Icon size={15} />
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div className="ci-name">{item.name}</div>
                      <div className="ci-desc">{item.desc}</div>
                    </div>
                    <span className="ci-key">{item.hint}</span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Provides the global ⌘K command palette: a keyboard listener (⌘/Ctrl-K
 * toggles, Esc closes) and an imperative `open()` for the topbar search bar.
 */
export function CommandPaletteProvider({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const value = React.useMemo(() => ({ open: () => setOpen(true) }), []);

  return (
    <CommandPaletteContext.Provider value={value}>
      {children}
      {open ? <Palette onClose={() => setOpen(false)} /> : null}
    </CommandPaletteContext.Provider>
  );
}
