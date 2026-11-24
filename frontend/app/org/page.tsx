"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

import { api, formatDate } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { sortEventsUpcomingFirst } from "@/lib/events";
import type { EventItem, Org } from "@/lib/types";

export default function OrgHomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [orgName, setOrgName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  async function load() {
    try {
      const list = await api.get<Org[]>("/orgs/me");
      setOrgs(list);
      if (list[0]) {
        const ev = await api.get<EventItem[]>(`/orgs/${list[0].id}/events`);
        setEvents(sortEventsUpcomingFirst(ev));
      } else {
        setEvents([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    }
  }

  useEffect(() => {
    if (user) void load();
  }, [user]);

  async function createOrg(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api.post("/orgs", { name: orgName });
      setOrgName("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create org");
    } finally {
      setBusy(false);
    }
  }

  if (loading || !user) {
    return <p className="text-[var(--muted)]">Loading…</p>;
  }

  const org = orgs[0];

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--accent)]">
            Organizer
          </p>
          <h1
            className="mt-2 text-3xl font-semibold"
            style={{ fontFamily: "var(--font-display), serif" }}
          >
            {org ? org.name : "Set up your team"}
          </h1>
          <p className="mt-2 text-[var(--muted)]">Signed in as {user.email}</p>
        </div>
        {org && (
          <Link
            href="/org/events/new"
            className="rounded-full bg-rose-600 px-4 py-2 text-white hover:bg-rose-700"
          >
            New event
          </Link>
        )}
      </div>

      {error && <p className="mt-4 text-[var(--danger)]">{error}</p>}

      {!org && (
        <form onSubmit={createOrg} className="mt-8 max-w-md space-y-3">
          <input
            required
            placeholder="Organization / team name"
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            className="w-full rounded-xl border border-[var(--line)] bg-white/70 px-3 py-2"
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded-full bg-[var(--accent)] px-4 py-2 text-white disabled:opacity-60"
          >
            {busy ? "Creating…" : "Create organization"}
          </button>
        </form>
      )}

      {org && (
        <div className="mt-10">
          <h2 className="text-lg font-semibold">Your events</h2>
          {events.length === 0 ? (
            <p className="mt-3 text-[var(--muted)]">No events yet.</p>
          ) : (
            <ul className="mt-4 divide-y divide-[var(--line)]">
              {events.map((ev) => (
                <li key={ev.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                  <div>
                    <Link
                      href={`/org/events/${ev.id}`}
                      className="text-lg font-medium hover:text-[var(--accent)]"
                    >
                      {ev.title}
                    </Link>
                    <p className="text-sm text-[var(--muted)]">
                      {ev.status} · {formatDate(ev.start_at)} · {ev.question_count}{" "}
                      questions
                    </p>
                  </div>
                  <Link
                    href={`/org/events/${ev.id}/results`}
                    className="text-sm text-[var(--accent)]"
                  >
                    Results
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
