"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";

import { api, formatDate } from "@/lib/api";
import { joinUrlForCode } from "@/lib/app-url";
import type { LiveState } from "@/lib/types";

export default function ConductLivePage() {
  const params = useParams<{ id: string }>();
  const [state, setState] = useState<LiveState | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());

  const joinUrl = state?.join_code ? joinUrlForCode(state.join_code) : "";

  const refresh = useCallback(async () => {
    try {
      const data = await api.get<LiveState>(`/events/${params.id}/live/conductor`);
      setState(data);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load conductor view");
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

  const secondsLeft = useMemo(() => {
    if (!state || state.live_phase !== "question" || !state.question_opened_at) {
      return state?.seconds_left ?? null;
    }
    const opened = new Date(state.question_opened_at).getTime();
    return Math.max(0, Math.ceil(state.per_question_seconds - (now - opened) / 1000));
  }, [state, now]);

  const canStart = useMemo(() => {
    if (!state) return false;
    if (state.live_phase !== "waiting") return false;
    if (!state.start_at) return true;
    return Date.now() >= new Date(state.start_at).getTime() - 60_000; // allow 1 min early
  }, [state, now]);

  async function action(path: string) {
    setBusy(true);
    try {
      const data = await api.post<LiveState>(`/events/${params.id}/live/${path}`);
      // conductor endpoints return state-like payloads
      setState(data);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  if (!state && error) {
    return <p className="px-4 py-16 text-red-600">{error}</p>;
  }
  if (!state) return <p className="px-4 py-16 text-zinc-500">Loading conductor view…</p>;

  return (
    <div className="mx-auto grid min-h-[75vh] max-w-6xl gap-6 px-4 py-6 lg:grid-cols-[1fr_280px]">
      <div>
        <p className="text-xs uppercase tracking-[0.18em] text-rose-600">Conductor</p>
        <h1
          className="mt-2 text-3xl font-semibold text-zinc-900"
          style={{ fontFamily: "var(--font-display), serif" }}
        >
          {state.title}
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          {state.registration_count ?? 0} registered · Code {state.join_code}
        </p>

        {state.live_phase === "waiting" && (
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            <div className="rounded-3xl border border-zinc-200 bg-white p-6 text-center">
              <p className="text-sm text-zinc-500">Participants scan to join</p>
              {joinUrl && (
                <div className="mt-4 flex justify-center">
                  <QRCodeSVG value={joinUrl} size={200} />
                </div>
              )}
              <p className="mt-3 break-all text-xs text-zinc-400">{joinUrl}</p>
            </div>
            <div className="flex flex-col justify-center rounded-3xl border border-zinc-200 bg-white p-6">
              <p className="text-sm text-zinc-500">Scheduled start</p>
              <p className="mt-2 text-lg font-semibold">
                {state.start_at ? formatDate(state.start_at) : "—"}
              </p>
              <button
                type="button"
                disabled={!canStart || busy}
                onClick={() => void action("start")}
                className="mt-6 rounded-full bg-rose-600 px-5 py-3 font-medium text-white disabled:opacity-50"
              >
                {canStart ? "Start event" : "Start available at event time"}
              </button>
              <p className="mt-3 text-xs text-zinc-400">
                Starting syncs the first question to every participant screen.
              </p>
            </div>
          </div>
        )}

        {(state.live_phase === "question" || state.live_phase === "reveal") && state.question && (
          <div className="mt-6">
            <div className="mb-3 flex justify-between text-sm text-zinc-500">
              <span>
                Q{state.live_question_index + 1} / {state.total_questions}
              </span>
              <span className="font-semibold text-zinc-900">
                {state.live_phase === "question" ? `${secondsLeft ?? "—"}s` : "Reveal"}
              </span>
            </div>
            <h2
              className="text-2xl font-semibold sm:text-4xl"
              style={{ fontFamily: "var(--font-display), serif" }}
            >
              {state.question.text}
            </h2>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {state.question.options.map((opt) => {
                const correct =
                  state.live_phase === "reveal" &&
                  opt.id === state.question?.correct_option_id;
                return (
                  <div
                    key={opt.id}
                    className={`rounded-2xl border px-4 py-4 text-lg ${
                      correct
                        ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                        : "border-zinc-200 bg-white"
                    }`}
                  >
                    {opt.text}
                  </div>
                );
              })}
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              {state.live_phase === "question" && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void action("reveal")}
                  className="rounded-full border border-zinc-300 px-4 py-2"
                >
                  Reveal answer now
                </button>
              )}
              {(state.live_phase === "reveal" || (secondsLeft !== null && secondsLeft <= 0)) && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void action("next")}
                  className="rounded-full bg-rose-600 px-5 py-2.5 font-medium text-white"
                >
                  Next question
                </button>
              )}
            </div>
          </div>
        )}

        {state.live_phase === "finished" && (
          <div className="mt-8 rounded-3xl border border-zinc-200 bg-white p-8">
            <h2 className="text-2xl font-semibold">Event finished</h2>
            <ol className="mt-4 space-y-2">
              {(state.leaderboard || []).map((row, i) => (
                <li key={row.name + i} className="flex justify-between text-sm">
                  <span>
                    {i + 1}. {row.name}
                  </span>
                  <span className="font-medium">{row.score} pts</span>
                </li>
              ))}
            </ol>
          </div>
        )}
        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      </div>

      <aside className="rounded-3xl border border-zinc-200 bg-white p-4 lg:sticky lg:top-24 lg:self-start">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          {state.live_phase === "reveal" ? "Correct this round" : "Leaderboard"}
        </p>
        {state.live_phase === "reveal" ? (
          <ul className="mt-3 max-h-[60vh] space-y-2 overflow-y-auto text-sm">
            {(state.correct_this_question || []).length === 0 && (
              <li className="text-zinc-400">No correct answers yet</li>
            )}
            {(state.correct_this_question || []).map((row, i) => (
              <li key={row.name + i} className="flex justify-between gap-2 border-b border-zinc-100 py-2">
                <span className="font-medium">{row.name}</span>
                <span className="text-zinc-500">
                  {row.elapsed_ms != null ? `${(row.elapsed_ms / 1000).toFixed(1)}s` : "—"}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <ul className="mt-3 max-h-[60vh] space-y-2 overflow-y-auto text-sm">
            {(state.leaderboard || []).slice(0, 10).map((row, i) => (
              <li key={row.name + i} className="flex justify-between gap-2 py-1">
                <span>
                  {i + 1}. {row.name}
                </span>
                <span className="font-medium">{row.score}</span>
              </li>
            ))}
          </ul>
        )}
      </aside>
    </div>
  );
}
