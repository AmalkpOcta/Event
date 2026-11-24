"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { api } from "@/lib/api";
import type { AttemptState } from "@/lib/types";

export default function QuizPage() {
  const params = useParams<{ id: string }>();
  const [state, setState] = useState<AttemptState | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const timeoutSent = useRef(false);

  const load = useCallback(async () => {
    try {
      let data: AttemptState;
      try {
        data = await api.get<AttemptState>(`/events/${params.id}/attempts/current`);
      } catch {
        data = await api.post<AttemptState>(`/events/${params.id}/attempts/start`);
      }
      setState(data);
      setSelected(null);
      setError("");
      timeoutSent.current = false;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to start quiz");
    }
  }, [params.id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!state || state.completed || !state.question) return;
    timeoutSent.current = false;
    const started = new Date(state.question_started_at).getTime();
    const tick = () => {
      const elapsed = (Date.now() - started) / 1000;
      const left = Math.max(0, Math.ceil(state.per_question_seconds - elapsed));
      setSecondsLeft(left);
    };
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [state]);

  const progress = useMemo(() => {
    if (!state) return 0;
    return Math.min(100, (state.question_index / Math.max(state.total_questions, 1)) * 100);
  }, [state]);

  async function submit(optionId: string | null) {
    if (!state?.question || submitting || state.completed) return;
    setSubmitting(true);
    try {
      const next = await api.post<AttemptState>(`/events/${params.id}/attempts/answer`, {
        question_id: state.question.id,
        option_id: optionId,
      });
      setState(next);
      setSelected(null);
      timeoutSent.current = false;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submit failed");
    } finally {
      setSubmitting(false);
    }
  }

  useEffect(() => {
    if (!state || state.completed || !state.question) return;
    if (secondsLeft === 0 && !timeoutSent.current && !submitting) {
      timeoutSent.current = true;
      void submit(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft]);

  if (error) {
    return (
      <div className="max-w-xl">
        <p className="text-[var(--danger)]">{error}</p>
        <p className="mt-3 text-sm text-[var(--muted)]">
          Register for this event first, and wait until the event start time.
        </p>
        <Link href={`/events/${params.id}`} className="mt-4 inline-block text-[var(--accent)]">
          Back to event
        </Link>
      </div>
    );
  }

  if (!state) return <p className="text-[var(--muted)]">Preparing quiz…</p>;

  if (state.completed) {
    return (
      <div className="max-w-xl">
        <h1
          className="text-3xl font-semibold"
          style={{ fontFamily: "var(--font-display), serif" }}
        >
          Quiz complete
        </h1>
        <p className="mt-4 text-lg">
          Score: <strong>{state.score}</strong> / {state.max_score}
        </p>
        <Link href={`/events/${params.id}`} className="mt-6 inline-block text-[var(--accent)]">
          Back to event
        </Link>
      </div>
    );
  }

  const q = state.question;
  if (!q) return <p className="text-[var(--muted)]">Loading question…</p>;

  return (
    <div className="max-w-2xl">
      <div className="mb-6 flex items-center justify-between text-sm text-[var(--muted)]">
        <span>
          Question {state.question_index + 1} of {state.total_questions}
        </span>
        <span
          className={
            secondsLeft <= 5
              ? "font-semibold text-[var(--warning)]"
              : "text-[var(--muted)]"
          }
        >
          {secondsLeft}s
        </span>
      </div>
      <div className="mb-6 h-1.5 overflow-hidden rounded-full bg-[var(--line)]">
        <div
          className="h-full bg-[var(--accent)] transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>
      <h1
        className="text-2xl font-semibold leading-snug sm:text-3xl"
        style={{ fontFamily: "var(--font-display), serif" }}
      >
        {q.text}
      </h1>
      <div className="mt-8 space-y-3">
        {q.options.map((opt) => (
          <button
            key={opt.id}
            type="button"
            disabled={submitting}
            onClick={() => setSelected(opt.id)}
            className={`block w-full rounded-2xl border px-4 py-3 text-left transition ${
              selected === opt.id
                ? "border-[var(--accent)] bg-white"
                : "border-[var(--line)] bg-white/50 hover:bg-white/80"
            }`}
          >
            {opt.text}
          </button>
        ))}
      </div>
      <button
        type="button"
        disabled={!selected || submitting}
        onClick={() => void submit(selected)}
        className="mt-8 rounded-full bg-[var(--accent)] px-5 py-2.5 text-white disabled:opacity-50"
      >
        {submitting ? "Saving…" : "Submit answer"}
      </button>
    </div>
  );
}
