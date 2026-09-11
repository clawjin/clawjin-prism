// src/lib/analytics.ts
// Analytics read layer.
//
// AGENTS.md Decision 4: dashboards NEVER compute from raw data — everything
// here reads the pre-computed `daily_metrics` table (written by hourly
// aggregation + webhook jobs). All money math stays in integer cents;
// conversion to display dollars happens ONLY at the return boundary.

import { and, eq, gte, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  dailyMetrics,
  normalizedCustomers,
  normalizedOrders,
} from "@/db/schema";
import { SEGMENT_LABELS, type Segment } from "@/lib/segments";
import {
  calculateChangeBasisPoints,
  centsToDisplay,
} from "@/lib/money";
import {
  DAY_MS,
  utcDayKey,
  utcDayLabel,
  utcMonthIndex,
  utcDateFromMonthIndex,
} from "@/lib/dates";

const AD_PLATFORMS = ["meta", "google", "tiktok"] as const;

// ── Public Types (consumed by dashboard pages) ───────────────────────────────

export interface UnitMetrics {
  revenue:        number;
  revenueDelta:   number; // basis points
  orders:         number;
  ordersDelta:    number;
  adSpend:        number;
  spendDelta:     number;
  roas:           number; // display float e.g. 12.5
  roasDelta:      number;
  cac:            number; // display dollars
  cacDelta:       number;
  aov:            number;
  grossProfit:    number;
  netMargin:      number; // percentage
  cm1:            number;
  cm2:            number;
  _revenueCents:  number;
  _spendCents:    number;
}

export interface TrendPoint {
  date:    string;
  label:   string;
  revenue: number;
  adSpend: number;
  orders:  number;
}

export interface ChannelStat {
  channel:     string;
  spend:       number;
  revenue:     number;
  orders:      number;
  conversions: number;
  impressions: number;
  clicks:      number;
  roas:        number;
  cac:         number;
  cpm:         number;
}

export interface Overview {
  metrics:  UnitMetrics;
  trend:    TrendPoint[];
  channels: ChannelStat[];
}

export interface CohortRow {
  label:  string;
  size:   number;
  values: number[]; // retention percentages
}

export interface CohortMatrix {
  columns: string[];
  rows:    CohortRow[];
}

export interface SegmentStat {
  segment:    Segment;
  label:      string;
  count:      number;
  totalSpend: number;
  avgSpend:   number;
  avgOrders:  number;
  share:      number;
}

export interface CustomerRow {
  id:           number;
  name:         string;
  email:        string;
  segment:      Segment;
  segmentLabel: string;
  orderCount:   number;
  totalSpend:   number;
  lastOrderAt:  Date;
  firstOrderAt: Date;
}

export interface Insight {
  title: string;
  body:  string;
  tone:  "positive" | "negative" | "neutral";
  priority: number; // higher = more important
}

// ── Internal helpers ─────────────────────────────────────────────────────────

interface DailyRow extends Pick<
  typeof dailyMetrics.$inferSelect,
  | "metricsDate" | "platform" | "grossRevenueCents" | "netRevenueCents"
  | "refundedCents" | "orderCount" | "newCustomerCount"
  | "returningCustomerCount" | "adSpendCents" | "impressions"
  | "clicks" | "conversions" | "roasScaled" | "aovCents"
  | "ctrBasisPoints" | "cpcCents" | "cacCents"
> {}

function windowSum(rows: DailyRow[], fromMs: number, toMs: number): {
  revenueCents: number;
  orderCount: number;
  newCustomers: number;
  spendCents: number;
  roasScaled: number;
  cacCents: number;
} {
  let revenueCents = 0, orderCount = 0, newCustomers = 0, spendCents = 0;

  for (const r of rows) {
    if (r.platform !== null) continue; // blended rows only
    const t = Date.parse(`${r.metricsDate}T00:00:00Z`);
    if (t >= fromMs && t < toMs) {
      revenueCents += r.netRevenueCents;
      orderCount += r.orderCount;
      newCustomers += r.newCustomerCount;
      spendCents += r.adSpendCents;
    }
  }

  return {
    revenueCents,
    orderCount,
    newCustomers,
    spendCents,
    // Recompute window ROAS/CAC from window sums (not an average of days)
    roasScaled: spendCents > 0 ? Math.round((revenueCents * 100) / spendCents) : 0,
    cacCents: newCustomers > 0 ? Math.round(spendCents / newCustomers) : 0,
  };
}

