import { eq } from "drizzle-orm";
import { db } from "@/db";
import { adSpend, customers, orders, type Order } from "@/db/schema";
import { computeSegment, SEGMENT_LABELS, type Segment } from "@/lib/segments";
import { formatCurrency } from "@/lib/format";

const DAY_MS = 86_400_000;
const CHANNEL_ORDER = ["Meta", "Google", "TikTok"];
const SEGMENT_LABEL_MAP = SEGMENT_LABELS;

export interface UnitMetrics {
  revenue: number;
  revenueDelta: number;
  orders: number;
  ordersDelta: number;
  adSpend: number;
  spendDelta: number;
  roas: number;
  roasDelta: number;
  cac: number;
  cacDelta: number;
  cm1: number;
  cm2: number;
  grossProfit: number;
  netMargin: number;
  aov: number;
  totalCogs: number;
  totalShipping: number;
}

export interface TrendPoint {
  date: string;
  label: string;
  revenue: number;
  adSpend: number;
  orders: number;
}

export interface ChannelStat {
  channel: string;
  spend: number;
  revenue: number;
  orders: number;
  conversions: number;
  impressions: number;
  clicks: number;
  roas: number;
  cac: number;
  cpm: number;
}

export interface Overview {
  metrics: UnitMetrics;
  trend: TrendPoint[];
  channels: ChannelStat[];
}

export interface CohortRow {
  label: string;
  size: number;
  values: number[];
}

export interface CohortMatrix {
  columns: string[];
  rows: CohortRow[];
}

export interface SegmentStat {
  segment: Segment;
  label: string;
  count: number;
  totalSpend: number;
  avgSpend: number;
  avgOrders: number;
  share: number;
}

export interface CustomerRow {
  id: number;
  name: string;
  email: string;
  segment: Segment;
  segmentLabel: string;
  orderCount: number;
  totalSpend: number;
  lastOrderAt: Date;
  firstOrderAt: Date;
}

const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const monthIndex = (d: Date) => d.getFullYear() * 12 + d.getMonth();
const dateFromMonthIndex = (idx: number) =>
  new Date(Math.floor(idx / 12), idx % 12, 1);

function rangeSums(
  orderRows: Order[],
  spend: number[],
  spendDays: number[],
  from: number,
  to: number,
) {
  let revenue = 0;
  let ordersCount = 0;
  let spendTotal = 0;
  for (const o of orderRows) {
    const t = o.createdAt.getTime();
    if (t >= from && t < to && o.status === "paid") {
      revenue += o.revenue;
      ordersCount += 1;
    }
  }
  for (let i = 0; i < spend.length; i++) {
    if (spendDays[i] >= from && spendDays[i] < to) spendTotal += spend[i];
  }
  return { revenue, ordersCount, spendTotal };
}

