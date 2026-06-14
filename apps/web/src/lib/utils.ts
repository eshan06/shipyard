import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge class names with Tailwind-aware conflict resolution.
 *
 * Combines {@link clsx} (conditional/array class composition) with
 * `tailwind-merge` (later utility wins when two classes target the same CSS
 * property, e.g. `px-2 px-4` → `px-4`).
 *
 * @param inputs - Class values (strings, arrays, conditional objects).
 * @returns The merged, de-conflicted class string.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Format a USD amount for display, e.g. `$1,234.56` (or `$0.04` for small
 * values). Uses the user's locale via `Intl.NumberFormat`.
 *
 * @param value - The dollar amount (may be `null`/`undefined`).
 * @param fractionDigits - Number of fraction digits (default 2).
 * @returns A currency-formatted string, or `"—"` when the value is nullish.
 */
export function formatUsd(
  value: number | null | undefined,
  fractionDigits = 2,
): string {
  if (value == null) return "—";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

/**
 * Format a duration given in milliseconds into a compact human string, e.g.
 * `820ms`, `4.2s`, `1m 30s`.
 *
 * @param ms - Duration in milliseconds (may be `null`/`undefined`).
 * @returns A compact duration string, or `"—"` when nullish.
 */
export function formatDuration(ms: number | null | undefined): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  const rem = Math.round(seconds % 60);
  return `${minutes}m ${rem}s`;
}

/**
 * Truncate a git commit SHA to its short form (first 7 chars).
 *
 * @param sha - The full commit SHA (may be `null`/`undefined`).
 * @returns The 7-char short SHA, or `"—"` when nullish.
 */
export function shortSha(sha: string | null | undefined): string {
  if (!sha) return "—";
  return sha.slice(0, 7);
}

/**
 * Compute initials from a display name or email for an avatar fallback.
 *
 * @param nameOrEmail - A user's name or email.
 * @returns Up to two uppercase initials.
 */
export function initials(nameOrEmail: string | null | undefined): string {
  if (!nameOrEmail) return "?";
  const base = nameOrEmail.includes("@")
    ? nameOrEmail.split("@")[0] ?? nameOrEmail
    : nameOrEmail;
  const parts = base.split(/[\s._-]+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return (parts[0] ?? "?").slice(0, 2).toUpperCase();
  return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
}