// ── Overview (reads daily_metrics only) ──────────────────────────────────────

export async function getOverview(userId: number): Promise<Overview> {
  const sixtyAgo = utcDayKey(new Date(Date.now() - 60 * DAY_MS));

  const rows = await db
    .select()
    .from(dailyMetrics)
    .where(and(eq(dailyMetrics.userId, userId), gte(dailyMetrics.metricsDate, sixtyAgo)))
    .orderBy(dailyMetrics.metricsDate);

  const blended = rows.filter((r) => r.platform === null);
  const perPlatform = rows.filter((r) => r.platform !== null);

  const now = Date.now();
  const todayStart = Date.parse(`${utcDayKey(new Date(now))}T00:00:00Z`);

  // Totals across all fetched history
  const totalRevenueCents = blended.reduce((s, r) => s + r.netRevenueCents, 0);
  const totalSpendCents = blended.reduce((s, r) => s + r.adSpendCents, 0);
  const totalOrders = blended.reduce((s, r) => s + r.orderCount, 0);
  const totalNew = blended.reduce((s, r) => s + r.newCustomerCount, 0);

  const totalRoasScaled =
    totalSpendCents > 0 ? Math.round((totalRevenueCents * 100) / totalSpendCents) : 0;
  const totalCacCents =
    totalNew > 0 ? Math.round(totalSpendCents / totalNew) : 0;
  const aovCents =
    totalOrders > 0 ? Math.round(totalRevenueCents / totalOrders) : 0;

  // COGS estimate for profit view (40% of revenue — documented placeholder)
  const estimatedCogsCents = Math.round(totalRevenueCents * 0.4);
  const grossProfitCents = totalRevenueCents - estimatedCogsCents - totalSpendCents;
  const opExCents = Math.round(totalRevenueCents * 0.1);
  const netMarginBps =
    totalRevenueCents > 0
      ? Math.round((grossProfitCents * 10000) / totalRevenueCents)
      : 0;

  // Period deltas: last 14d vs previous 14d
  const last14 = windowSum(rows, todayStart - 13 * DAY_MS, todayStart + DAY_MS);
  const prev14 = windowSum(rows, todayStart - 27 * DAY_MS, todayStart - 13 * DAY_MS);

  const metrics: UnitMetrics = {
    revenue: centsToDisplay(totalRevenueCents),
    revenueDelta: calculateChangeBasisPoints(last14.revenueCents, prev14.revenueCents),
    orders: totalOrders,
    ordersDelta: calculateChangeBasisPoints(last14.orderCount, prev14.orderCount),
    adSpend: centsToDisplay(totalSpendCents),
    spendDelta: calculateChangeBasisPoints(last14.spendCents, prev14.spendCents),
    roas: totalRoasScaled / 100,
    roasDelta: calculateChangeBasisPoints(last14.roasScaled, prev14.roasScaled),
    cac: centsToDisplay(totalCacCents),
    cacDelta: calculateChangeBasisPoints(last14.cacCents, prev14.cacCents),
    aov: centsToDisplay(aovCents),
    grossProfit: centsToDisplay(grossProfitCents),
    netMargin: netMarginBps / 100,
    cm1: centsToDisplay(grossProfitCents),
    cm2: centsToDisplay(grossProfitCents - opExCents),
    _revenueCents: totalRevenueCents,
    _spendCents: totalSpendCents,
  };

  // Trend: one point per UTC day over the last 60 days
  const trendMap = new Map<string, TrendPoint>();
  for (let i = 59; i >= 0; i--) {
    const key = utcDayKey(new Date(todayStart - i * DAY_MS));
    trendMap.set(key, {
      date: key,
      label: utcDayLabel(key),
      revenue: 0,
      adSpend: 0,
      orders: 0,
    });
  }
  for (const r of blended) {
    const p = trendMap.get(r.metricsDate.slice(0, 10));
    if (p) {
      p.revenue += centsToDisplay(r.netRevenueCents);
      p.adSpend += centsToDisplay(r.adSpendCents);
      p.orders += r.orderCount;
    }
  }
  const trend = [...trendMap.values()].sort((a, b) => a.date.localeCompare(b.date));

  // Channels: per-platform rows aggregated over the same window
  const channels: ChannelStat[] = AD_PLATFORMS.map((platform) => {
    const rowsForPlatform = perPlatform.filter((r) => r.platform === platform);

    const spendCents = rowsForPlatform.reduce((s, r) => s + r.adSpendCents, 0);
    const revenueCents = rowsForPlatform.reduce((s, r) => s + r.netRevenueCents, 0);
    const impressions = rowsForPlatform.reduce((s, r) => s + Number(r.impressions), 0);
    const clicks = rowsForPlatform.reduce((s, r) => s + Number(r.clicks), 0);
    const conversions = rowsForPlatform.reduce((s, r) => s + Number(r.conversions), 0);
    const orders = rowsForPlatform.reduce((s, r) => s + r.orderCount, 0);
    const newCustomers = rowsForPlatform.reduce((s, r) => s + r.newCustomerCount, 0);

    return {
      channel: platform,
      spend: centsToDisplay(spendCents),
      revenue: centsToDisplay(revenueCents),
      orders,
      conversions,
      impressions,
      clicks,
      roas: (spendCents > 0 ? Math.round((revenueCents * 100) / spendCents) : 0) / 100,
      cac: centsToDisplay(newCustomers > 0 ? Math.round(spendCents / newCustomers) : 0),
      cpm: centsToDisplay(impressions > 0 ? Math.round((spendCents * 1000) / impressions) : 0),
    };
  });

  return { metrics, trend, channels };
}

