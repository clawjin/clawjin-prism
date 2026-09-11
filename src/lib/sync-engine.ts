// src/lib/sync-engine.ts
// Executes sync jobs: platform API → raw events (immutable) → normalized
// tables → first-order backfill → customer rollups.
//
// Resilience (AGENTS.md):
// → Cursor resume: failed batches continue where they stopped
// → Progress persisted to BOTH redis job + durable DB sync_jobs row
// → Raw payloads stored verbatim BEFORE normalization (zero data loss)

import { eq, sql } from "drizzle-orm";
import { db, pool } from "@/db";
import {
  activityLog,
  alerts,
  normalizedAdSpend,
  normalizedOrders,
  platformConnections,
  rawEvents,
  syncJobs,
} from "@/db/schema";
import { getClient } from "@/modules";
import type {
  NewNormalizedAdSpend,
  NewNormalizedOrder,
} from "@/db/schema";
import {
  extractCustomerMeta,
  markFirstOrders,
  normalizeShopifyOrder,
  type OrderCustomerMeta,
} from "@/modules/shopify/normalize";
import { normalizeMetaInsight } from "@/modules/meta/normalize";
import { decryptToken } from "@/lib/encryption";
import type { Job } from "@/lib/queue";

const UPSERT_CHUNK = 100;

export interface SyncJobPayload {
  dateFrom?: string; // "YYYY-MM-DD" inclusive
  dateTo?: string;
  syncJobDbId?: number; // durable sync_jobs row id
}

export interface SyncRunResult {
  finished: boolean;
  cursor: string | null;
  recordsProcessed: number;
}

/** Execute ONE page of a sync job. Returns whether more pages remain. */
export async function runSyncPage(job: Job): Promise<SyncRunResult> {
  const [conn] = await db
    .select()
    .from(platformConnections)
    .where(eq(platformConnections.id, job.connectionId))
    .limit(1);

  if (!conn) throw new Error(`connection ${job.connectionId} not found`);
  if (conn.status === "revoked") throw new Error("connection revoked");

  const payload = job.payload as SyncJobPayload;

  // Date range: explicit window (historical) or rolling 24h (incremental)
  const now = new Date();
  const dateFrom =
    payload.dateFrom ??
    new Date(now.getTime() - 24 * 3600 * 1000).toISOString().slice(0, 10);
  const dateTo = payload.dateTo ?? now.toISOString().slice(0, 10);

  // Resume: in-flight cursor wins; else the connection's saved cursor
  const savedCursor =
    conn.syncCursor &&
    typeof conn.syncCursor === "object" &&
    "cursor" in conn.syncCursor &&
    typeof (conn.syncCursor as { cursor?: unknown }).cursor === "string"
      ? String((conn.syncCursor as { cursor: string }).cursor)
      : null;

  if (conn.platform !== "shopify" && conn.platform !== "meta") {
    throw new Error(`platform ${conn.platform} has no sync handler`);
  }

  const client = getClient(conn.platform, Boolean(conn.accessTokenEncrypted));

  let nextCursor: string | null = null;
  let processedThisPage = 0;
  let customerMetas: OrderCustomerMeta[] = [];

  if (conn.platform === "shopify") {
    const accessToken = decryptToken(conn.accessTokenEncrypted);
    if (!accessToken && process.env.USE_REAL_API === "true") {
      await markConnectionError(conn.id, "Access token missing — reconnect required");
      throw new Error("shopify access token missing");
    }

    const page = await client.listOrders({
      accessToken: accessToken ?? "mock",
      shopDomain: conn.shopDomain ?? "mock.myshopify.com",
      createdAtMin: `${dateFrom}T00:00:00Z`,
      createdAtMax: `${dateTo}T23:59:59Z`,
      cursor: savedCursor,
    });
    nextCursor = page.nextCursor ?? null;

    // 1. RAW FIRST — exact payloads, immutable audit trail (AGENTS.md)
    if (page.records.length > 0) {
      await storeRawEvents(conn.userId, conn.id, conn.platform, page.records);
    }

    // 2. Normalize + upsert orders
    const orders = page.orders
      .map((raw) => normalizeShopifyOrder(raw, { userId: conn.userId, connectionId: conn.id }))
      .filter((o): o is NewNormalizedOrder => o !== null);

    customerMetas = page.orders
      .map(extractCustomerMeta)
      .filter((m): m is OrderCustomerMeta => m !== null);

    markFirstOrders(orders); // batch-local hint; authoritative fix below
    await upsertOrders(orders);
    await backfillFirstOrders(conn.userId, orders);
    await rollupCustomers(conn.userId, orders, customerMetas);

    processedThisPage = orders.length;
  } else if (conn.platform === "meta") {
    const accessToken = decryptToken(conn.accessTokenEncrypted);
    if (!accessToken && process.env.USE_REAL_API === "true") {
      await markConnectionError(conn.id, "Access token missing — reconnect required");
      throw new Error("meta access token missing");
    }

    const accountId = conn.externalAccountId?.replace(/^act_/, "") ?? "";
    const page = await client.listInsights({
      accessToken: accessToken ?? "mock",
      adAccountId: accountId || "mock",
      since: dateFrom,
      until: dateTo,
      cursor: savedCursor,
    });
    nextCursor = page.nextCursor ?? null;

    if (page.records.length > 0) {
      await storeRawEvents(conn.userId, conn.id, conn.platform, page.records);
    }

    const spendRows = page.insights
      .map((raw) => normalizeMetaInsight(raw, { userId: conn.userId, connectionId: conn.id }))
      .filter((r): r is NewNormalizedAdSpend => r !== null);

    await upsertAdSpend(spendRows);
    processedThisPage = spendRows.length;
  } else {
    throw new Error(`platform ${conn.platform} has no sync handler`);
  }

  // 3. Persist durable progress (SQL-side accumulate across pages/retries)
  if (payload.syncJobDbId) {
    await db
      .update(syncJobs)
      .set({
        status: "running",
        recordsProcessed: sql`${syncJobs.recordsProcessed} + ${processedThisPage}`,
        resumeCursor: nextCursor ? { cursor: nextCursor } : null,
      })
      .where(eq(syncJobs.id, payload.syncJobDbId));
  }

  // Save resume point on the connection for crash recovery
  if (nextCursor) {
    await db
      .update(platformConnections)
      .set({ syncCursor: { cursor: nextCursor }, updatedAt: new Date() })
      .where(eq(platformConnections.id, conn.id));
  }

  // 4. Finished → stamp connection + close DB job record
  if (!nextCursor) {
    await db
      .update(platformConnections)
      .set({ lastSyncAt: new Date(), updatedAt: new Date(), syncCursor: null })
      .where(eq(platformConnections.id, conn.id));

    if (payload.syncJobDbId) {
      await db
        .update(syncJobs)
        .set({ status: "completed", completedAt: new Date(), resumeCursor: null })
        .where(eq(syncJobs.id, payload.syncJobDbId));

      const [jobRow] = await db
        .select({ records: syncJobs.recordsProcessed })
        .from(syncJobs)
        .where(eq(syncJobs.id, payload.syncJobDbId))
        .limit(1);
      await logSyncCompletion(
        conn.userId,
        conn.displayName,
        jobRow?.records ?? processedThisPage
      );
    }
  }

  return {
    finished: !nextCursor,
    cursor: nextCursor,
    recordsProcessed: processedThisPage,
  };
}

