"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BellRing,
  Check,
  CheckCircle2,
  Info,
  LayoutDashboard,
  Repeat,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import {
  ChannelComparisonChart,
  Donut,
  RevenueTrendChart,
} from "@/components/charts";
import { Badge, DeltaBadge } from "@/components/ui";
import { CountUp } from "@/components/demo/count-up";
import { formatCurrency, formatMultiplier, formatNumber } from "@/lib/format";
import { SEGMENT_COLORS } from "@/lib/segments";
import type {
  ChannelStat,
  CohortMatrix,
  Insight,
  SegmentStat,
  TrendPoint,
  UnitMetrics,
} from "@/lib/analytics";

interface DemoAlert {
  title: string;
  message: string;
  severity: "critical" | "warning" | "success" | "info";
  time: string;
}

const SEVERITY_ICON: Record<DemoAlert["severity"], typeof Info> = {
  critical: AlertTriangle,
  warning: AlertCircle,
  success: CheckCircle2,
  info: Info,
};
const SEVERITY_COLOR: Record<DemoAlert["severity"], string> = {
  critical: "text-rose-400",
  warning: "text-amber-400",
  success: "text-emerald-400",
  info: "text-zinc-400",
};

const CHANNEL_COLORS = ["#fafafa", "#9ca3af", "#71717a"];

const STEPS = [
  { id: "overview", icon: LayoutDashboard, label: "Overview" },
  { id: "revenue", icon: TrendingUp, label: "Revenue & spend" },
  { id: "channels", icon: TrendingUp, label: "Channels" },
  { id: "cohorts", icon: Repeat, label: "Retention" },
  { id: "segments", icon: Users, label: "Customers" },
  { id: "briefing", icon: BellRing, label: "Briefing" },
  { id: "insights", icon: Sparkles, label: "Smart insights" },
];

function cohortCellBackground(value: number): string {
  const alpha = Math.max(0.06, Math.min(1, value / 100));
  return `rgba(255,255,255,${alpha})`;
}