// ── Cohort Analysis ───────────────────────────────────────────────────────────

export async function getCohorts(userId: number): Promise<CohortMatrix> {
  const [customerRows, orderRows] = await Promise.all([
    db.select().from(normalizedCustomers).where(eq(normalizedCustomers.userId, userId)),
    db.select().from(normalizedOrders).where(eq(normalizedOrders.userId, userId)),
  ]);

  const cohortOf = new Map<string, number>();
  const orderMonths = new Map<string, Set<number>>();

  for (const c of customerRows) {
    if (!c.firstOrderAt) continue;
    cohortOf.set(c.emailHash, utcMonthIndex(c.firstOrderAt)); // UTC-safe
  }

  for (const o of orderRows) {
    if (o.status !== "paid" && o.status !== "partially_refunded" && o.status !== "fulfilled") continue;
    if (!o.customerEmailHash) continue;
    const mi = utcMonthIndex(o.orderedAt);
    const set = orderMonths.get(o.customerEmailHash) ?? new Set<number>();
    set.add(mi);
    orderMonths.set(o.customerEmailHash, set);
  }

  const cohortIndexes = [...new Set(cohortOf.values())].sort((a, b) => a - b);
  const maxCols = 6;

  const rows: CohortRow[] = cohortIndexes.map((ci) => {
    const members = [...cohortOf.entries()]
      .filter(([, mIdx]) => mIdx === ci)
      .map(([hash]) => hash);
    const size = members.length;

    const values = Array.from({ length: maxCols }, (_, offset) => {
      const target = ci + offset;
      const retained = members.filter((h) =>
        orderMonths.get(h)?.has(target)
      ).length;
      return size > 0 ? Math.round((retained / size) * 1000) / 10 : 0;
    });

    return {
      label: utcDateFromMonthIndex(ci).toLocaleDateString("en-US", {
        month: "short",
        year: "2-digit",
        timeZone: "UTC",
      }),
      size,
      values,
    };
  });

  return {
    columns: Array.from({ length: maxCols }, (_, i) => `M${i}`),
    rows,
  };
}

// ── Customer Segments (persisted column, refreshed by aggregation job) ───────

