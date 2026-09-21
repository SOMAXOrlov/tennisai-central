// ============================================================================
// Notification helpers shared by the inbox page and the dashboards.
// ============================================================================
import type { Notification } from "@/types";

/**
 * `linkTo` comes from the server, so only in-app paths are followed — never an
 * absolute or protocol-relative URL. A query string is fine: the calendar reads
 * `?date=…&event=…` to land on the right day and open the right event.
 */
export function internalPath(linkTo: string | undefined): string | null {
  if (!linkTo) return null;
  if (!linkTo.startsWith("/") || linkTo.startsWith("//")) return null;
  return linkTo;
}

/** In the inbox, as opposed to filed away in the archive. */
export function inInbox(n: Notification): boolean {
  return !n.archivedAt;
}

/** Counts towards the badge: unread AND still in the inbox. */
export function isUnread(n: Notification): boolean {
  return !n.read && !n.archivedAt;
}
