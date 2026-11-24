"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { EventCard } from "@/components/EventCard";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { isConductor, sortEventsUpcomingFirst } from "@/lib/events";
import type { EventItem, Org } from "@/lib/types";

export default function HomePage() {
  const { user, loading: authLoading } = useAuth();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const conductor = isConductor(user);

  useEffect(() => {
    if (authLoading) return;

    void (async () => {
      setLoading(true);
      setError("");
      try {
        if (conductor && user) {
          const orgs = await api.get<Org[]>("/orgs/me");
          if (orgs[0]) {
            const mine = await api.get<EventItem[]>(`/orgs/${orgs[0].id}/events`);
            setEvents(sortEventsUpcomingFirst(mine));
          } else {
            setEvents([]);
          }
        } else {
          const data = await api.get<EventItem[]>("/events");
          setEvents(sortEventsUpcomingFirst(data));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load events");
      } finally {
        setLoading(false);
      }
    })();
  }, [authLoading, conductor, user]);

  useEffect(() => {
    const hash = window.location.hash.replace("#", "");
    if (!hash) return;
    const timer = window.setTimeout(() => {
      document.getElementById(hash)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div>
      {/* Full-bleed hero */}
      <section className="relative isolate min-h-[88vh] overflow-hidden text-white sm:min-h-[92vh]">
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: "url(/images/home-hero.jpg)" }}
          aria-hidden
        />
        <div
          className="absolute inset-0 bg-gradient-to-r from-zinc-950/75 via-zinc-950/35 to-transparent"
          aria-hidden
        />
        <div
          className="absolute inset-0 bg-gradient-to-t from-zinc-950/80 via-transparent to-zinc-950/20"
          aria-hidden
        />

        <div className="relative mx-auto flex min-h-[88vh] max-w-6xl flex-col justify-end px-4 pb-16 pt-28 sm:min-h-[92vh] sm:px-6 sm:pb-24">
          <p className="text-xs uppercase tracking-[0.22em] text-rose-300">
            Event management platform
          </p>
          <h1
            className="mt-4 max-w-2xl text-4xl font-semibold leading-tight tracking-tight drop-shadow-sm sm:text-5xl md:text-6xl"
            style={{ fontFamily: "var(--font-display), serif" }}
          >
            EventHive
          </h1>
          <p className="mt-4 max-w-xl text-base text-zinc-100 sm:text-lg">
            {conductor
              ? "Create and conduct live quizzes for your team — QR join, synced questions, and results."
              : "Create, organize, and conduct quizzes and surveys for your teams — timed, branded, and ready to host."}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="#events"
              className="inline-flex rounded-full bg-rose-600 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-rose-900/30 transition hover:bg-rose-500"
            >
              {conductor ? "Your events" : "Browse events"}
            </a>
            {!conductor && (
              <Link
                href="/subscribe"
                className="inline-flex rounded-full border border-white/40 bg-white/10 px-5 py-2.5 text-sm font-medium text-white backdrop-blur transition hover:bg-white/20"
              >
                Subscribe to host
              </Link>
            )}
            {conductor && (
              <Link
                href="/org/events/new"
                className="inline-flex rounded-full border border-white/40 bg-white/10 px-5 py-2.5 text-sm font-medium text-white backdrop-blur transition hover:bg-white/20"
              >
                Create an event
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* Events */}
      <section id="events" className="scroll-mt-20 bg-[var(--bg)] py-14 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="max-w-2xl">
            <p className="text-xs uppercase tracking-[0.2em] text-rose-600">Events</p>
            <h2
              className="mt-3 text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl"
              style={{ fontFamily: "var(--font-display), serif" }}
            >
              {conductor ? "Your quizzes & surveys" : "Upcoming quizzes & surveys"}
            </h2>
            <p className="mt-3 text-zinc-500">
              {conductor
                ? "Manage your events, view participants, and open the conductor screen when you’re ready."
                : "Pick an event, register before the deadline, and join when it goes live."}
            </p>
          </div>

          {conductor && (
            <div className="mt-8">
              <Link
                href="/org/events/new"
                className="inline-flex rounded-full bg-rose-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-rose-700"
              >
                Create an event
              </Link>
            </div>
          )}

          <div className={conductor ? "mt-6" : "mt-8"}>
            {loading && <p className="text-zinc-500">Loading events…</p>}
            {error && <p className="text-red-600">{error}</p>}
            {!loading && !error && events.length === 0 && (
              <p className="rounded-2xl border border-dashed border-zinc-300 bg-white/60 px-5 py-10 text-zinc-500">
                {conductor
                  ? "No events yet. Create your first event to get a QR join link."
                  : "No published events yet. Organizers can create one from the dashboard."}
              </p>
            )}
            <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 scrollbar-thin sm:mx-0 sm:grid sm:snap-none sm:grid-cols-2 sm:gap-5 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-3">
              {events.map((event) => (
                <div
                  key={event.id}
                  className="w-[55%] shrink-0 snap-start sm:w-auto sm:min-w-0 sm:shrink"
                >
                  <EventCard
                    event={event}
                    href={conductor ? `/org/events/${event.id}` : undefined}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* About */}
      <section id="about" className="scroll-mt-20 border-t border-zinc-200 bg-white py-14 sm:py-20">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 md:grid-cols-2 md:items-center md:gap-14">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-rose-600">About</p>
            <h2
              className="mt-3 text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl"
              style={{ fontFamily: "var(--font-display), serif" }}
            >
              Built for teams that run real events
            </h2>
            <p className="mt-4 text-zinc-500 leading-relaxed">
              EventHive helps companies and teams create themed quizzes and surveys,
              invite participants, enforce registration deadlines, and run timed
              sessions with clear results — without juggling spreadsheets and chat links.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              {
                title: "For organizers",
                body: "Draft events, add questions manually or with AI, publish, and track scores.",
              },
              {
                title: "For participants",
                body: "Scan a QR code, register in seconds, and take the live synced quiz on any device.",
              },
              {
                title: "Timed sessions",
                body: "Per-question timers are enforced on the server so results stay fair.",
              },
              {
                title: "Company ready",
                body: "Organize under your team, set capacity, and keep registrations in one place.",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-2xl border border-zinc-200 bg-[var(--bg)] p-5"
              >
                <h3 className="font-semibold text-zinc-900">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-500">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
