"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

import { api, formatDate } from "@/lib/api";
import type { LiveState } from "@/lib/types";

export default function ParticipantLivePage() {
  const params = useParams<{ id: string }>();
  const [state, setState] = useState<LiveState | null>(null);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [flash, setFlash] = useState<"correct" | "wrong" | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [now, setNow] = useState(Date.now());

  const refresh = useCallback(async () => {
    try {
      const data = await api.get<LiveState>(`/events/${params.id}/live/state`);
      setState(data);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load live state");
    }
  }, [params.id]);

  useEffect(() => {
    void refresh();
    const poll = window.setInterval(() => void refresh(), 1000);
    const clock = window.setInterval(() => setNow(Date.now()), 250);
    return () => {
      window.clearInterval(poll);
      window.clearInterval(clock);
    };
  }, [refresh]);

  useEffect(() => {
    setSelected(null);
    setFlash(null);
  }, [state?.live_question_index, state?.live_phase]);

  const secondsLeft = useMemo(() => {
    if (!state || state.live_phase !== "question" || !state.question_opened_at) {
      return state?.seconds_left ?? null;
    }
    const opened = new Date(state.question_opened_at).getTime();
    const elapsed = (now - opened) / 1000;
    return Math.max(0, Math.ceil(state.per_question_seconds - elapsed));
  }, [state, now]);

  const countdownToStart = useMemo(() => {
    if (!state?.start_at || state.live_phase !== "waiting") return null;
    const diff = new Date(state.start_at).getTime() - now;
    if (diff <= 0) return "Waiting for host to start…";
    const s = Math.floor(diff / 1000);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${sec
      .toString()
      .padStart(2, "0")}`;
  }, [state, now]);

  async function answer(optionId: string) {
    if (!state?.question || state.live_phase !== "question" || submitting) return;
    if (secondsLeft !== null && secondsLeft <= 0) return;
    setSubmitting(true);
    setSelected(optionId);
    try {
      const res = await api.post<{ correct: boolean }>(`/events/${params.id}/live/answer`, {
        question_id: state.question.id,
        option_id: optionId,
      });
      setFlash(res.correct ? "correct" : "wrong");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Answer failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (error && !state) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16">
        <p className="text-red-600">{error}</p>
        <p className="mt-2 text-sm text-zinc-500">Register via the event QR first.</p>
      </div>
    );
  }
  if (!state) {
    return <p className="px-4 py-16 text-zinc-500">Connecting…</p>;
  }

  const answeredMap = new Map(
    (state.my_answers || []).map((a) => [a.question_id, a.correct]),
  );

  return (
    <div className="mx-auto grid min-h-[70vh] max-w-6xl gap-6 px-4 py-6 lg:grid-cols-[1fr_220px]">
      <div>
        <p className="text-xs uppercase tracking-[0.18em] text-rose-600">{state.title}</p>

        {state.live_phase === "waiting" && (
          <div className="mt-10 rounded-3xl border border-zinc-200 bg-white p-8 text-center">
            <p className="text-sm text-zinc-500">Event starts in</p>
            <p className="mt-3 font-mono text-4xl font-semibold">{countdownToStart}</p>
            <p className="mt-4 text-zinc-500">
              Scheduled {state.start_at ? formatDate(state.start_at) : "—"}
            </p>
            <p className="mt-2 text-sm text-zinc-400">
              This screen refreshes automatically when the host starts.
            </p>
          </div>
        )}

        {(state.live_phase === "question" || state.live_phase === "reveal") && state.question && (
          <div className="mt-4">
            <div className="mb-4 flex items-center justify-between text-sm text-zinc-500">
              <span>
                Question {state.live_question_index + 1} / {state.total_questions}
              </span>
              {state.live_phase === "question" ? (
                <span
                  className={
                    (secondsLeft ?? 99) <= 5
                      ? "font-semibold text-amber-600"
                      : "font-semibold text-zinc-800"
                  }
                >
                  {secondsLeft ?? "—"}s
                </span>
              ) : (
                <span className="font-medium text-rose-600">Answer revealed</span>
              )}
            </div>
            <h1
              className="text-2xl font-semibold text-zinc-900 sm:text-3xl"
              style={{ fontFamily: "var(--font-display), serif" }}
            >
              {state.question.text}
            </h1>
            <div className="mt-6 space-y-3">
              {state.question.options.map((opt) => {
                const isSelected = selected === opt.id;
                const isCorrect =
                  state.live_phase === "reveal" &&
                  opt.id === state.question?.correct_option_id;
                const isWrongSelected =
                  state.live_phase === "reveal" &&
                  isSelected &&
                  opt.id !== state.question?.correct_option_id;
                let cls =
                  "w-full rounded-2xl border px-4 py-3 text-left transition ";
                if (flash === "correct" && isSelected) cls += "border-emerald-500 bg-emerald-50";
                else if (flash === "wrong" && isSelected) cls += "border-red-500 bg-red-50";
                else if (isCorrect) cls += "border-emerald-500 bg-emerald-50";
                else if (isWrongSelected) cls += "border-red-400 bg-red-50";
                else if (isSelected) cls += "border-rose-500 bg-rose-50";
                else cls += "border-zinc-200 bg-white hover:bg-zinc-50";

                const disabled =
                  state.live_phase !== "question" ||
                  submitting ||
                  (secondsLeft !== null && secondsLeft <= 0) ||
                  !!selected;

                return (
                  <button
                    key={opt.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => void answer(opt.id)}
                    className={cls + (disabled && state.live_phase === "question" ? " opacity-70" : "")}
                  >
                    {opt.text}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {state.live_phase === "finished" && (
          <div className="mt-10 rounded-3xl border border-zinc-200 bg-white p-8 text-center">
            <h2 className="text-2xl font-semibold">Quiz finished</h2>
            <p className="mt-2 text-zinc-500">Thanks for playing. Check the host screen for rankings.</p>
          </div>
        )}
        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      </div>

      {/* Question status strip */}
      <aside className="rounded-3xl border border-zinc-200 bg-white p-4 lg:sticky lg:top-24 lg:self-start">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Questions
        </p>
        <div className="mt-3 grid grid-cols-5 gap-2 lg:grid-cols-4">
          {Array.from({ length: state.total_questions }).map((_, i) => {
            const known = state.my_answers?.[i];
            let color = "bg-zinc-200 text-zinc-600";
            if (known?.correct === true) color = "bg-emerald-500 text-white";
            else if (known?.correct === false) color = "bg-red-500 text-white";
            else if (i === state.live_question_index && state.live_phase !== "waiting") {
              color = "ring-2 ring-rose-500 bg-rose-50 text-rose-700";
            }
            return (
              <div
                key={i}
                className={`flex h-10 items-center justify-center rounded-xl text-sm font-semibold ${color}`}
              >
                {i + 1}
              </div>
            );
          })}
        </div>
        <p className="mt-4 text-xs text-zinc-400">
          Green = correct · Red = wrong · Outline = current
        </p>
      </aside>
    </div>
  );
}
