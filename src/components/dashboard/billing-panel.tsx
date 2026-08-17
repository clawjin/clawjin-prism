"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BadgeCheck,
  Check,
  CreditCard,
  Loader2,
  Lock,
  Sparkles,
} from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { Confetti } from "@/components/dashboard/confetti";

export interface PaymentRow {
  id: number;
  amount: number;
  currency: string;
  status: string;
  provider: string;
  time: string;
}

export interface BillingUser {
  plan: string;
  email: string;
}

const PLAN_LABEL: Record<string, string> = {
  trial: "Trial",
  pro: "Pro",
  enterprise: "Enterprise",
};

export function BillingPanel({
  user,
  payments,
  stripeConfigured,
  hasCustomer,
  celebrateInitial = false,
}: {
  user: BillingUser;
  payments: PaymentRow[];
  stripeConfigured: boolean;
  hasCustomer: boolean;
  celebrateInitial?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [celebrate, setCelebrate] = useState(celebrateInitial);

  async function upgrade(plan: string, interval: "month" | "year") {
    setBusy(`${plan}-${interval}`);
    setError("");
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, interval }),
      });
      const data = await res.json();

      if (data.url) {
        window.location.href = data.url;
        return;
      }
      if (data.demo) {
        // No Stripe configured — simulate the payment locally.
        const demoRes = await fetch("/api/billing/demo-upgrade", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plan }),
        });
        const demoData = await demoRes.json();
        if (demoRes.ok) {
          setCelebrate(true);
          router.refresh();
          window.setTimeout(() => setCelebrate(false), 2500);
        } else {
          setError(demoData.error || "Could not upgrade.");
        }
        return;
      }
      setError(data.error || "Something went wrong.");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  async function manage() {
    setBusy("portal");
    setError("");
    try {
      const res = await fetch("/api/billing/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError("Billing portal is only available with a connected Stripe account.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  const isPaid = user.plan !== "trial";

  const tiers = [
    {
      id: "pro",
      name: "Pro",
      price: "$499",
      period: "/month",
      desc: "For growing brands ready to scale on data.",
      features: [
        "Unlimited data sources",
        "CSV report export",
        "RFM VIP segmentation",
        "Daily Slack briefing dispatch",
        "Priority support",
      ],
      cta: isPaid && user.plan === "pro" ? "Current plan" : "Upgrade to Pro",
      current: user.plan === "pro",
      interval: "month" as const,
    },
    {
      id: "pro-year",
      name: "Pro Annual",
      price: "$4,990",
      period: "/year",
      desc: "Two months free — billed annually.",
      features: [
        "Everything in Pro",
        "Save 17% vs monthly",
        "Annual KPI strategy review",
      ],
      cta: "Go annual",
      current: false,
      interval: "year" as const,
    },
    {
      id: "enterprise",
      name: "Enterprise",
      price: "Custom",
      period: "/year",
      desc: "For $10M+ ARR brands with custom needs.",
      features: [
        "Everything in Pro",
        "Dedicated warehouse",
        "Custom dbt marts",
        "SSO & audit logs",
        "99.9% uptime SLA",
      ],
      cta: user.plan === "enterprise" ? "Current plan" : "Talk to sales",
      current: user.plan === "enterprise",
      interval: "year" as const,
    },
  ];

  return (
    <div className="space-y-6">
      <Confetti trigger={celebrate} />

      {/* Current plan banner */}
      <div className="glass rounded-2xl p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-white ring-1 ring-inset ring-white/15">
              {isPaid ? <BadgeCheck className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
            </div>
            <div>
              <p className="text-sm text-zinc-400">Current plan</p>
              <p className="text-lg font-semibold text-white">
                {PLAN_LABEL[user.plan] ?? "Trial"}
                {user.plan === "pro" && (
                  <span className="ml-2 text-sm font-normal text-zinc-400">$499/mo</span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {isPaid && hasCustomer && (
              <button
                type="button"
                onClick={manage}
                disabled={busy !== null}
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10 disabled:opacity-60"
              >
                {busy === "portal" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CreditCard className="h-4 w-4" />
                )}
                Manage billing
              </button>
            )}
            {isPaid && (
              <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-semibold text-white ring-1 ring-inset ring-white/15">
                Active
              </span>
            )}
          </div>
        </div>
        <p className="mt-3 text-sm text-zinc-500">
          Billing email: <span className="text-zinc-300">{user.email}</span>
        </p>
      </div>

      {/* Demo-mode notice */}
      {!stripeConfigured && (
        <div className="rounded-2xl border border-amber-400/20 bg-amber-400/5 p-4 text-sm text-amber-200/90">
          <Sparkles className="mr-1.5 inline h-4 w-4" />
          <span className="font-medium">Demo billing mode</span> — Stripe keys aren&apos;t
          configured yet, so upgrades are simulated instantly. Add{" "}
          <code className="rounded bg-black/30 px-1">STRIPE_SECRET_KEY</code> to your
          environment to enable real payments.
        </div>
      )}

      {error && (
        <p className="rounded-xl bg-rose-500/10 px-4 py-3 text-sm text-rose-300 ring-1 ring-inset ring-rose-400/30">
          {error}
        </p>
      )}

      {/* Plan tiers */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {tiers.map((t) => (
          <div
            key={t.id}
            className={`relative flex flex-col rounded-3xl p-6 ${
              t.current ? "glass-strong glow" : "glass"
            }`}
          >
            {t.current && (
              <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-prism px-3 py-0.5 text-xs font-bold text-black">
                Current
              </span>
            )}
            <p className="text-sm font-semibold text-zinc-400">{t.name}</p>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-3xl font-semibold tracking-tight text-white">
                {t.price}
              </span>
              <span className="text-sm text-zinc-500">{t.period}</span>
            </div>
            <p className="mt-1.5 text-sm text-zinc-400">{t.desc}</p>
            <ul className="mt-5 flex-1 space-y-2.5">
              {t.features.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm text-zinc-300">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-white" />
                  {f}
                </li>
              ))}
            </ul>
            {t.current ? (
              <div className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-semibold text-white ring-1 ring-inset ring-white/15">
                <BadgeCheck className="h-4 w-4" /> Current plan
              </div>
            ) : t.id === "enterprise" ? (
              <a
                href="mailto:sales@clawjin.com?subject=Enterprise%20plan"
                className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Talk to sales <ArrowRight className="h-4 w-4" />
              </a>
            ) : (
              <button
                type="button"
                onClick={() => upgrade(t.id === "pro" ? "pro" : "pro", t.interval)}
                disabled={busy !== null}
                className="btn-shine mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-prism px-4 py-2.5 text-sm font-semibold text-black transition hover:opacity-90 disabled:opacity-60"
              >
                {busy === `pro-${t.interval}` ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowRight className="h-4 w-4" />
                )}
                {t.cta}
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Payment history */}
      <div className="glass rounded-2xl p-5 sm:p-6">
        <h2 className="text-base font-semibold text-white">Payment history</h2>
        <p className="text-xs text-zinc-500">All charges for this workspace</p>
        {payments.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-500">No payments yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-zinc-500">
                  <th className="py-2 pr-3 font-medium">Date</th>
                  <th className="py-2 pr-3 font-medium">Provider</th>
                  <th className="py-2 pr-3 text-right font-medium">Amount</th>
                  <th className="py-2 text-right font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td className="py-2.5 pr-3 text-zinc-300">{p.time}</td>
                    <td className="py-2.5 pr-3 capitalize text-zinc-300">{p.provider}</td>
                    <td className="py-2.5 pr-3 text-right tabular-nums text-white">
                      {formatCurrency(p.amount)}
                    </td>
                    <td className="py-2.5 text-right">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ring-1 ring-inset ${
                          p.status === "demo"
                            ? "bg-amber-400/10 text-amber-300 ring-amber-400/30"
                            : "bg-emerald-400/10 text-emerald-300 ring-emerald-400/30"
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