export function DemoTour({
  metrics,
  trend,
  channels,
  cohorts,
  segments,
  insights,
  alerts,
}: {
  metrics: UnitMetrics;
  trend: TrendPoint[];
  channels: ChannelStat[];
  cohorts: CohortMatrix;
  segments: SegmentStat[];
  insights: Insight[];
  alerts: DemoAlert[];
}) {
  const [step, setStep] = useState(0);
  const total = STEPS.length;
  const current = STEPS[step];

  const next = useCallback(() => setStep((s) => Math.min(total - 1, s + 1)), [total]);
  const prev = useCallback(() => setStep((s) => Math.max(0, s - 1)), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev]);

  const donutData = channels.map((c) => ({ name: c.channel, value: c.spend }));

  return (
    <div className="mx-auto max-w-6xl">
      {/* Demo banner */}
      <div className="mb-6 flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-center text-xs text-zinc-300 backdrop-blur">
        <Sparkles className="h-3.5 w-3.5 text-white" />
        You&apos;re exploring a live demo workspace with sample data — no account
        needed.
      </div>

      {/* Stepper */}
      <div className="mb-8 overflow-x-auto pb-1">
        <div className="flex min-w-max items-center gap-2">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const active = i === step;
            const done = i < step;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setStep(i)}
                className={`flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-medium transition ${
                  active
                    ? "bg-white text-black"
                    : done
                      ? "bg-white/10 text-white ring-1 ring-inset ring-white/15"
                      : "text-zinc-400 hover:bg-white/5 hover:text-white"
                }`}
              >
                {done ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Icon className="h-3.5 w-3.5" />
                )}
                <span className="whitespace-nowrap">{s.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tour body */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Explanation */}
        <div className="min-w-0 lg:col-span-2">
          <div className="glass-strong self-start rounded-3xl p-6 sm:p-7 lg:sticky lg:top-24">
            <Badge tone="violet" className="mb-4">
              {step + 1} of {total}
            </Badge>
            <h2 className="text-2xl font-semibold tracking-tight text-white">
              {HEADINGS[step].title}
            </h2>
            <p className="mt-3 leading-relaxed text-zinc-400">
              {HEADINGS[step].description}
            </p>
            <div className="mt-5 rounded-2xl border border-white/10 bg-black/30 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                Why it matters
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-zinc-300">
                {HEADINGS[step].meaning}
              </p>
            </div>

            <div className="mt-6 flex items-center justify-between">
              <button
                type="button"
                onClick={prev}
                disabled={step === 0}
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 px-3.5 py-2 text-sm font-medium text-zinc-300 transition hover:bg-white/5 disabled:opacity-40"
              >
                <ArrowLeft className="h-4 w-4" /> Back
              </button>
              {step < total - 1 ? (
                <button
                  type="button"
                  onClick={next}
                  className="btn-shine inline-flex items-center gap-1.5 rounded-xl bg-prism px-4 py-2 text-sm font-semibold text-black transition hover:opacity-90"
                >
                  Next <ArrowRight className="h-4 w-4" />
                </button>
              ) : (
                <Link
                  href="/signup"
                  className="btn-shine inline-flex items-center gap-1.5 rounded-xl bg-prism px-4 py-2 text-sm font-semibold text-black transition hover:opacity-90"
                >
                  Start free trial <ArrowRight className="h-4 w-4" />
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Live preview */}
        <div className="min-w-0 lg:col-span-3">
          <div key={step} className="rise space-y-4">
            {step === 0 && <OverviewPreview metrics={metrics} />}
            {step === 1 && (
              <div className="glass rounded-3xl p-5 sm:p-6">
                <RevenueTrendChart data={trend} />
              </div>
            )}
            {step === 2 && (
              <div className="glass rounded-3xl p-5 sm:p-6">
                <ChannelComparisonChart
                  data={channels.map((c) => ({
                    channel: c.channel,
                    spend: Math.round(c.spend),
                    revenue: Math.round(c.revenue),
                  }))}
                />
                <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="min-w-0">
                    <p className="mb-2 text-xs text-zinc-500">Spend mix</p>
                    <Donut data={donutData} colors={CHANNEL_COLORS} />
                  </div>
                  <div className="space-y-2.5">
                    {channels.map((c) => (
                      <div
                        key={c.channel}
                        className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm"
                      >
                        <span className="text-zinc-300">{c.channel}</span>
                        <span
                          className={`tabular-nums font-medium ${
                            c.roas >= 2 ? "text-emerald-400" : c.roas < 1 ? "text-rose-400" : "text-white"
                          }`}
                        >
                          {formatMultiplier(c.roas)} ROAS
                        </span>
                        <span className="text-zinc-400">{formatCurrency(c.cac)} CAC</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {step === 3 && (
              <div className="glass rounded-3xl p-5 sm:p-6">
                <CohortPreview cohorts={cohorts} />
              </div>
            )}
            {step === 4 && <SegmentsPreview segments={segments} />}
            {step === 5 && <BriefingPreview alerts={alerts} />}
            {step === 6 && <InsightsPreview insights={insights} />}
          </div>
        </div>
      </div>

      {/* Persistent CTA */}
      <div className="mt-10 flex flex-col items-center justify-center gap-3 rounded-3xl border border-white/10 bg-white/[0.03] p-6 text-center sm:flex-row sm:gap-4">
        <p className="text-sm text-zinc-300">
          Like what you see? Connect your own Shopify + ads in minutes.
        </p>
        <div className="flex items-center gap-2">
          <Link
            href="/signup"
            className="btn-shine inline-flex items-center gap-2 rounded-xl bg-prism px-5 py-2.5 text-sm font-semibold text-black transition hover:opacity-90"
          >
            Start free trial <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/#pricing"
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/5"
          >
            See pricing
          </Link>
        </div>
      </div>
    </div>
  );
}

const HEADINGS = [
  {
    title: "Your whole business, one screen",
    description:
      "Connect Shopify and your ad accounts and every KPI — revenue, blended CAC, ROAS and contribution margin — updates automatically, in real time.",
    meaning:
      "This is the scorecard you check every morning instead of rebuilding spreadsheets for 15 hours a week.",
  },
  {
    title: "See what's actually working",
    description:
      "Revenue plotted against ad spend, day by day. The gap between the two lines is your profit engine — or your leak.",
    meaning:
      "Spot the exact day spend stopped paying for itself, and fix it before it compounds.",
  },
  {
    title: "Know where every dollar goes",
    description:
      "Spend, revenue, ROAS and CAC broken down by channel — Meta, Google, TikTok — so you cut the losers and double down on winners.",
    meaning:
      "At least one channel is quietly losing you money. You'll see exactly which one, instantly.",
  },
  {
    title: "Do customers come back?",
    description:
      "The monthly repurchase matrix shows what % of each month's new buyers still purchase 30, 60 and 90 days later.",
    meaning:
      "Retention drives blended CAC down. Watch your repeat-purchase curve improve as you act on it.",
  },
  {
    title: "Know your best customers",
    description:
      "RFM segmentation ranks every customer — VIP, loyal, at-risk, lost — by recency, frequency and lifetime value.",
    meaning:
      "Run win-back and VIP campaigns against the right people, instead of spraying everyone.",
  },
  {
    title: "A daily briefing, on autopilot",
    description:
      "Every morning at 8:00 AM, a verified KPI scorecard lands in your Slack — with alerts when CAC spikes or ROAS drops.",
    meaning:
      "Leadership always knows the numbers, even when you're not in the room.",
  },
  {
    title: "Your story, in plain language",
    description:
      "The engine reads your data and tells you what's happening — which channel is winning, where you're profiting, and what to fix — like a data analyst on your team.",
    meaning:
      "No charts to decipher. You get the verdict and the action, every single morning.",
  },
];

function OverviewPreview({ metrics }: { metrics: UnitMetrics }) {
  const cards = [
    {
      label: "Gross revenue",
      value: <CountUp value={metrics.revenue} format={(n) => formatCurrency(n, { compact: true })} />,
      delta: metrics.revenueDelta,
      tone: metrics.revenueDelta >= 0 ? "gain" : "loss",
    },
    {
      label: "Blended ROAS",
      value: <CountUp value={metrics.roas} format={(n) => formatMultiplier(n)} />,
      delta: metrics.roasDelta,
      tone: metrics.roas >= 1.5 ? "gain" : metrics.roas < 1 ? "loss" : "neutral",
    },
    {
      label: "Blended CAC",
      value: <CountUp value={metrics.cac} format={(n) => formatCurrency(n)} />,
      delta: metrics.cacDelta,
      goodWhenDown: true,
      tone: metrics.cacDelta < 0 ? "gain" : metrics.cacDelta > 0 ? "loss" : "neutral",
    },
    {
      label: "Contribution margin",
      value: <CountUp value={metrics.cm1} format={(n) => formatCurrency(n, { compact: true })} />,
      delta: undefined,
      tone: metrics.cm1 >= 0 ? "gain" : "loss",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {cards.map((c) => (
        <div key={c.label} className="glass rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-zinc-400">{c.label}</p>
            {c.delta !== undefined && <DeltaBadge value={c.delta} goodWhenDown={c.goodWhenDown} />}
          </div>
          <p
            className={`mt-2 text-3xl font-semibold tracking-tight tabular-nums ${
              c.tone === "gain"
                ? "text-emerald-400"
                : c.tone === "loss"
                  ? "text-rose-400"
                  : "text-white"
            }`}
          >
            {c.value}
          </p>
        </div>
      ))}
    </div>
  );
}

function InsightsPreview({ insights }: { insights: Insight[] }) {
  const TONE_STYLE: Record<Insight["tone"], { border: string; text: string; dot: string }> = {
    positive: { border: "border-emerald-400/30", text: "text-emerald-400", dot: "bg-emerald-400" },
    negative: { border: "border-rose-400/30", text: "text-rose-400", dot: "bg-rose-400" },
    neutral: { border: "border-white/10", text: "text-zinc-300", dot: "bg-zinc-400" },
  };

  return (
    <div className="glass rounded-3xl p-5 sm:p-6">
      <div className="mb-4 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-white" />
        <p className="text-base font-semibold text-white">What the engine sees</p>
      </div>
      <div className="space-y-3">
        {insights.map((ins, i) => {
          const tone = TONE_STYLE[ins.tone];
          return (
            <div
              key={i}
              className={`rounded-2xl border bg-white/[0.03] p-4 ${tone.border}`}
            >
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${tone.dot}`} />
                <p className="text-sm font-semibold text-white">{ins.title}</p>
              </div>
              <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">{ins.body}</p>
            </div>
          );
        })}
      </div>
      <p className="mt-4 text-xs text-zinc-500">
        This summary is generated live from the demo data — your workspace produces
        the same plain-language insights every morning.
      </p>
    </div>
  );
}

function CohortPreview({ cohorts }: { cohorts: CohortMatrix }) {
  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-1 text-sm">
          <thead>
            <tr>
              <th className="px-2 py-1 text-left text-xs font-medium text-zinc-500">Cohort</th>
              <th className="px-2 py-1 text-right text-xs font-medium text-zinc-500">Size</th>
              {cohorts.columns.map((c, i) => (
                <th key={c} className="px-2 py-1 text-right text-xs font-medium text-zinc-500">
                  {i === 0 ? "M0" : c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cohorts.rows.slice(-6).map((row) => (
              <tr key={row.label}>
                <td className="whitespace-nowrap px-2 py-1 font-medium text-white">{row.label}</td>
                <td className="px-2 py-1 text-right tabular-nums text-zinc-400">{row.size}</td>
                {row.values.map((v, i) => (
                  <td
                    key={i}
                    className="rounded-md px-2 py-2 text-right text-xs font-semibold tabular-nums"
                    style={{
                      background: cohortCellBackground(v),
                      color: v >= 45 ? "#0b0b0d" : "#a1a1aa",
                    }}
                  >
                    {v.toFixed(1)}%
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-zinc-500">
        Darker = stronger repeat-purchase retention in the months after a cohort&apos;s first order.
      </p>
    </div>
  );
}

function SegmentsPreview({ segments }: { segments: SegmentStat[] }) {
  return (
    <div className="glass rounded-3xl p-5 sm:p-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {segments.map((s) => (
          <div key={s.segment} className="glass-subtle rounded-2xl p-4">
            <div className="flex items-center gap-2.5">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: SEGMENT_COLORS[s.segment] }}
              />
              <p className="font-medium text-white">{s.label}</p>
              <span className="ml-auto text-xs text-zinc-500">{formatNumber(s.count)}</span>
            </div>
            <p className="mt-2 text-xs text-zinc-400">
              Avg. LTV {formatCurrency(s.avgSpend)} · {s.avgOrders.toFixed(1)} orders
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function BriefingPreview({ alerts }: { alerts: DemoAlert[] }) {
  return (
    <div className="glass rounded-3xl p-5 sm:p-6">
      <div className="space-y-3">
        {alerts.slice(0, 4).map((a, i) => {
          const Icon = SEVERITY_ICON[a.severity] ?? Info;
          return (
            <div key={i} className="flex gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${SEVERITY_COLOR[a.severity]}`} />
              <div>
                <p className="text-sm font-medium text-white">{a.title}</p>
                <p className="mt-0.5 text-sm text-zinc-400">{a.message}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
