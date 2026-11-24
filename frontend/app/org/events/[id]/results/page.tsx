"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { api, formatDate } from "@/lib/api";
import { useAuth } from "@/lib/auth";

type ResultsPayload = {
  event_id: string;
  registration_count: number;
  attempt_count: number;
  attempts: Array<{
    attempt_id: string;
    name?: string;
    email?: string;
    status: string;
    score: number;
    max_score: number;
    finished_at?: string | null;
  }>;
};

export default function ResultsPage() {
  const params = useParams<{ id: string }>();
  const { user, loading } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<ResultsPayload | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      try {
        const res = await api.get<ResultsPayload>(`/events/${params.id}/results`);
        setData(res);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load results");
      }
    })();
  }, [user, params.id]);

  if (loading || !user) return <p className="text-[var(--muted)]">Loading…</p>;
  if (error) return <p className="text-[var(--danger)]">{error}</p>;
  if (!data) return <p className="text-[var(--muted)]">Loading results…</p>;

  return (
    <div>
      <Link href={`/org/events/${params.id}`} className="text-sm text-[var(--accent)]">
        ← Back to event
      </Link>
      <h1
        className="mt-3 text-3xl font-semibold"
        style={{ fontFamily: "var(--font-display), serif" }}
      >
        Results
      </h1>
      <p className="mt-2 text-[var(--muted)]">
        {data.registration_count} registered · {data.attempt_count} attempts
      </p>
      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead className="border-b border-[var(--line)] text-[var(--muted)]">
            <tr>
              <th className="py-2 pr-3 font-medium">Name</th>
              <th className="py-2 pr-3 font-medium">Email</th>
              <th className="py-2 pr-3 font-medium">Status</th>
              <th className="py-2 pr-3 font-medium">Score</th>
              <th className="py-2 font-medium">Finished</th>
            </tr>
          </thead>
          <tbody>
            {data.attempts.map((a) => (
              <tr key={a.attempt_id} className="border-b border-[var(--line)]/70">
                <td className="py-3 pr-3">{a.name || "—"}</td>
                <td className="py-3 pr-3">{a.email || "—"}</td>
                <td className="py-3 pr-3">{a.status}</td>
                <td className="py-3 pr-3">
                  {a.score}/{a.max_score}
                </td>
                <td className="py-3">
                  {a.finished_at ? formatDate(a.finished_at) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {data.attempts.length === 0 && (
          <p className="mt-4 text-[var(--muted)]">No attempts yet.</p>
        )}
      </div>
    </div>
  );
}
