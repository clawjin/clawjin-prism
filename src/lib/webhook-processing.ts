// src/lib/webhook-processing.ts
// Thin facade over the sync engine's storage layer for webhook-sourced
// orders. Same upsert + backfill + rollup guarantees, no platform client.

import { sql } from "drizzle-orm";
import { db, pool } from "@/db";
import { normalizedOrders } from "@/db/schema";
import type { NewNormalizedOrder } from "@/db/schema";

const CHUNK = 100;

/** Upsert webhook-normalized orders (same conflict target as sync path). */
export async function upsertOrdersFromWebhook(
  rows: NewNormalizedOrder[]
): Promise<void> {
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    await db
      .insert(normalizedOrders)
      .values(chunk)
      .onConflictDoUpdate({
        target: [
          normalizedOrders.userId,
          normalizedOrders.platform,
          normalizedOrders.externalOrderId,
        ],
        set: {
          status: sql`excluded.status`,
          totalCents: sql`excluded.total_cents`,
          refundedCents: sql`excluded.refunded_cents`,
          netRevenueCents: sql`excluded.net_revenue_cents`,
          updatedAt: new Date(),
        },
      });
  }

  // First-order correctness across the whole history of touched customers
  const hashes = [
    ...new Set(rows.map((r) => r.customerEmailHash).filter(Boolean)),
  ] as string[];
  if (hashes.length === 0) return;

  const userId = rows[0]!.userId;
  await pool.query(
    `UPDATE normalized_orders o
     SET is_first_order = NOT EXISTS (
       SELECT 1 FROM normalized_orders p
       WHERE p.user_id = o.user_id
         AND p.customer_email_hash = o.customer_email_hash
         AND (p.ordered_at, p.id) < (o.ordered_at, o.id)
     )
     WHERE o.user_id = $1 AND o.customer_email_hash = ANY($2)`,
    [userId, hashes]
  );
}
