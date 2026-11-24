"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";

import { api, formatDate } from "@/lib/api";
import { joinUrlForCode } from "@/lib/app-url";
import { useAuth } from "@/lib/auth";
import type { EventItem, Question } from "@/lib/types";

type Registration = {
  id: string;
  name: string;
  email: string;
  phone: string;
  registered_at: string;
};

function toLocalInputValue(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function OrgEventDetailPage() {
  const params = useParams<{ id: string }>();
  const { user, loading } = useAuth();
  const router = useRouter();
  const [event, setEvent] = useState<EventItem | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [participants, setParticipants] = useState<Registration[]>([]);
  const [error, setError] = useState("");
  const [qText, setQText] = useState("");
  const [options, setOptions] = useState(["", "", "", ""]);
  const [correctIndex, setCorrectIndex] = useState(0);
  const [aiSubject, setAiSubject] = useState("");
  const [aiCount, setAiCount] = useState(5);
  const [busy, setBusy] = useState(false);

  const [title, setTitle] = useState("");
  const [theme, setTheme] = useState("");
  const [description, setDescription] = useState("");
  const [capacity, setCapacity] = useState(50);
  const [perQuestion, setPerQuestion] = useState(30);
  const [deadline, setDeadline] = useState("");
  const [startAt, setStartAt] = useState("");

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  const load = useCallback(async () => {
    try {
      const [ev, qs, regs] = await Promise.all([
        api.get<EventItem>(`/org/events/${params.id}`),
        api.get<Question[]>(`/events/${params.id}/questions`),
        api.get<Registration[]>(`/events/${params.id}/registrations`),
      ]);
      setEvent(ev);
      setQuestions(qs);
      setParticipants(regs);
      setAiSubject(ev.theme);
      setTitle(ev.title);
      setTheme(ev.theme);
      setDescription(ev.description || "");
      setCapacity(ev.capacity);
      setPerQuestion(ev.per_question_seconds);
      setDeadline(toLocalInputValue(ev.registration_deadline));
      setStartAt(toLocalInputValue(ev.start_at));
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load event");
    }
  }, [params.id]);

  useEffect(() => {
    if (user) void load();
  }, [user, load]);

  async function saveDetails(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api.patch(`/events/${params.id}`, {
        title,
        theme,
        description,
        capacity,
        per_question_seconds: perQuestion,
        registration_deadline: new Date(deadline).toISOString(),
        start_at: new Date(startAt).toISOString(),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save event");
    } finally {
      setBusy(false);
    }
  }

  async function addQuestion(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const filled = options.map((o) => o.trim()).filter(Boolean);
      await api.post(`/events/${params.id}/questions`, {
        text: qText,
        options: filled.map((text) => ({ text })),
        correct_option_index: event?.type === "quiz" ? correctIndex : null,
      });
      setQText("");
      setOptions(["", "", "", ""]);
      setCorrectIndex(0);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add question");
    } finally {
      setBusy(false);
    }
  }

  async function generateAi(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post(`/events/${params.id}/generate-questions`, {
        subject: aiSubject,
        count: aiCount,
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI generation failed");
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    setBusy(true);
    try {
      await api.post(`/events/${params.id}/publish`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Publish failed");
    } finally {
      setBusy(false);
    }
  }

  async function deleteQuestion(id: string) {
    setBusy(true);
    try {
      await api.delete(`/questions/${id}`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  if (loading || !user) return <p className="text-[var(--muted)]">Loading…</p>;
  if (!event && !error) return <p className="text-[var(--muted)]">Loading event…</p>;
  if (!event) return <p className="text-[var(--danger)]">{error}</p>;

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--accent)]">
            {event.status} · {event.type}
          </p>
          <h1
            className="mt-2 text-3xl font-semibold"
            style={{ fontFamily: "var(--font-display), serif" }}
          >
            {event.title}
          </h1>
          <p className="mt-2 text-[var(--muted)]">
            Starts {formatDate(event.start_at)} · {event.registration_count}/
            {event.capacity} registered
          </p>
          <p className="mt-1 text-sm text-zinc-500">
            You are the conductor — manage this event here. Participants join via QR;
            you do not register or take the quiz.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {event.status === "draft" && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void publish()}
              className="rounded-full bg-[var(--accent)] px-4 py-2 text-white disabled:opacity-60"
            >
              Publish
            </button>
          )}
          {event.status !== "draft" && (
            <Link
              href={`/live/${event.id}/conduct`}
              className="rounded-full bg-rose-600 px-4 py-2 font-medium text-white hover:bg-rose-700"
            >
              Conduct live
            </Link>
          )}
          <Link
            href={`/org/events/${event.id}/results`}
            className="rounded-full border border-[var(--line)] px-4 py-2"
          >
            Results
          </Link>
        </div>
      </div>

      {error && <p className="text-[var(--danger)]">{error}</p>}

      <section className="rounded-3xl border border-zinc-200 bg-white p-6">
        <h2 className="text-lg font-semibold">Edit event</h2>
        <form onSubmit={saveDetails} className="mt-4 grid gap-3 sm:grid-cols-2">
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            className="rounded-xl border border-[var(--line)] bg-white px-3 py-2 sm:col-span-2"
          />
          <input
            required
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            placeholder="Theme / subject"
            className="rounded-xl border border-[var(--line)] bg-white px-3 py-2 sm:col-span-2"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description"
            rows={3}
            className="rounded-xl border border-[var(--line)] bg-white px-3 py-2 sm:col-span-2"
          />
          <label className="text-sm text-zinc-500">
            Capacity
            <input
              type="number"
              min={1}
              value={capacity}
              onChange={(e) => setCapacity(Number(e.target.value))}
              className="mt-1 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-zinc-900"
            />
          </label>
          <label className="text-sm text-zinc-500">
            Seconds per question
            <input
              type="number"
              min={5}
              value={perQuestion}
              onChange={(e) => setPerQuestion(Number(e.target.value))}
              className="mt-1 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-zinc-900"
            />
          </label>
          <label className="text-sm text-zinc-500">
            Registration deadline
            <input
              type="datetime-local"
              required
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="mt-1 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-zinc-900"
            />
          </label>
          <label className="text-sm text-zinc-500">
            Starts at
            <input
              type="datetime-local"
              required
              value={startAt}
              onChange={(e) => setStartAt(e.target.value)}
              className="mt-1 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-zinc-900"
            />
          </label>
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={busy}
              className="rounded-full bg-rose-600 px-4 py-2 text-white hover:bg-rose-700 disabled:opacity-60"
            >
              Save changes
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-3xl border border-zinc-200 bg-white p-6">
        <h2 className="text-lg font-semibold">
          Participants ({participants.length})
        </h2>
        {participants.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">
            No one has registered yet. Share the QR after you publish.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-zinc-100">
            {participants.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-baseline justify-between gap-2 py-3 text-sm"
              >
                <div>
                  <p className="font-medium text-zinc-900">{p.name}</p>
                  <p className="text-zinc-500">
                    {p.email} · {p.phone}
                  </p>
                </div>
                <p className="text-xs text-zinc-400">{formatDate(p.registered_at)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {event.join_code && event.status !== "draft" && (
        <section className="flex flex-col items-start gap-4 rounded-3xl border border-zinc-200 bg-white p-6 sm:flex-row sm:items-center">
          <QRCodeSVG value={joinUrlForCode(event.join_code)} size={140} />
          <div>
            <h2 className="text-lg font-semibold">Participant QR</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Code <span className="font-mono font-semibold text-zinc-800">{event.join_code}</span>
            </p>
            <p className="mt-2 break-all text-xs text-zinc-400">
              {joinUrlForCode(event.join_code)}
            </p>
            <Link
              href={`/live/${event.id}/conduct`}
              className="mt-3 inline-block text-sm font-medium text-rose-600"
            >
              Open conductor screen →
            </Link>
          </div>
        </section>
      )}

      <section>
        <h2 className="text-xl font-semibold">Questions ({questions.length})</h2>
        <ul className="mt-4 space-y-4">
          {questions.map((q, i) => (
            <li key={q.id} className="rounded-2xl border border-[var(--line)] bg-white/50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-[var(--muted)]">
                    #{i + 1} · {q.source}
                  </p>
                  <p className="mt-1 font-medium">{q.text}</p>
                  <ul className="mt-2 space-y-1 text-sm text-[var(--muted)]">
                    {q.options.map((o) => (
                      <li key={o.id}>
                        {o.id === q.correct_option_id ? "✓ " : "· "}
                        {o.text}
                      </li>
                    ))}
                  </ul>
                </div>
                <button
                  type="button"
                  onClick={() => void deleteQuestion(q.id)}
                  className="text-sm text-[var(--danger)]"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="grid gap-8 lg:grid-cols-2">
        <form onSubmit={addQuestion} className="space-y-3">
          <h3 className="font-semibold">Add question manually</h3>
          <textarea
            required
            placeholder="Question text"
            value={qText}
            onChange={(e) => setQText(e.target.value)}
            className="w-full rounded-xl border border-[var(--line)] bg-white/70 px-3 py-2"
            rows={3}
          />
          {options.map((opt, idx) => (
            <div key={idx} className="flex items-center gap-2">
              {event.type === "quiz" && (
                <input
                  type="radio"
                  name="correct"
                  checked={correctIndex === idx}
                  onChange={() => setCorrectIndex(idx)}
                />
              )}
              <input
                required={idx < 2}
                placeholder={`Option ${idx + 1}`}
                value={opt}
                onChange={(e) => {
                  const next = [...options];
                  next[idx] = e.target.value;
                  setOptions(next);
                }}
                className="w-full rounded-xl border border-[var(--line)] bg-white/70 px-3 py-2"
              />
            </div>
          ))}
          <button
            type="submit"
            disabled={busy}
            className="rounded-full bg-[var(--accent)] px-4 py-2 text-white disabled:opacity-60"
          >
            Add question
          </button>
        </form>

        <form onSubmit={generateAi} className="space-y-3">
          <h3 className="font-semibold">Generate with AI</h3>
          <p className="text-sm text-[var(--muted)]">
            Without an API key, sample questions are created locally for demos.
          </p>
          <input
            required
            placeholder="Subject"
            value={aiSubject}
            onChange={(e) => setAiSubject(e.target.value)}
            className="w-full rounded-xl border border-[var(--line)] bg-white/70 px-3 py-2"
          />
          <input
            type="number"
            min={1}
            max={20}
            value={aiCount}
            onChange={(e) => setAiCount(Number(e.target.value))}
            className="w-full rounded-xl border border-[var(--line)] bg-white/70 px-3 py-2"
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded-full border border-[var(--accent)] px-4 py-2 text-[var(--accent)] disabled:opacity-60"
          >
            Generate questions
          </button>
        </form>
      </section>
    </div>
  );
}
