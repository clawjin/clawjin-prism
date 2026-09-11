// src/lib/pipeline.ts
// Demo pipeline runner — simulates a real ingestion run for testing
// Uses new schema names and integer cents

import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  activityLog,
  normalizedAdSpend,
  alerts,
  platformConnections,
  normalizedOrders,
} from "@/db/schema";
import { toCents } from "@/lib/money";
import crypto from "node:crypto";

const CHANNELS = ["meta", "google", "tiktok"] as const;

export async function runIngestion(userId: number) {
  const now = new Date();

  // Find or use first connection for this user
  const conn = await db.query.platformConnections.findFirst({
    where: (t, { eq: eqFn }) => eqFn(t.userId, userId),
  });
  const connectionId = conn?.id ?? 1;

  // 1. Today's ad spend across channels (demo values)
  const spendDate = now.toISOString().split("T")[0]!;

  const spendRows: typeof normalizedAdSpend.$inferInsert[] = CHANNELS.map(
    (channel) => ({
      userId,
      connectionId,
      platform:    channel,
      campaignId:  `live-${channel}-${spendDate}`,
      campaignName: `${channel} Campaign`,
      spendDate,
      currency:    "USD",
      // Random spend between $700-$1400 in cents
      spendCents:  toCents(700 + Math.random() * 700),
      impressions: Math.round(40_000 + Math.random() * 50_000),
      clicks:      Math.round(500 + Math.random() * 600),
      conversions: Math.round(12 + Math.random() * 14),
      conversionValueCents: toCents(2000 + Math.random() * 3000),
    })
  );

  await db.insert(normalizedAdSpend)
    .values(spendRows)
    .onConflictDoUpdate({
      target: [
        normalizedAdSpend.userId,
        normalizedAdSpend.platform,
        normalizedAdSpend.campaignId,
        normalizedAdSpend.spendDate,
      ],
      set: {
        spendCents:           normalizedAdSpend.spendCents,
        impressions:          normalizedAdSpend.impressions,
        clicks:               normalizedAdSpend.clicks,
        conversions:          normalizedAdSpend.conversions,
        conversionValueCents: normalizedAdSpend.conversionValueCents,
        updatedAt:            now,
      },
    });

  // 2. Fresh batch of demo orders
  const orderCount = 3 + Math.floor(Math.random() * 5);

  const orderRows: typeof normalizedOrders.$inferInsert[] = Array.from(
    { length: orderCount },
    (_, i) => {
      const channel     = CHANNELS[i % CHANNELS.length]!;
      const subtotal    = toCents(40 + Math.random() * 80);
      const shipping    = toCents(4.9 + Math.random() * 7);
      const tax         = Math.round(subtotal * 0.08);
      const total       = subtotal + shipping + tax;

      return {
        userId,
        connectionId,
        platform:          "shopify" as const,
        externalOrderId:   `demo-live-${now.getTime()}-${i}`,
        orderNumber:       `#LIVE-${now.getTime()}-${i}`,
        status:            "paid" as const,
        currency:          "USD",
        subtotalCents:     subtotal,
        discountCents:     0,
        shippingCents:     shipping,
        taxCents:          tax,
        totalCents:        total,
        refundedCents:     0,
        netRevenueCents:   total,
        attributionSource: channel,
        isFirstOrder:      false,
        lineItemsCount:    1,
        orderedAt:         now,
      };
    }
  );

  await db.insert(normalizedOrders)
    .values(orderRows)
    .onConflictDoNothing();

  // 3. Mark all connections as freshly synced
  await db
    .update(platformConnections)
    .set({ lastSyncAt: now, updatedAt: now })
    .where(eq(platformConnections.userId, userId));

  // 4. Log + alert
  await db.insert(activityLog).values({
    userId,
    action: "ingestion.run",
    detail: `Ingested ${orderCount} orders + ${spendRows.length} channel spend feeds`,
  });

  await db.insert(alerts).values({
    userId,
    severity: "info",
    title:    "Data pipeline run complete",
    message:  `Ingested ${orderCount} new orders and refreshed ${spendRows.length} ad spend feeds.`,
    read:     false,
  });

  // Refresh pre-computed metrics so dashboards reflect this run instantly
  const { aggregateUserDay } = await import("@/lib/aggregation");
  await aggregateUserDay(userId, spendDate);

  return { orders: orderCount, channels: spendRows.length, ranAt: now };
}