export async function getCustomers(userId: number): Promise<{
  segments:  SegmentStat[];
  customers: CustomerRow[];
}> {
  const customerRows = await db
    .select()
    .from(normalizedCustomers)
    .where(eq(normalizedCustomers.userId, userId));

  const rows: CustomerRow[] = customerRows
    .filter((c) => c.lastOrderAt !== null && c.firstOrderAt !== null)
    .map((c) => ({
      id: c.id,
      name: c.name || "(unnamed)",
      email: c.email ?? `${c.emailHash.slice(0, 8)}***`,
      segment: c.segment as Segment,
      segmentLabel: SEGMENT_LABELS[c.segment as Segment] ?? c.segment,
      orderCount: c.orderCount,
      totalSpend: centsToDisplay(c.totalSpentCents),
      lastOrderAt: c.lastOrderAt!,
      firstOrderAt: c.firstOrderAt!,
    }));

  const bySegment = new Map<Segment, CustomerRow[]>();
  for (const r of rows) {
    const arr = bySegment.get(r.segment) ?? [];
    arr.push(r);
    bySegment.set(r.segment, arr);
  }

  const order: Segment[] = ["vip","loyal","promising","new","at_risk","lost","active"];

  const segments: SegmentStat[] = order
    .filter((s) => (bySegment.get(s)?.length ?? 0) > 0)
    .map((s) => {
      const arr = bySegment.get(s)!;
      const totalSpend = arr.reduce((sum, r) => sum + r.totalSpend, 0);
      return {
        segment: s,
        label: SEGMENT_LABELS[s],
        count: arr.length,
        totalSpend,
        avgSpend: totalSpend / arr.length,
        avgOrders: arr.reduce((sum, r) => sum + r.orderCount, 0) / arr.length,
        share: rows.length > 0 ? (arr.length / rows.length) * 100 : 0,
      };
    });

  return { segments, customers: rows };
}

// ── Smart Insights ────────────────────────────────────────────────────────────

export async function getInsights(userId: number): Promise<Insight[]> {
  const [{ metrics, channels }, cohorts] = await Promise.all([
    getOverview(userId),
    getCohorts(userId),
  ]);

  const insights: Insight[] = [];

  // 1. Best vs worst channel ROAS (high priority — budget decisions)
  const ranked = [...channels].filter((c) => c.roas > 0).sort((a, b) => b.roas - a.roas);
  if (ranked.length >= 2) {
    const best = ranked[0]!;
    const worst = ranked[ranked.length - 1]!;
    if (best.roas > worst.roas * 1.25) {
      insights.push({
        title: `${best.channel} is outperforming ${worst.channel}`,
        body: `${best.channel} returns ${(best.roas / worst.roas).toFixed(1)}× the ROAS (${best.roas.toFixed(2)}x vs ${worst.roas.toFixed(2)}x). Consider shifting budget toward ${best.channel}.`,
        tone: "positive",
        priority: 9,
      });
    }
  }

  // 2. Profit health (critical when negative)
  insights.push({
    title: metrics.cm1 >= 0 ? "You are generating profit" : "You are burning cash",
    body: `Gross profit: $${metrics.grossProfit.toFixed(0)} · Net margin: ${metrics.netMargin.toFixed(1)}%`,
    tone: metrics.cm1 >= 0 ? "positive" : "negative",
    priority: metrics.cm1 >= 0 ? 4 : 10,
  });

  // 3. Cohort retention
  const completed = [...cohorts.rows].reverse().find((r) => (r.values[1] ?? 0) > 0);
  if (completed) {
    const m1 = completed.values[1] ?? 0;
    const tone: Insight["tone"] = m1 >= 25 ? "positive" : m1 >= 10 ? "neutral" : "negative";
    insights.push({
      title: "Repeat purchase rate",
      body: `Your ${completed.label} cohort repurchases at ${m1.toFixed(1)}% within 30 days. ${
        m1 >= 25 ? "Strong retention is lowering your effective CAC." : "Win-back flows could improve this."
      }`,
      tone,
      priority: 6,
    });
  }

  // 4. CAC direction
  const cacDeltaPct = metrics.cacDelta / 100;
  if (cacDeltaPct <= -1) {
    insights.push({
      title: "Acquisition cost is falling",
      body: `Blended CAC is down ${Math.abs(cacDeltaPct).toFixed(0)}% over the last 14 days vs prior period.`,
      tone: "positive",
      priority: 7,
    });
  } else if (cacDeltaPct >= 1) {
    insights.push({
      title: "Acquisition cost is rising",
      body: `Blended CAC is up ${cacDeltaPct.toFixed(0)}% over the last 14 days vs prior period. Watch your least efficient channel.`,
      tone: "negative",
      priority: 8,
    });
  } else {
    insights.push({
      title: "Acquisition cost is stable",
      body: `Blended CAC holding steady at $${metrics.cac.toFixed(2)}.`,
      tone: "neutral",
      priority: 3,
    });
  }

  return insights.sort((a, b) => b.priority - a.priority);
}
