// src/lib/aggregation.ts
// Daily metrics computation — writes the `daily_metrics` table that every
// dashboard read hits. AGENTS.md Decision 4: dashboards NEVER calculate
// on-demand from raw data.
//
// Metric rules (AGENTS.md "Metric Definitions"):
// → Revenue: paid/partially_refunded/fulfilled orders, net of refunds.
//   Cancelled + pending excluded.
// → CAC: ad spend ÷ NEW customers only (is_first_order) — NOT all orders.
// → ROAS/AOV/CPC/CTR computed in scaled integers (lib/money).
// → Blended row (platform NULL) spans every channel's revenue + total spend;
//   per-platform rows use only that platform's attributed numbers.

import { eq, sql } from "drizzle-orm";
import { db, pool } from "@/db";
import {
  dailyMetrics,
  normalizedCustomers,
} from "@/db/schema";
import {
  calculateRoasScaled,
  calculateCtrBasisPoints,
  calculateCpcCents,
  calculateCacCents,
  calculateAovCents,
} from "@/lib/money";
import { computeSegment } from "@/lib/segments";

const REVENUE_STATUSES = ["paid", "partially_refunded", "fulfilled"] as const;

interface OrderBucketRow {
  src: string | null;
  order_count: string;
  new_count: string;
  gross: string;
  net: string;
  refunded: string;
}

interface SpendRow {
  platform: string;
  spend: string;
  impressions: string;
  clicks: string;
  conversions: string;
}

interface BucketStats {
  orderCount: number;
  newCount: number;
  grossCents: number;
  netCents: number;
  refundedCents: number;
  spendCents: number;
  impressions: number;
  clicks: number;
  conversions: number;
}

function emptyBucket(): BucketStats {
  return {
    orderCount: 0,
    newCount: 0,
    grossCents: 0,
    netCents: 0,
    refundedCents: 0,
    spendCents: 0,
    impressions: 0,
    clicks: 0,
    conversions: 0,
  };
}

function addOrder(b: BucketStats, r: OrderBucketRow): void {
  b.orderCount += Number(r.order_count);
  b.newCount += Number(r.new_count);
  b.grossCents += Number(r.gross);
  b.netCents += Number(r.net);
  b.refundedCents += Number(r.refunded);
}

function addSpend(b: BucketStats, r: SpendRow): void {
  b.spendCents += Number(r.spend);
  b.impressions += Number(r.impressions);
  b.clicks += Number(r.clicks);
  b.conversions += Number(r.conversions);
}

/**
 * Compute daily metrics for one user & UTC day and REPLACE the stored rows
 * (blended + per-platform) inside a transaction. Idempotent: safe to rerun.
 */
