import Link from "next/link";

import { formatDate } from "@/lib/api";
import { coverForEvent } from "@/lib/covers";
import { isEventExpired } from "@/lib/events";
import type { EventItem } from "@/lib/types";

export function EventCard({
  event,
  href,
}: {
  event: EventItem;
  href?: string;
}) {
  const cover = coverForEvent(event.id, event.theme, event.cover_image);
  const expired = isEventExpired(event);
  const to = href ?? `/events/${event.id}`;

  return (
    <Link
      href={to}
      className="group relative block h-full min-h-[240px] overflow-hidden rounded-3xl shadow-md ring-1 ring-zinc-200/70 transition duration-300 hover:-translate-y-1 hover:shadow-xl sm:min-h-[280px]"
    >
      <div
        className="absolute inset-0 bg-cover bg-center transition duration-500 group-hover:scale-105"
        style={{ backgroundImage: `url(${cover})` }}
        aria-hidden
      />
      <div
        className="absolute inset-0 bg-gradient-to-t from-zinc-950/90 via-zinc-950/45 to-zinc-950/15"
        aria-hidden
      />

      <div className="relative flex h-full min-h-[240px] flex-col justify-between p-4 sm:min-h-[280px] sm:p-6">
        <div className="flex items-start justify-between gap-2">
          <span className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wider text-white backdrop-blur-sm">
            {event.type}
          </span>
          {expired ? (
            <span className="rounded-full bg-zinc-800/80 px-2.5 py-1 text-[11px] font-medium text-zinc-200">
              Expired
            </span>
          ) : event.registration_open ? (
            <span className="rounded-full bg-emerald-500/90 px-2.5 py-1 text-[11px] font-medium text-white">
              Open
            </span>
          ) : (
            <span className="rounded-full bg-zinc-800/80 px-2.5 py-1 text-[11px] font-medium text-zinc-200">
              {event.status === "draft" ? "Draft" : "Closed"}
            </span>
          )}
        </div>

        <div>
          <h2
            className="text-xl font-semibold leading-tight text-white drop-shadow-sm sm:text-2xl"
            style={{ fontFamily: "var(--font-display), serif" }}
          >
            {event.title}
          </h2>
          <p className="mt-2 text-xs text-zinc-200 sm:mt-3 sm:text-sm">
            Conducted by{" "}
            <span className="font-medium text-white">{event.org_name || "Organizer"}</span>
          </p>
          <p className="mt-1 text-xs text-zinc-300 sm:mt-1.5 sm:text-sm">
            {formatDate(event.start_at)}
          </p>
        </div>
      </div>
    </Link>
  );
}