// ── Storage helpers ──────────────────────────────────────────────────────────

async function storeRawEvents(
  userId: number,
  connectionId: number,
  platform: "shopify" | "meta",
  records: Array<{
    externalId: string;
    eventType: string;
    payload: Record<string, unknown>;
  }>
): Promise<void> {
  for (let i = 0; i < records.length; i += UPSERT_CHUNK) {
    const chunk = records.slice(i, i + UPSERT_CHUNK);
    await db
      .insert(rawEvents)
      .values(
        chunk.map((r) => ({
          userId,
          connectionId,
          platform,
          eventType: r.eventType,
          externalId: r.externalId,
          rawPayload: r.payload,
          processed: true, // normalized immediately below
          processedAt: new Date(),
        }))
      )
      .onConflictDoNothing(); // refetch of same record = audit no-op
  }
}

async function upsertOrders(rows: NewNormalizedOrder[]): Promise<void> {
  for (let i = 0; i < rows.length; i += UPSERT_CHUNK) {
    const chunk = rows.slice(i, i + UPSERT_CHUNK);
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
}

async function upsertAdSpend(rows: NewNormalizedAdSpend[]): Promise<void> {
  for (let i = 0; i < rows.length; i += UPSERT_CHUNK) {
    const chunk = rows.slice(i, i + UPSERT_CHUNK);
    await db
      .insert(normalizedAdSpend)
      .values(chunk)
      .onConflictDoUpdate({
        target: [
          normalizedAdSpend.userId,
          normalizedAdSpend.platform,
          normalizedAdSpend.campaignId,
          normalizedAdSpend.spendDate,
        ],
        set: {
          campaignName: sql`excluded.campaign_name`,
          spendCents: sql`excluded.spend_cents`,
          impressions: sql`excluded.impressions`,
          clicks: sql`excluded.clicks`,
          conversions: sql`excluded.conversions`,
          conversionValueCents: sql`excluded.conversion_value_cents`,
          updatedAt: new Date(),
        },
      });
  }
}

/**
 * Authoritative isFirstOrder backfill over affected email hashes.
 * Row comparison (ordered_at, id) makes identical timestamps deterministic.
 */
async function backfillFirstOrders(
  userId: number,
  orders: NewNormalizedOrder[]
): Promise<void> {
  const hashes = [
    ...new Set(orders.map((o) => o.customerEmailHash).filter(Boolean)),
  ] as string[];
  if (hashes.length === 0) return;

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

/**
 * Recompute customer rollups from the orders source of truth for affected
 * hashes — self-healing on every sync. Names come from raw order JSON.
 */
async function rollupCustomers(
  userId: number,
  orders: NewNormalizedOrder[],
  metas: OrderCustomerMeta[]
): Promise<void> {
  const hashes = [
    ...new Set(orders.map((o) => o.customerEmailHash).filter(Boolean)),
  ] as string[];
  if (hashes.length === 0) return;

  await pool.query(
    `INSERT INTO normalized_customers
       (user_id, email_hash, name, first_order_at, last_order_at,
        order_count, total_spent_cents, acquisition_source, segment, updated_at)
     SELECT
       o.user_id,
       o.customer_email_hash,
       MAX('') AS name,
       MIN(o.ordered_at),
       MAX(o.ordered_at),
       COUNT(*)::int,
       SUM(o.net_revenue_cents)::int,
       COALESCE((
         SELECT f.attribution_source FROM normalized_orders f
         WHERE f.user_id = o.user_id
           AND f.customer_email_hash = o.customer_email_hash
           AND f.status IN ('paid','partially_refunded','fulfilled')
         ORDER BY f.ordered_at ASC, f.id ASC
         LIMIT 1
       ), 'unknown'),
       'new',
       NOW()
     FROM normalized_orders o
     WHERE o.user_id = $1
       AND o.customer_email_hash = ANY($2)
       AND o.status IN ('paid','partially_refunded','fulfilled')
     GROUP BY o.user_id, o.customer_email_hash
     ON CONFLICT (user_id, email_hash) DO UPDATE SET
       first_order_at     = EXCLUDED.first_order_at,
       last_order_at      = EXCLUDED.last_order_at,
       order_count        = EXCLUDED.order_count,
       total_spent_cents  = EXCLUDED.total_spent_cents,
       acquisition_source = EXCLUDED.acquisition_source,
       updated_at         = NOW()`,
    [userId, hashes]
  );

  // Display names from this batch's raw JSON — never overwrite existing names.
  // Dedupe by hash: multi-order customers appear once per page.
  const seen = new Set<string>();
  const named: OrderCustomerMeta[] = [];
  for (const m of metas) {
    if (m.name.length === 0 || seen.has(m.emailHash)) continue;
    seen.add(m.emailHash);
    named.push(m);
  }
  for (let i = 0; i < named.length; i += UPSERT_CHUNK) {
    const chunk = named.slice(i, i + UPSERT_CHUNK);
    const params: unknown[] = [];
    const tuples = chunk.map((m) => {
      const base = params.length;
      params.push(userId, m.emailHash, m.name);
      return `($${base + 1}::int, $${base + 2}::text, $${base + 3}::text, 'new')`;
    });

    await pool.query(
      `INSERT INTO normalized_customers (user_id, email_hash, name, segment)
       VALUES ${tuples.join(",")}
       ON CONFLICT (user_id, email_hash) DO UPDATE SET
         name = CASE
           WHEN normalized_customers.name = '' OR normalized_customers.name IS NULL
           THEN EXCLUDED.name
           ELSE normalized_customers.name
         END`,
      params
    );
  }
}

// ── Failure + notification ───────────────────────────────────────────────────

async function markConnectionError(connectionId: number, message: string): Promise<void> {
  const [conn] = await db
    .select()
    .from(platformConnections)
    .where(eq(platformConnections.id, connectionId))
    .limit(1);

  await db
    .update(platformConnections)
    .set({ status: "error", errorMessage: message, updatedAt: new Date() })
    .where(eq(platformConnections.id, connectionId));

  if (conn) {
    await db
      .insert(alerts)
      .values({
        userId: conn.userId,
        severity: "error",
        title: "Sync error",
        message: `Connection "${conn.displayName}" failed: ${message}`,
      })
      .catch(() => {});
  }
}

/** Log completion + notify user (activity log + alert). */
export async function logSyncCompletion(
  userId: number,
  connectionName: string,
  records: number
): Promise<void> {
  await db
    .insert(activityLog)
    .values({
      userId,
      action: "sync.completed",
      detail: `${connectionName}: ${records} records synced`,
    })
    .catch(() => {});

  await db
    .insert(alerts)
    .values({
      userId,
      severity: "info",
      title: "Data sync complete",
      message: `${records} records synced from ${connectionName}. Metrics are updating.`,
    })
    .catch(() => {});
}