export async function aggregateUserDay(
  userId: number,
  dayKey: string
): Promise<void> {
  const dayStart = `${dayKey}T00:00:00Z`;
  const dayEnd = `${dayKey}T23:59:59.999Z`;

  // One round-trip each for orders and spend
  const ordersRes = await pool.query<OrderBucketRow>(
    `SELECT attribution_source AS src,
            COUNT(*)::text AS order_count,
            COUNT(*) FILTER (WHERE is_first_order)::text AS new_count,
            COALESCE(SUM(total_cents),0)::text AS gross,
            COALESCE(SUM(net_revenue_cents),0)::text AS net,
            COALESCE(SUM(refunded_cents),0)::text AS refunded
     FROM normalized_orders
     WHERE user_id = $1
       AND status IN ('paid','partially_refunded','fulfilled')
       AND ordered_at >= $2 AND ordered_at <= $3
     GROUP BY attribution_source`,
    [userId, dayStart, dayEnd]
  );

  const spendRes = await pool.query<SpendRow>(
    `SELECT platform::text AS platform,
            COALESCE(SUM(spend_cents),0)::text AS spend,
            COALESCE(SUM(impressions),0)::text AS impressions,
            COALESCE(SUM(clicks),0)::text AS clicks,
            COALESCE(SUM(conversions),0)::text AS conversions
     FROM normalized_ad_spend
     WHERE user_id = $1 AND spend_date = $2
     GROUP BY platform`,
    [userId, dayKey]
  );

  const buckets = new Map<string, BucketStats>();
  const bucketOf = (key: string): BucketStats => {
    let b = buckets.get(key);
    if (!b) {
      b = emptyBucket();
      buckets.set(key, b);
    }
    return b;
  };

  const blended = bucketOf("__all__");

  // Attribute order revenue per source bucket
  for (const row of ordersRes.rows) {
    const key = row.src ?? "__all__";
    addOrder(bucketOf(key), row);
    if (key !== "__all__") addOrder(blended, row);
  }

  // Ad spend lands on its own platform bucket AND blended
  for (const row of spendRes.rows) {
    addSpend(bucketOf(row.platform), row);
    addSpend(blended, row);
  }

  // Build insert rows: blended row always written, then platform buckets.
  // Attribution sources like "direct"/"organic"/"email" are NOT platforms —
  // their revenue is already included in the blended row; skip them here
  // (platform column is an enum of connectable platforms).
  const WRITABLE_PLATFORMS = new Set(["meta", "google", "tiktok", "shopify", "klaviyo"]);

  const rowsToWrite: Array<typeof dailyMetrics.$inferInsert> = [];

  const toRow = (
    platform: typeof dailyMetrics.$inferInsert.platform,
    b: BucketStats
  ): typeof dailyMetrics.$inferInsert => ({
    userId,
    platform,
    metricsDate: dayKey,
    grossRevenueCents: b.grossCents,
    netRevenueCents: b.netCents,
    refundedCents: b.refundedCents,
    orderCount: b.orderCount,
    newCustomerCount: b.newCount,
    returningCustomerCount: b.orderCount - b.newCount,
    adSpendCents: b.spendCents,
    impressions: b.impressions,
    clicks: b.clicks,
    conversions: b.conversions,
    roasScaled: calculateRoasScaled(b.netCents, b.spendCents),
    aovCents: calculateAovCents(b.netCents, b.orderCount),
    ctrBasisPoints: calculateCtrBasisPoints(b.clicks, b.impressions),
    cpcCents: calculateCpcCents(b.spendCents, b.clicks),
    cacCents: calculateCacCents(b.spendCents, b.newCount), // NEW customers only
    computedAt: new Date(),
  });

  // Blended = all revenue + all spend
  rowsToWrite.push(toRow(null, bucketOf("__all__")));

  for (const [key, b] of buckets) {
    if (key === "__all__") continue;

    // Empty platform buckets (no orders, no spend) are noise — skip
    if (b.orderCount === 0 && b.spendCents === 0 && b.grossCents === 0) continue;
    if (!WRITABLE_PLATFORMS.has(key)) continue;

    rowsToWrite.push(
      toRow(key as typeof dailyMetrics.$inferInsert.platform, b)
    );
  }

  await db.transaction(async (tx) => {
    await tx
      .delete(dailyMetrics)
      .where(
        sql`${dailyMetrics.userId} = ${userId} AND ${dailyMetrics.metricsDate} = ${dayKey}`
      );
    if (rowsToWrite.length > 0) {
      await tx.insert(dailyMetrics).values(rowsToWrite);
    }
  });
}

/** Aggregate a closed date range inclusive. */
export async function aggregateRange(
  userId: number,
  from: string,
  to: string
): Promise<number> {
  const days: string[] = [];
  let t = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  for (; t <= end; t += 86_400_000) {
    days.push(new Date(t).toISOString().slice(0, 10));
  }
  for (const day of days) {
    await aggregateUserDay(userId, day);
  }
  return days.length;
}

/**
 * Refresh RFM segments for all customers of a user.
 * Bounded per tenant; runs as part of hourly aggregation.
 */
export async function refreshSegments(userId: number): Promise<number> {
  const rows = await db
    .select()
    .from(normalizedCustomers)
    .where(eq(normalizedCustomers.userId, userId));

  const now = Date.now();
  const updates: Array<{
    id: number;
    segment: string;
  }> = [];

  for (const c of rows) {
    if (!c.lastOrderAt || !c.firstOrderAt) continue;
    const recencyDays = Math.round((now - c.lastOrderAt.getTime()) / 86_400_000);
    const segment = computeSegment({
      orderCount: c.orderCount,
      totalSpend: c.totalSpentCents / 100,
      recencyDays,
    });
    if (segment !== c.segment) {
      updates.push({ id: c.id, segment });
    }
  }

  if (updates.length === 0) return 0;

  await pool.query(
    `UPDATE normalized_customers c
     SET segment = u.seg, updated_at = NOW()
     FROM unnest($1::int[], $2::text[]) AS u(id, seg)
     WHERE c.id = u.id`,
    [updates.map((u) => u.id), updates.map((u) => u.segment)]
  );

  return updates.length;
}
