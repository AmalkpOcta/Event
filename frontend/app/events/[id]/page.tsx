"use client";

import { useParams, useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

import { api, formatDate } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { EventItem } from "@/lib/types";

export default function EventDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [event, setEvent] = useState<EventItem | null>(null);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const data = await api.get<EventItem>(`/events/${params.id}`);
        setEvent(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Event not found");
      }
    })();
  }, [params.id]);

  // Conductors manage their own events — no participant register / enter quiz.
  useEffect(() => {
    if (authLoading || !user || !event) return;
    if (user.org_ids?.includes(event.org_id)) {
      router.replace(`/org/events/${event.id}`);
    }
  }, [authLoading, user, event, router]);

  async function onRegister(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setFormError("");
    try {
      await api.post(`/events/${params.id}/register`, { name, email, phone });
      setShowForm(false);
      router.push(`/live/${params.id}/play`);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (error) return <p className="text-[var(--danger)]">{error}</p>;
  if (!event || (user && user.org_ids?.includes(event.org_id))) {
    return <p className="text-[var(--muted)]">Loading…</p>;
  }

  return (
    <div className="max-w-3xl">
      <p className="text-xs uppercase tracking-[0.2em] text-rose-600">
        {event.theme} · {event.type}
      </p>
      <h1
        className="mt-3 text-4xl font-semibold tracking-tight"
        style={{ fontFamily: "var(--font-display), serif" }}
      >
        {event.title}
      </h1>
      <p className="mt-2 text-sm text-zinc-500">
        Conducted by <span className="font-medium text-zinc-800">{event.org_name}</span>
      </p>
      <p className="mt-4 text-lg text-[var(--muted)] whitespace-pre-wrap">
        {event.description || "No description provided."}
      </p>

      <dl className="mt-8 grid gap-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-[var(--muted)]">Starts</dt>
          <dd className="mt-1 font-medium">{formatDate(event.start_at)}</dd>
        </div>
        <div>
          <dt className="text-[var(--muted)]">Registration deadline</dt>
          <dd className="mt-1 font-medium">{formatDate(event.registration_deadline)}</dd>
        </div>
        <div>
          <dt className="text-[var(--muted)]">Time per question</dt>
          <dd className="mt-1 font-medium">{event.per_question_seconds}s</dd>
        </div>
        <div>
          <dt className="text-[var(--muted)]">Questions / seats</dt>
          <dd className="mt-1 font-medium">
            {event.question_count} questions · {event.registration_count}/
            {event.capacity} seats
          </dd>
        </div>
      </dl>

      <div className="mt-10 flex flex-wrap gap-3">
        {event.registration_open ? (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="rounded-full bg-rose-600 px-5 py-2.5 text-white hover:bg-rose-700"
          >
            Register
          </button>
        ) : (
          <button
            type="button"
            disabled
            className="cursor-not-allowed rounded-full bg-[var(--line)] px-5 py-2.5 text-[var(--muted)]"
          >
            Registration closed
          </button>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-[var(--bg)] p-6 shadow-xl">
            <h2 className="text-xl font-semibold">Register for {event.title}</h2>
            <form className="mt-4 space-y-3" onSubmit={onRegister}>
              <input
                required
                placeholder="Full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl border border-[var(--line)] bg-white/70 px-3 py-2"
              />
              <input
                required
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-[var(--line)] bg-white/70 px-3 py-2"
              />
              <input
                required
                placeholder="Phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-xl border border-[var(--line)] bg-white/70 px-3 py-2"
              />
              {formError && <p className="text-sm text-[var(--danger)]">{formError}</p>}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="rounded-full px-4 py-2 text-[var(--muted)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-full bg-[var(--accent)] px-4 py-2 text-white disabled:opacity-60"
                >
                  {submitting ? "Submitting…" : "Submit"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
