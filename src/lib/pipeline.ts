import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  activityLog,
  adSpend,
  alerts,
  connections,
  orders,
} from "@/db/schema";

const CHANNELS = ["Meta", "Google", "TikTok"];

/**
 * Simulates a real ingestion run: pulls in a fresh batch of orders and today's
 * ad spend, marks every connection as freshly synced, and records the run in
 * the activity log + alerts. The dashboard metrics genuinely change as a result.
 */
export async function runIngestion(userId: number) {
  const now = new Date();

  // 1. Today's ad spend across channels.
  const spendRows = CHANNELS.map((channel, i) => ({
    userId,
    channel,
    date: now,
    spend: Math.round((700 + Math.random() * 700) * 100) / 100,
    impressions: Math.round(40_000 + Math.random() * 50_000),
    clicks: Math.round(500 + Math.random() * 600),
    conversions: Math.round(12 + Math.random() * 14),
  }));
  await db.insert(adSpend).values(spendRows);

  // 2. A fresh batch of orders.
  const orderCount = 3 + Math.floor(Math.random() * 5);
  const orderRows = Array.from({ length: orderCount }).map((_, i) => {
    const channel = CHANNELS[i % CHANNELS.length];
    const revenue = Math.round((40 + Math.random() * 80) * 100) / 100;
    const cogs = Math.round(revenue * (0.3 + Math.random() * 0.08) * 100) / 100;
    const shipping = Math.round((4.9 + Math.random() * 7) * 100) / 100;
    return {
      userId,
      customerId: null,
      orderNumber: `ORD-${now.getTime()}-${i}`,
      revenue,
      cogs,
      shipping,
      channel,
      status: "paid",
      createdAt: now,
    };
  });
  await db.insert(orders).values(orderRows);

  // 3. Mark all connections as freshly synced.
  await db
    .update(connections)
    .set({ lastSyncAt: now })
    .where(eq(connections.userId, userId));

  // 4. Log the run + surface an alert.
  await db.insert(activityLog).values({
    userId,
    action: "ingestion.run",
    detail: `Ingested ${orderCount} orders + ${spendRows.length} channel spend feeds`,
  });

  await db.insert(alerts).values({
    userId,
    severity: "info",
    title: "Data pipeline run complete",
    message: `Ingested ${orderCount} new orders and refreshed ${spendRows.length} ad spend feeds. All unit-economics marts recomputed.`,
    read: false,
  });

  return { orders: orderCount, channels: spendRows.length, ranAt: now };
}
