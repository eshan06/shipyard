import { formatDistanceToNow, format, parseISO } from "date-fns";

/**
 * Format an ISO date string as a relative time, e.g. `"3 minutes ago"`.
 *
 * @param iso - An ISO-8601 date string (or null/undefined).
 * @returns A relative time string, or `"—"` when nullish/invalid.
 */
export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return formatDistanceToNow(parseISO(iso), { addSuffix: true });
  } catch {
    return "—";
  }
}

/**
 * Format an ISO date string as an absolute, human-readable timestamp, e.g.
 * `"Jun 14, 2026, 2:30 PM"`.
 *
 * @param iso - An ISO-8601 date string (or null/undefined).
 * @returns An absolute date string, or `"—"` when nullish/invalid.
 */
export function absoluteTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return format(parseISO(iso), "MMM d, yyyy, h:mm a");
  } catch {
    return "—";
  }
}

/**
 * Format an ISO date string as a short time, e.g. `"14:30:05"`, suitable for log
 * line gutters.
 *
 * @param iso - An ISO-8601 date string (or null/undefined).
 * @returns A `HH:mm:ss` string, or `"--:--:--"` when nullish/invalid.
 */
export function logTime(iso: string | null | undefined): string {
  if (!iso) return "--:--:--";
  try {
    return format(parseISO(iso), "HH:mm:ss");
  } catch {
    return "--:--:--";
  }
}
