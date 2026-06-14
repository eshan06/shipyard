import {
  Boxes,
  DollarSign,
  FolderGit2,
  Hammer,
  LayoutDashboard,
  Rocket,
  Settings,
  type LucideIcon,
} from "lucide-react";

/** A primary navigation entry. */
export interface NavItem {
  /** Visible label. */
  label: string;
  /** Route href. */
  href: string;
  /** Leading icon. */
  icon: LucideIcon;
  /**
   * When true (default), the item is active only on an exact path match; when
   * false it is active for the href and any sub-path (prefix match).
   */
  exact?: boolean;
}

/** The dashboard's primary navigation, in display order. */
export const NAV_ITEMS: readonly NavItem[] = [
  { label: "Overview", href: "/", icon: LayoutDashboard, exact: true },
  { label: "Previews", href: "/previews", icon: Boxes },
  { label: "Deployments", href: "/deployments", icon: Rocket },
  { label: "Builds", href: "/builds", icon: Hammer },
  { label: "Costs", href: "/costs", icon: DollarSign },
  { label: "Projects", href: "/projects", icon: FolderGit2 },
  { label: "Settings", href: "/settings/team", icon: Settings },
];

/**
 * Determine whether a nav item is active for the current pathname.
 *
 * @param item - The nav item.
 * @param pathname - The current pathname.
 * @returns `true` if the item should render as active.
 */
export function isNavActive(item: NavItem, pathname: string): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
