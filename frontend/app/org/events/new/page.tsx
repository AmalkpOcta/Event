"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { EventItem, Org } from "@/lib/types";

function toLocalInputValue(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function NewEventPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [orgId, setOrgId] = useState("");
  const [title, setTitle] = useState("");
  const [theme, setTheme] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<"quiz" | "survey">("quiz");
  const [capacity, setCapacity] = useState(50);
  const [perQuestion, setPerQuestion] = useState(30);
  const [deadline, setDeadline] = useState("");
  const [startAt, setStartAt] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  useEffect(() => {
    const now = new Date();
    const deadlineDate = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
    const startDate = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    setDeadline(toLocalInputValue(deadlineDate));
    setStartAt(toLocalInputValue(startDate));
  }, []);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const orgs = await api.get<Org[]>("/orgs/me");
      if (!orgs[0]) {
        router.replace("/org");
        return;
      }
      setOrgId(orgs[0].id);
    })();
  }, [user, router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!orgId) return;
    setBusy(true);
    setError("");
    try {
      const event = await api.post<EventItem>(`/orgs/${orgId}/events`, {
        title,
        theme,
        description,
        type,
        capacity,
        per_question_seconds: perQuestion,
        registration_deadline: new Date(deadline).toISOString(),
        start_at: new Date(startAt).toISOString(),
      });
      router.push(`/org/events/${event.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create event");
    } finally {
      setBusy(false);
    }
  }

  if (loading || !user) return <p className="text-[var(--muted)]">Loading…</p>;

  return (
    <div className="max-w-xl">
      <h1
        className="text-3xl font-semibold"
        style={{ fontFamily: "var(--font-display), serif" }}
      >
        Create event
      </h1>
      <form className="mt-6 space-y-3" onSubmit={onSubmit}>
        <input
          required
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full rounded-xl border border-[var(--line)] bg-white/70 px-3 py-2"
        />
        <input
          required
          placeholder="Theme / subject"
          value={theme}
          onChange={(e) => setTheme(e.target.value)}
          className="w-full rounded-xl border border-[var(--line)] bg-white/70 px-3 py-2"
        />
        <textarea
          placeholder="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          className="w-full rounded-xl border border-[var(--line)] bg-white/70 px-3 py-2"
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <select
            value={type}
            onChange={(e) => setType(e.target.value as "quiz" | "survey")}
            className="rounded-xl border border-[var(--line)] bg-white/70 px-3 py-2"
          >
            <option value="quiz">Quiz</option>
            <option value="survey">Survey</option>
          </select>
          <input
            type="number"
            min={1}
            value={capacity}
            onChange={(e) => setCapacity(Number(e.target.value))}
            className="rounded-xl border border-[var(--line)] bg-white/70 px-3 py-2"
            placeholder="Capacity"
          />
          <label className="text-sm text-[var(--muted)]">
            Registration deadline
            <input
              required
              type="datetime-local"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="mt-1 w-full rounded-xl border border-[var(--line)] bg-white/70 px-3 py-2 text-[var(--ink)]"
            />
          </label>
          <label className="text-sm text-[var(--muted)]">
            Event start
            <input
              required
              type="datetime-local"
              value={startAt}
              onChange={(e) => setStartAt(e.target.value)}
              className="mt-1 w-full rounded-xl border border-[var(--line)] bg-white/70 px-3 py-2 text-[var(--ink)]"
            />
          </label>
          <label className="text-sm text-[var(--muted)] sm:col-span-2">
            Seconds per question
            <input
              type="number"
              min={5}
              value={perQuestion}
              onChange={(e) => setPerQuestion(Number(e.target.value))}
              className="mt-1 w-full rounded-xl border border-[var(--line)] bg-white/70 px-3 py-2 text-[var(--ink)]"
            />
          </label>
        </div>
        {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
        <button
          type="submit"
          disabled={busy || !orgId}
          className="rounded-full bg-[var(--accent)] px-5 py-2.5 text-white disabled:opacity-60"
        >
          {busy ? "Creating…" : "Create draft"}
        </button>
      </form>
    </div>
  );
}
