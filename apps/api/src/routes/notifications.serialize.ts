/**
 * Serializer + row type for the notifications router.
 *
 * Co-located with `routes/notifications.ts`. Follows the global serializer
 * convention (`lib/serialize.ts`): dates become ISO strings.
 *
 * @module
 */

import { iso } from "../lib/serialize.js";

import type { Notification } from "@shipyard/db";

/** Wire shape of a user notification. Dates are ISO strings. */
export interface NotificationDto {
  id: string;
  userId: string;
  type: Notification["type"];
  title: string;
  body: string | null;
  link: string | null;
  metadata: unknown;
  readAt: string | null;
  createdAt: string;
}

/**
 * Serialize a `Notification` row into its public DTO.
 *
 * @param notification - A Prisma `Notification` row.
 * @returns The {@link NotificationDto}.
 */
export function toNotificationDto(
  notification: Notification,
): NotificationDto {
  return {
    id: notification.id,
    userId: notification.userId,
    type: notification.type,
    title: notification.title,
    body: notification.body,
    link: notification.link,
    metadata: notification.metadata,
    readAt: iso(notification.readAt),
    createdAt: notification.createdAt.toISOString(),
  };
}
