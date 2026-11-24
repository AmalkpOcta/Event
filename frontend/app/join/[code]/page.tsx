"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { api, formatDate } from "@/lib/api";

type JoinEvent = {
  id: string;
  title: string;
  description: string;
  theme?: string;
  start_at: string;
  join_code: string;
  live_phase: string;
  question_count: number;
  capacity: number;
  registration_count: number;
};

export default function JoinPage() {
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const [event, setEvent] = useState<JoinEvent | null>(null);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    void (async () => {
      try {
        const data = await api.get<JoinEvent>(`/events/join/${params.code}`);
        setEvent(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Event not found");
      }
    })();
  }, [params.code]);

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  const countdown = useMemo(() => {
    if (!event) return null;
    const start = new Date(event.start_at).getTime();
    const diff = start - now;
    if (diff <= 0) return { done: true, label: "Starting soon…" };
    const s = Math.floor(diff / 1000);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return {
      done: false,
      label: `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${sec
        .toString()
        .padStart(2, "0")}`,
    };
  }, [event, now]);

  async function onRegister(e: FormEvent) {
    e.preventDefault();
    if (!event) return;
    setBusy(true);
    setError("");
    try {
      await api.post(`/events/${event.id}/register`, { name, email, phone });
      router.push(`/live/${event.id}/play`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setBusy(false);
    }
  }

  if (error && !event) {
    return <p className="mx-auto max-w-lg px-4 py-16 text-red-600">{error}</p>;
  }
  if (!event) {
    return <p className="mx-auto max-w-lg px-4 py-16 text-zinc-500">Loading event…</p>;
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-10 sm:py-14">
      <p className="text-xs uppercase tracking-[0.2em] text-rose-600">Join via QR</p>
      <h1
        className="mt-3 text-3xl font-semibold text-zinc-900"
        style={{ fontFamily: "var(--font-display), serif" }}
      >
        {event.title}
      </h1>
      <p className="mt-2 text-sm text-zinc-500">Starts {formatDate(event.start_at)}</p>
      <p className="mt-4 text-zinc-600 whitespace-pre-wrap">
        {event.description || "Get ready for a timed quiz."}
      </p>

      <div className="mt-8 rounded-3xl border border-zinc-200 bg-white p-6 text-center">
        <p className="text-sm text-zinc-500">Countdown to start</p>
        <p className="mt-2 font-mono text-3xl font-semibold text-zinc-900">
          {countdown?.label}
        </p>
      </div>

      <form className="mt-8 space-y-3" onSubmit={onRegister}>
        <h2 className="font-semibold text-zinc-900">Register to participate</h2>
        <input
          required
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-xl border border-zinc-200 px-3 py-2.5"
        />
        <input
          required
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-xl border border-zinc-200 px-3 py-2.5"
        />
        <input
          required
          placeholder="Phone number"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="w-full rounded-xl border border-zinc-200 px-3 py-2.5"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-full bg-rose-600 px-4 py-2.5 font-medium text-white disabled:opacity-60"
        >
          {busy ? "Registering…" : "Register & enter waiting room"}
        </button>
      </form>
    </div>
  );
}
