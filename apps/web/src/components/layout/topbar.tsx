"use client";

import {
  Bell,
  Check,
  ChevronsUpDown,
  LogOut,
  Menu,
  Users,
} from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import { SidebarNav, Wordmark } from "@/components/layout/sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ANALYTICS_EVENTS, flushAnalytics, trackEvent } from "@/lib/analytics";
import { api } from "@/lib/api";
import { useMe, useNotifications } from "@/lib/hooks";
import { relativeTime } from "@/lib/time";
import { initials } from "@/lib/utils";

import type { Membership, Notification } from "@/lib/api-types";

/** Props for {@link Topbar}. */
export interface TopbarProps {
  /** The page title shown in the bar. */
  title: string;
  /** Optional actions rendered on the right of the title. */
  actions?: React.ReactNode;
}

/** The mobile navigation drawer, opened by the hamburger button. */
function MobileNav(): React.JSX.Element {
  const [open, setOpen] = React.useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          aria-label="Open navigation"
        >
          <Menu className="size-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="left-0 top-0 h-full max-w-[16rem] translate-x-0 translate-y-0 rounded-none border-y-0 border-l-0 p-0 data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left sm:rounded-none">
        <DialogTitle className="sr-only">Navigation</DialogTitle>
        <div className="flex h-16 items-center border-b px-4">
          <Wordmark />
        </div>
        <div className="p-3">
          <SidebarNav onNavigate={() => setOpen(false)} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** The team switcher dropdown (lists the user's team memberships). */
function TeamSwitcher({
  memberships,
}: {
  memberships: Membership[];
}): React.JSX.Element {
  const [activeId, setActiveId] = React.useState<string | null>(
    memberships[0]?.teamId ?? null,
  );

  React.useEffect(() => {
    if (!activeId && memberships[0]) setActiveId(memberships[0].teamId);
  }, [memberships, activeId]);

  const active = memberships.find((m) => m.teamId === activeId);
  const activeName = active?.team?.name ?? "Select team";

  if (memberships.length === 0) return <></>;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="max-w-[12rem] justify-between gap-2"
        >
          <Users className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate">{activeName}</span>
          <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>Teams</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {memberships.map((m) => (
          <DropdownMenuItem
            key={m.teamId}
            onSelect={() => setActiveId(m.teamId)}
            className="justify-between"
          >
            <span className="truncate">{m.team?.name ?? m.teamId}</span>
            <span className="ml-2 flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{m.role}</span>
              {m.teamId === activeId ? <Check className="size-4" /> : null}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** The notifications bell dropdown with an unread-count indicator. */
function NotificationsBell(): React.JSX.Element {
  const { data } = useNotifications();
  const notifications: Notification[] = data?.data ?? [];
  const unread = notifications.filter((n) => n.readAt === null).length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
        >
          <Bell className="size-5" />
          {unread > 0 ? (
            <span className="absolute right-1.5 top-1.5 flex size-2 items-center justify-center">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-primary" />
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Notifications</span>
          {unread > 0 ? (
            <span className="text-xs font-normal text-muted-foreground">
              {unread} unread
            </span>
          ) : null}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {notifications.length === 0 ? (
          <div className="px-2 py-6 text-center text-sm text-muted-foreground">
            You&apos;re all caught up.
          </div>
        ) : (
          <ScrollArea className="max-h-80">
            {notifications.map((n) => (
              <div
                key={n.id}
                className="flex gap-2 rounded-md px-2 py-2 text-sm hover:bg-accent"
              >
                <span
                  className={`mt-1.5 size-2 shrink-0 rounded-full ${
                    n.readAt === null ? "bg-primary" : "bg-transparent"
                  }`}
                  aria-hidden
                />
                <div className="min-w-0">
                  <p className="truncate font-medium">{n.title}</p>
                  {n.body ? (
                    <p className="line-clamp-2 text-xs text-muted-foreground">
                      {n.body}
                    </p>
                  ) : null}
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {relativeTime(n.createdAt)}
                  </p>
                </div>
              </div>
            ))}
          </ScrollArea>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** The current-user avatar menu (name/email + logout). */
function UserMenu(): React.JSX.Element {
  const router = useRouter();
  const { data } = useMe();
  const user = data?.user;

  const onLogout = async (): Promise<void> => {
    try {
      // Record + flush while the session is still valid; after logout the
      // telemetry route would 401.
      trackEvent(ANALYTICS_EVENTS.signedOut);
      await flushAnalytics();
      await api.logout();
      toast.success("Signed out");
      router.push("/login");
    } catch {
      toast.error("Failed to sign out");
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full"
          aria-label="Account menu"
        >
          <Avatar className="size-8">
            {user?.avatarUrl ? (
              <AvatarImage src={user.avatarUrl} alt={user.name ?? user.email} />
            ) : null}
            <AvatarFallback>
              {initials(user?.name ?? user?.email)}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="flex flex-col">
            <span className="truncate text-sm font-medium">
              {user?.name ?? "Account"}
            </span>
            <span className="truncate text-xs font-normal text-muted-foreground">
              {user?.email ?? ""}
            </span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void onLogout()}>
          <LogOut className="size-4" />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * The top application bar: a mobile nav trigger, the page title (+ optional
 * actions), and the right-hand cluster — team switcher, notifications bell,
 * theme toggle, and the user menu.
 */
export function Topbar({ title, actions }: TopbarProps): React.JSX.Element {
  const { data } = useMe();
  const memberships = data?.memberships ?? [];

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur md:px-6">
      <MobileNav />
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <h1 className="truncate text-lg font-semibold tracking-tight">
          {title}
        </h1>
        {actions ? (
          <div className="ml-auto flex items-center gap-2">{actions}</div>
        ) : null}
      </div>
      <div className="flex items-center gap-1.5">
        <div className="hidden sm:block">
          <TeamSwitcher memberships={memberships} />
        </div>
        <NotificationsBell />
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  );
}
