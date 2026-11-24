"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useAuthModal } from "@/lib/auth-modal";

export function AuthModal() {
  const { mode, close } = useAuthModal();
  const { refresh } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!mode) return;
    setError("");
    setPassword("");
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [mode, close]);

  if (!mode) return null;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api.post("/auth/login", { email, password });
      await refresh();
      close();
      router.push("/org");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-zinc-950/55 p-0 sm:items-center sm:p-4"
      onClick={close}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
        className="w-full max-w-md rounded-t-3xl bg-white p-6 shadow-2xl sm:rounded-3xl sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-rose-600">Account</p>
            <h2
              id="auth-modal-title"
              className="mt-1 text-2xl font-semibold text-zinc-900"
              style={{ fontFamily: "var(--font-display), serif" }}
            >
              Welcome back
            </h2>
          </div>
          <button
            type="button"
            onClick={close}
            className="rounded-full px-2 py-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <form className="mt-6 space-y-3" onSubmit={onSubmit}>
          <input
            required
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 outline-none ring-rose-500 focus:bg-white focus:ring-2"
          />
          <input
            required
            type="password"
            minLength={8}
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 outline-none ring-rose-500 focus:bg-white focus:ring-2"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-full bg-rose-600 px-4 py-2.5 font-medium text-white transition hover:bg-rose-700 disabled:opacity-60"
          >
            {busy ? "Signing in…" : "Log in"}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-zinc-500">
          New here?{" "}
          <Link
            href="/subscribe"
            onClick={close}
            className="font-medium text-rose-600 hover:text-rose-700"
          >
            Subscribe
          </Link>
        </p>
      </div>
    </div>
  );
}