export async function getOverview(userId: number): Promise<Overview> {
  const orderRows = await db
    .select()
    .from(orders)
    .where(eq(orders.userId, userId));

  const spendRows = await db
    .select()
    .from(adSpend)
    .where(eq(adSpend.userId, userId));

  const spend = spendRows.map((s) => s.spend);
  const spendDays = spendRows.map((s) => s.date.getTime());

  const paid = orderRows.filter((o) => o.status === "paid");
  const totalRevenue = paid.reduce((s, o) => s + o.revenue, 0);
  const totalCogs = paid.reduce((s, o) => s + o.cogs, 0);
  const totalShipping = paid.reduce((s, o) => s + o.shipping, 0);
  const totalSpend = spend.reduce((s, v) => s + v, 0);
  const completedOrders = paid.length;

  const grossProfit = totalRevenue - totalCogs - totalShipping;
  const roas = totalSpend > 0 ? totalRevenue / totalSpend : 0;
  const cac = completedOrders > 0 ? totalSpend / completedOrders : 0;
  const cm1 = grossProfit - totalSpend;
  const opEx = totalRevenue * 0.1;
  const cm2 = cm1 - opEx;
  const netMargin = totalRevenue > 0 ? (cm2 / totalRevenue) * 100 : 0;
  const aov = completedOrders > 0 ? totalRevenue / completedOrders : 0;

  const now = Date.now();
  const last14 = rangeSums(orderRows, spend, spendDays, now - 14 * DAY_MS, now);
  const prev14 = rangeSums(orderRows, spend, spendDays, now - 28 * DAY_MS, now - 14 * DAY_MS);

  const delta = (cur: number, prev: number) =>
    prev > 0 ? ((cur - prev) / prev) * 100 : 0;

  const roasLast = last14.spendTotal > 0 ? last14.revenue / last14.spendTotal : 0;
  const roasPrev = prev14.spendTotal > 0 ? prev14.revenue / prev14.spendTotal : 0;
  const cacLast = last14.ordersCount > 0 ? last14.spendTotal / last14.ordersCount : 0;
  const cacPrev = prev14.ordersCount > 0 ? prev14.spendTotal / prev14.ordersCount : 0;

  const metrics: UnitMetrics = {
    revenue: totalRevenue,
    revenueDelta: delta(last14.revenue, prev14.revenue),
    orders: completedOrders,
    ordersDelta: delta(last14.ordersCount, prev14.ordersCount),
    adSpend: totalSpend,
    spendDelta: delta(last14.spendTotal, prev14.spendTotal),
    roas,
    roasDelta: delta(roasLast, roasPrev),
    cac,
    cacDelta: delta(cacLast, cacPrev),
    cm1,
    cm2,
    grossProfit,
    netMargin,
    aov,
    totalCogs,
    totalShipping,
  };

  // Daily trend (last 60 days).
  const trendMap = new Map<string, TrendPoint>();
  const start = now - 60 * DAY_MS;
  for (let t = start; t < now; t += DAY_MS) {
    const d = new Date(t);
    const key = dayKey(d);
    trendMap.set(key, {
      date: key,
      label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      revenue: 0,
      adSpend: 0,
      orders: 0,
    });
  }
  for (const o of paid) {
    const key = dayKey(o.createdAt);
    const p = trendMap.get(key);
    if (p) {
      p.revenue += o.revenue;
      p.orders += 1;
    }
  }
  for (let i = 0; i < spend.length; i++) {
    const key = dayKey(new Date(spendDays[i]));
    const p = trendMap.get(key);
    if (p) p.adSpend += spend[i];
  }
  const trend = [...trendMap.values()].sort((a, b) => a.date.localeCompare(b.date));

  // Channel breakdown.
  const channels: ChannelStat[] = CHANNEL_ORDER.map((channel) => {
    const spendRowsFor = spendRows.filter((s) => s.channel === channel);
    const orderRowsFor = paid.filter((o) => o.channel === channel);
    const chSpend = spendRowsFor.reduce((s, v) => s + v.spend, 0);
    const chRevenue = orderRowsFor.reduce((s, o) => s + o.revenue, 0);
    const impressions = spendRowsFor.reduce((s, v) => s + v.impressions, 0);
    const clicks = spendRowsFor.reduce((s, v) => s + v.clicks, 0);
    const conversions = spendRowsFor.reduce((s, v) => s + v.conversions, 0);
    const chOrders = orderRowsFor.length;
    return {
      channel,
      spend: chSpend,
      revenue: chRevenue,
      orders: chOrders,
      conversions,
      impressions,
      clicks,
      roas: chSpend > 0 ? chRevenue / chSpend : 0,
      cac: chOrders > 0 ? chSpend / chOrders : 0,
      cpm: impressions > 0 ? (chSpend / impressions) * 1000 : 0,
    };
  });

  return { metrics, trend, channels };
}

