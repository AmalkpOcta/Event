"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { SubscriptionPlan, User } from "@/lib/types";

const PAYMENT_METHODS = [
  { id: "upi", label: "UPI" },
  { id: "credit_card", label: "Credit card" },
  { id: "debit_card", label: "Debit card" },
  { id: "netbanking", label: "Net banking" },
];

type Step = "plans" | "details" | "payment";

export default function SubscribePage() {
  const router = useRouter();
  const { setUser, user } = useAuth();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [step, setStep] = useState<Step>("plans");
  const [planId, setPlanId] = useState("monthly");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [gst, setGst] = useState("");
  const [password, setPassword] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("upi");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user?.subscription_active) {
      router.replace("/org");
    }
  }, [user, router]);

  useEffect(() => {
    void (async () => {
      try {
        const data = await api.get<SubscriptionPlan[]>("/subscriptions/plans");
        setPlans(data);
      } catch {
        setPlans([
          {
            id: "once",
            name: "Once",
            price_inr: 999,
            interval: "one_time",
            description: "One-time access",
          },
          {
            id: "monthly",
            name: "Monthly",
            price_inr: 2499,
            interval: "month",
            description: "Billed monthly",
          },
          {
            id: "yearly",
            name: "Yearly",
            price_inr: 24999,
            interval: "year",
            description: "Best value",
          },
        ]);
      }
    })();
  }, []);

  const selected = plans.find((p) => p.id === planId);

  async function onPay(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const created = await api.post<User>("/subscriptions/subscribe", {
        plan_id: planId,
        name,
        phone,
        email,
        company_name: company,
        gst: gst || null,
        password,
        payment_method: paymentMethod,
      });
      setUser(created);
      router.push("/org");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Subscription failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
      <p className="text-xs uppercase tracking-[0.2em] text-rose-600">Subscribe</p>
      <h1
        className="mt-3 text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl"
        style={{ fontFamily: "var(--font-display), serif" }}
      >
        Choose a plan to host events
      </h1>
      <p className="mt-3 max-w-2xl text-zinc-500">
        After payment you can create quizzes, generate questions with AI, share a QR for
        registration, and run live synced sessions.
      </p>

      {/* Steps */}
      <div className="mt-8 flex flex-wrap gap-2 text-sm">
        {(["plans", "details", "payment"] as Step[]).map((s, i) => (
          <span
            key={s}
            className={`rounded-full px-3 py-1 ${
              step === s ? "bg-rose-600 text-white" : "bg-zinc-100 text-zinc-500"
            }`}
          >
            {i + 1}. {s === "plans" ? "Plan" : s === "details" ? "Your details" : "Payment"}
          </span>
        ))}
      </div>

      {step === "plans" && (
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {plans.map((plan) => (
            <button
              key={plan.id}
              type="button"
              onClick={() => setPlanId(plan.id)}
              className={`rounded-3xl border p-5 text-left transition ${
                planId === plan.id
                  ? "border-rose-500 bg-rose-50 shadow-md"
                  : "border-zinc-200 bg-white hover:border-zinc-300"
              }`}
            >
              <p className="text-lg font-semibold text-zinc-900">{plan.name}</p>
              <p className="mt-2 text-3xl font-semibold text-zinc-900">
                ₹{plan.price_inr.toLocaleString("en-IN")}
                <span className="text-sm font-normal text-zinc-500">
                  {plan.interval === "month"
                    ? "/mo"
                    : plan.interval === "year"
                      ? "/yr"
                      : ""}
                </span>
              </p>
              <p className="mt-3 text-sm text-zinc-500">{plan.description}</p>
            </button>
          ))}
          <div className="sm:col-span-3">
            <button
              type="button"
              disabled={!planId}
              onClick={() => setStep("details")}
              className="rounded-full bg-rose-600 px-5 py-2.5 font-medium text-white hover:bg-rose-700 disabled:opacity-50"
            >
              Continue with {selected?.name || "plan"}
            </button>
          </div>
        </div>
      )}

      {step === "details" && (
        <form
          className="mt-8 max-w-lg space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            setStep("payment");
          }}
        >
          <input
            required
            placeholder="Full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-xl border border-zinc-200 px-3 py-2.5"
          />
          <input
            required
            placeholder="Phone number"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full rounded-xl border border-zinc-200 px-3 py-2.5"
          />
          <input
            required
            type="email"
            placeholder="Work email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-zinc-200 px-3 py-2.5"
          />
          <input
            required
            placeholder="Company name"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            className="w-full rounded-xl border border-zinc-200 px-3 py-2.5"
          />
          <input
            placeholder="GST number (optional)"
            value={gst}
            onChange={(e) => setGst(e.target.value)}
            className="w-full rounded-xl border border-zinc-200 px-3 py-2.5"
          />
          <input
            required
            type="password"
            minLength={8}
            placeholder="Create password (min 8 chars)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-zinc-200 px-3 py-2.5"
          />
          <div className="flex flex-wrap gap-2 pt-2">
            <button
              type="button"
              onClick={() => setStep("plans")}
              className="rounded-full border border-zinc-200 px-4 py-2 text-zinc-600"
            >
              Back
            </button>
            <button
              type="submit"
              className="rounded-full bg-rose-600 px-5 py-2.5 font-medium text-white hover:bg-rose-700"
            >
              Continue to payment
            </button>
          </div>
        </form>
      )}

      {step === "payment" && (
        <form className="mt-8 max-w-lg space-y-4" onSubmit={onPay}>
          <div className="rounded-2xl border border-zinc-200 bg-white p-4">
            <p className="text-sm text-zinc-500">Selected plan</p>
            <p className="mt-1 text-lg font-semibold">
              {selected?.name} — ₹{selected?.price_inr.toLocaleString("en-IN")}
            </p>
            <p className="mt-1 text-sm text-zinc-500">{company || "Your company"}</p>
          </div>
          <p className="text-sm font-medium text-zinc-800">Payment method</p>
          <div className="grid grid-cols-2 gap-2">
            {PAYMENT_METHODS.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setPaymentMethod(m.id)}
                className={`rounded-xl border px-3 py-3 text-sm ${
                  paymentMethod === m.id
                    ? "border-rose-500 bg-rose-50 text-rose-700"
                    : "border-zinc-200 bg-white"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-zinc-400">
            Demo mode: payment is simulated. Razorpay/UPI can be wired later.
          </p>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setStep("details")}
              className="rounded-full border border-zinc-200 px-4 py-2 text-zinc-600"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={busy}
              className="rounded-full bg-rose-600 px-5 py-2.5 font-medium text-white hover:bg-rose-700 disabled:opacity-60"
            >
              {busy ? "Processing…" : `Pay ₹${selected?.price_inr.toLocaleString("en-IN")}`}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
