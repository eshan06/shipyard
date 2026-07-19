/**
 * Shared Preview status transition — the single implementation used by both the
 * deploy and destroy workers (it was previously duplicated in each).
 *
 * Compare-and-swap keyed on the row's current status (via `previewFromsFor`),
 * so a preview that moved underneath us (e.g. DESTROYED by a racing teardown)
 * is NOT silently resurrected.
 *
 * Event semantics: when the CAS applies, the event published is the status we
 * just wrote — NOT a re-read. A re-read races the next transition (fast deploys
 * move the row again within milliseconds), which used to make every
 * intermediate event report the final status. Only on CAS failure do we read +
 * publish the actual current status, so dashboards still converge to truth.
 */

import { previewFromsFor } from "@shipyard/core";

import type { EventPublisher } from "../events.js";
import type { PreviewStatus, PrismaClient } from "@shipyard/db";

/** Optional row updates + event scoping for {@link transitionPreview}. */
export interface PreviewTransitionExtra {
  /**
   * Preview URL handling: a string sets it, `null` CLEARS it (teardown paths —
   * a stopped/destroyed preview has no live URL, and leaving the stale one in
   * the row would contradict the `url: null` published on the event), and
   * `undefined` leaves the row's URL untouched.
   */
  url?: string | null;
  /** Bump the activity timestamp (deploy success path). */
  lastActivityAt?: Date;
  /** Stamp the teardown timestamp (destroy path). */
  destroyedAt?: Date;
  /** Event scoping metadata (dashboard fan-out). */
  projectId?: string;
  /** Event scoping metadata (dashboard fan-out). */
  teamId?: string;
}

/**
 * Atomically transition `previewId` to `to` (CAS) and publish a status event.
 * Returns whether the transition applied.
 */
export async function transitionPreview(
  db: PrismaClient,
  events: EventPublisher,
  previewId: string,
  to: PreviewStatus,
  extra: PreviewTransitionExtra = {},
): Promise<boolean> {
  const res = await db.preview.updateMany({
    where: { id: previewId, status: { in: previewFromsFor(to) } },
    data: {
      status: to,
      ...(extra.url !== undefined ? { url: extra.url } : {}),
      ...(extra.lastActivityAt ? { lastActivityAt: extra.lastActivityAt } : {}),
      ...(extra.destroyedAt ? { destroyedAt: extra.destroyedAt } : {}),
    },
  });
  const applied = res.count > 0;

  if (applied) {
    await events.previewStatus({
      previewId,
      status: to,
      url: extra.url ?? null,
      projectId: extra.projectId,
      teamId: extra.teamId,
    });
    return true;
  }

  const current = await db.preview.findUnique({
    where: { id: previewId },
    select: { status: true, url: true },
  });
  if (current) {
    await events.previewStatus({
      previewId,
      status: current.status,
      url: current.url,
      projectId: extra.projectId,
      teamId: extra.teamId,
    });
  }
  return false;
}