export async function getCohorts(userId: number): Promise<CohortMatrix> {
  const customerRows = await db
    .select()
    .from(customers)
    .where(eq(customers.userId, userId));
  const orderRows = await db
    .select()
    .from(orders)
    .where(eq(orders.userId, userId));

  const cohortOf = new Map<number, number>();
  const orderMonths = new Map<number, Set<number>>();

  for (const c of customerRows) {
    cohortOf.set(c.id, monthIndex(c.firstOrderAt));
  }
  for (const o of orderRows) {
    if (!o.customerId || o.status !== "paid") continue;
    const mi = monthIndex(o.createdAt);
    const set = orderMonths.get(o.customerId) ?? new Set<number>();
    set.add(mi);
    orderMonths.set(o.customerId, set);
  }

  const cohortIndexes = [...new Set(cohortOf.values())].sort((a, b) => a - b);
  const maxCols = 6;

  const rows: CohortRow[] = cohortIndexes.map((ci) => {
    const members = customerRows.filter((c) => cohortOf.get(c.id) === ci);
    const size = members.length;
    const values: number[] = [];
    for (let offset = 0; offset < maxCols; offset++) {
      const target = ci + offset;
      let retained = 0;
      for (const m of members) {
        const months = orderMonths.get(m.id);
        if (months?.has(target)) retained += 1;
      }
      values.push(size > 0 ? Math.round((retained / size) * 1000) / 10 : 0);
    }
    return {
      label: dateFromMonthIndex(ci).toLocaleDateString("en-US", {
        month: "short",
        year: "2-digit",
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

export async function getCustomers(userId: number): Promise<{
  segments: SegmentStat[];
  customers: CustomerRow[];
}> {
  const customerRows = await db
    .select()
    .from(customers)
    .where(eq(customers.userId, userId));

  const now = Date.now();
  const rows: CustomerRow[] = customerRows.map((c) => {
    const recencyDays = Math.round((now - c.lastOrderAt.getTime()) / DAY_MS);
    const segment = computeSegment({
      orderCount: c.orderCount,
      totalSpend: c.totalSpend,
      recencyDays,
    });
    return {
      id: c.id,
      name: c.name,
      email: c.email,
      segment,
      segmentLabel: SEGMENT_LABEL_MAP[segment],
      orderCount: c.orderCount,
      totalSpend: c.totalSpend,
      lastOrderAt: c.lastOrderAt,
      firstOrderAt: c.firstOrderAt,
    };
  });

  const bySegment = new Map<Segment, CustomerRow[]>();
  for (const r of rows) {
    const arr = bySegment.get(r.segment) ?? [];
    arr.push(r);
    bySegment.set(r.segment, arr);
  }

  const order: Segment[] = ["vip", "loyal", "promising", "new", "at_risk", "lost", "active"];
  const segments: SegmentStat[] = order
    .filter((s) => (bySegment.get(s)?.length ?? 0) > 0)
    .map((s) => {
      const arr = bySegment.get(s)!;
      const totalSpend = arr.reduce((sum, r) => sum + r.totalSpend, 0);
      const avgOrders = arr.reduce((sum, r) => sum + r.orderCount, 0) / arr.length;
      return {
        segment: s,
        label: SEGMENT_LABEL_MAP[s],
        count: arr.length,
        totalSpend,
        avgSpend: totalSpend / arr.length,
        avgOrders,
        share: rows.length > 0 ? (arr.length / rows.length) * 100 : 0,
      };
    });

  return { segments, customers: rows };
}

// ---------------------------------------------------------------------------
// Smart insights — plain-language summary computed from real data.
// ---------------------------------------------------------------------------

export interface Insight {
  title: string;
  body: string;
  tone: "positive" | "negative" | "neutral";
}

export async function getInsights(userId: number): Promise<Insight[]> {
  const { metrics, channels } = await getOverview(userId);
  const cohorts = await getCohorts(userId);
  const insights: Insight[] = [];

  // 1. Best vs worst channel (by ROAS).
  if (channels.length >= 2) {
    const ranked = [...channels].sort((a, b) => b.roas - a.roas);
    const best = ranked[0];
    const worst = ranked[ranked.length - 1];
    if (best.roas > 0 && worst.roas > 0 && best.roas > worst.roas) {
      const ratio = best.roas / worst.roas;
      insights.push({
        title: `${best.channel} is outperforming the rest`,
        body: `${best.channel} is returning ${ratio.toFixed(1)}× the ROAS of ${worst.channel} (${best.roas.toFixed(2)}x vs ${worst.roas.toFixed(2)}x). Shift budget there.`,
        tone: "positive",
      });
    }
  }

  // 2. Profit pulse — last 24 hours and current month (real cash numbers).
  const orderRows = await db.select().from(orders).where(eq(orders.userId, userId));
  const spendRows = await db.select().from(adSpend).where(eq(adSpend.userId, userId));

  const now = Date.now();
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const windowProfit = (from: number) => {
    let revenue = 0;
    let cogs = 0;
    let shipping = 0;
    let spend = 0;
    for (const o of orderRows) {
      const t = o.createdAt.getTime();
      if (t >= from && t < now && o.status === "paid") {
        revenue += o.revenue;
        cogs += o.cogs;
        shipping += o.shipping;
      }
    }
    for (const s of spendRows) {
      const t = s.date.getTime();
      if (t >= from && t < now) spend += s.spend;
    }
    return revenue - cogs - shipping - spend;
  };

  const weekProfit = windowProfit(now - 7 * DAY_MS);
  const monthProfit = windowProfit(monthStart.getTime());

  insights.push({
    title: monthProfit >= 0 ? "You're generating profit" : "You're burning cash",
    body: `Profit in the last 7 days: ${formatCurrency(weekProfit)} · this month: ${formatCurrency(monthProfit)}.`,
    tone: monthProfit >= 0 ? "positive" : "negative",
  });

  // 3. Retention — most recent cohort that has completed its first month.
  const completed = [...cohorts.rows]
    .reverse()
    .find((r) => (r.values[1] ?? 0) > 0);
  if (completed) {
    const m1 = completed.values[1] ?? 0;
    const tone: Insight["tone"] = m1 >= 25 ? "positive" : m1 >= 10 ? "neutral" : "negative";
    insights.push({
      title: "Repeat purchases",
      body: `Your ${completed.label} cohort is repurchasing at ${m1.toFixed(1)}% within 30 days. ${
        m1 >= 25 ? "Strong retention is driving CAC down." : "Room to improve with win-back flows."
      }`,
      tone,
    });
  }

  // 4. CAC direction.
  if (metrics.cacDelta <= -1) {
    insights.push({
      title: "Acquisition cost is falling",
      body: `Blended CAC is down ${Math.abs(metrics.cacDelta).toFixed(0)}% in the last 14 days — you're acquiring customers cheaper.`,
      tone: "positive",
    });
  } else if (metrics.cacDelta >= 1) {
    insights.push({
      title: "Acquisition cost is rising",
      body: `Blended CAC is up ${metrics.cacDelta.toFixed(0)}% in the last 14 days. Watch your least efficient channel.`,
      tone: "negative",
    });
  } else {
    insights.push({
      title: "Acquisition cost is stable",
      body: `Blended CAC is holding steady at ${formatCurrency(metrics.cac)}.`,
      tone: "neutral",
    });
  }

  return insights;
}
