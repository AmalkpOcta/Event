import type { EventItem, EventStatus } from "./types";

const ACTIVE_STATUSES: EventStatus[] = [
  "draft",
  "open",
  "registration_closed",
  "live",
];

export function isEventExpired(event: EventItem, now = new Date()): boolean {
  if (event.status === "ended" || event.status === "cancelled") return true;
  if (event.status === "draft") return false;
  if (event.end_at && new Date(event.end_at) < now) return true;
  if (new Date(event.start_at) < now && !ACTIVE_STATUSES.includes(event.status)) {
    return true;
  }
  return false;
}

/** Upcoming first (soonest), then expired (newer expired before older). */
export function sortEventsUpcomingFirst(events: EventItem[]): EventItem[] {
  const now = new Date();
  return [...events].sort((a, b) => {
    const aExpired = isEventExpired(a, now);
    const bExpired = isEventExpired(b, now);
    if (aExpired !== bExpired) return aExpired ? 1 : -1;
    const aStart = new Date(a.start_at).getTime();
    const bStart = new Date(b.start_at).getTime();
    return aExpired ? bStart - aStart : aStart - bStart;
  });
}

export function isConductor(user: {
  role: string;
  subscription_active?: boolean;
} | null): boolean {
  if (!user) return false;
  if (user.role === "admin") return true;
  return user.role === "subscriber" && Boolean(user.subscription_active);
}
