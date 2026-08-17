import Link from "next/link";
import { Download, Lock, Plug } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getInsights, getOverview } from "@/lib/analytics";
import { hasPaidPlan } from "@/lib/billing";
import {
  formatCurrency,
  formatMultiplier,
  formatNumber,
  formatPercent,
} from "@/lib/format";
import { Badge, Card } from "@/components/ui";
import { AnimatedStatCard } from "@/components/dashboard/animated-stat-card";
import { TodayTakeaway } from "@/components/dashboard/today-takeaway";
import { PipelineButton } from "@/components/dashboard/pipeline-button";
import {
  ChannelComparisonChart,
  Donut,
  RevenueTrendChart,
} from "@/components/charts";

export const dynamic = "force-dynamic";

const CHANNEL_COLORS = ["#fafafa", "#9ca3af", "#71717a"];

export default async function DashboardPage() {
  const user = await requireUser();
  const [{ metrics, trend, channels }, insights] = await Promise.all([
    getOverview(user.id),
    getInsights(user.id),
  ]);

  const donutData = channels.map((c) => ({ name: c.channel, value: c.spend }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-white">
              Unit Economics
            </h1>
            <Badge tone="sky">Last 60 days</Badge>
          </div>
          <p className="mt-1 text-sm text-zinc-400">
            {user.companyName || "Your brand"} · Blended performance across all
            paid channels.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PipelineButton />
          {hasPaidPlan(user.plan) ? (
            <a
              href="/api/export?type=customers"
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm font-medium text-zinc-200 transition hover:border-white/30 hover:text-white"
            >
              <Download className="h-4 w-4" />
              Export
            </a>
          ) : (
            <Link
              href="/dashboard/billing"
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm font-medium text-zinc-400 transition hover:border-white/30 hover:text-white"
            >
              <Lock className="h-4 w-4" />
              Export <span className="text-[10px] font-semibold uppercase text-zinc-500">Pro</span>
            </Link>
          )}
          <Link
            href="/dashboard/connections"
            className="inline-flex items-center gap-2 rounded-xl bg-prism px-3 py-2 text-sm font-semibold text-black transition hover:opacity-90"
          >
            <Plug className="h-4 w-4" />
            Connect a source
          </Link>
        </div>
      </div>

      {/* Greeting + smart takeaway */}
      <TodayTakeaway name={user.name} insights={insights} />

      {/* KPI scorecard */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AnimatedStatCard
          label="Gross revenue"
          value={metrics.revenue}
          format="currencyCompact"
          sub={`${formatNumber(metrics.orders)} completed orders`}
          delta={metrics.revenueDelta}
          delay={0}
        />
        <AnimatedStatCard
          label="Blended ROAS"
          value={metrics.roas}
          format="multiplier"
          sub="Revenue ÷ ad spend"
          delta={metrics.roasDelta}
          accent={metrics.roas >= 1.5 ? "#34d399" : metrics.roas < 1 ? "#f87171" : "#ffffff"}
          delay={70}
        />
        <AnimatedStatCard
          label="Blended CAC"
          value={metrics.cac}
          format="currency"
          sub="Ad spend ÷ orders"
          delta={metrics.cacDelta}
          goodWhenDown
          accent={metrics.cacDelta < 0 ? "#34d399" : metrics.cacDelta > 0 ? "#f87171" : "#ffffff"}
          delay={140}
        />
        <AnimatedStatCard
          label="Contribution margin 1"
          value={metrics.cm1}
          format="currencyCompact"
          sub="Gross profit − ad spend"
          accent={metrics.cm1 >= 0 ? "#34d399" : "#f87171"}
          delay={210}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AnimatedStatCard
          label="Contribution margin 2"
          value={metrics.cm2}
          format="currencyCompact"
          sub="CM1 − ops overhead"
          accent={metrics.cm2 >= 0 ? "#34d399" : "#f87171"}
          delay={0}
        />
        <AnimatedStatCard
          label="Net margin"
          value={metrics.netMargin}
          format="percent"
          sub="CM2 ÷ revenue"
          accent={metrics.netMargin >= 0 ? "#34d399" : "#f87171"}
          delay={70}
        />
        <AnimatedStatCard
          label="Average order value"
          value={metrics.aov}
          format="currency"
          sub="Revenue ÷ orders"
          delay={140}
        />
        <AnimatedStatCard
          label="Ad spend"
          value={metrics.adSpend}
          format="currencyCompact"
          sub="All channels blended"
          delta={metrics.spendDelta}
          goodWhenDown
          delay={210}
        />
      </div>

      {/* Trend */}
      <Card className="p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-white">
              Revenue vs. ad spend
            </h2>
            <p className="text-xs text-zinc-400">Daily, trailing 60 days</p>
          </div>
          <div className="flex items-center gap-4 text-xs text-zinc-400">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-violet-500" /> Revenue
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-zinc-400" /> Ad spend
            </span>
          </div>
        </div>
        <RevenueTrendChart data={trend} />
      </Card>

      {/* Channel breakdown */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <Card className="p-5 sm:p-6 xl:col-span-3">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-white">
              Channel contribution
            </h2>
            <div className="flex items-center gap-4 text-xs text-zinc-400">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-zinc-400" /> Spend
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-violet-500" /> Revenue
              </span>
            </div>
          </div>
          <ChannelComparisonChart
            data={channels.map((c) => ({
              channel: c.channel,
              spend: Math.round(c.spend),
              revenue: Math.round(c.revenue),
            }))}
          />
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-zinc-400">
                  <th className="py-2 pr-3 font-medium">Channel</th>
                  <th className="py-2 pr-3 text-right font-medium">Spend</th>
                  <th className="py-2 pr-3 text-right font-medium">Revenue</th>
                  <th className="py-2 pr-3 text-right font-medium">ROAS</th>
                  <th className="py-2 pr-3 text-right font-medium">CAC</th>
                  <th className="py-2 text-right font-medium">Orders</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {channels.map((c) => (
                  <tr key={c.channel}>
                    <td className="py-2.5 pr-3 font-medium text-white">{c.channel}</td>
                    <td className="py-2.5 pr-3 text-right tabular-nums text-zinc-200">
                      {formatCurrency(c.spend)}
                    </td>
                    <td className="py-2.5 pr-3 text-right tabular-nums text-zinc-200">
                      {formatCurrency(c.revenue)}
                    </td>
                    <td className="py-2.5 pr-3 text-right tabular-nums text-white">
                      {formatMultiplier(c.roas)}
                    </td>
                    <td className="py-2.5 pr-3 text-right tabular-nums text-zinc-200">
                      {formatCurrency(c.cac)}
                    </td>
                    <td className="py-2.5 text-right tabular-nums text-zinc-200">
                      {formatNumber(c.orders)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="p-5 sm:p-6 xl:col-span-2">
          <h2 className="text-base font-semibold text-white">Spend mix</h2>
          <p className="text-xs text-zinc-400">Share of total ad spend</p>
          <Donut data={donutData} colors={CHANNEL_COLORS} />
          <div className="mt-2 space-y-2">
            {channels.map((c, i) => {
              const share = metrics.adSpend > 0 ? (c.spend / metrics.adSpend) * 100 : 0;
              return (
                <div key={c.channel} className="flex items-center gap-2 text-sm">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ background: CHANNEL_COLORS[i % CHANNEL_COLORS.length] }}
                  />
                  <span className="flex-1 text-zinc-200">{c.channel}</span>
                  <span className="tabular-nums text-zinc-400">
                    {formatPercent(share)}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}
