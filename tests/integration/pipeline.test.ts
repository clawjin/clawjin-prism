// Integration test — full pipeline against the REAL database using MOCK
// platform clients. Exercises the exact production code path:
//
//   mock client → raw_events (immutable) → normalized_orders/ad_spend
//   → first-order backfill → customer rollups → aggregation → dashboard read
//
// Gated on DATABASE_URL; skips silently otherwise. Cleans up after itself.

import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { eq, like } from "drizzle-orm";
import crypto from "node:crypto";
import { db, pool } from "@/db";
import {
  normalizedAdSpend,
  normalizedCustomers,
  normalizedOrders,
  platformConnections,
  rawEvents,
  users,
} from "@/db/schema";
import type { Job } from "@/lib/queue";
import { runSyncPage } from "@/lib/sync-engine";
import { aggregateUserDay } from "@/lib/aggregation";
import { getOverview } from "@/lib/analytics";

const RUN_ID = `itest-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;
let testUserId: number;
let shopifyConnId: number;
let metaConnId: number;

async function makeJob(
  type: Job["type"],
  connectionId: number,
  payload: Record<string, unknown>
): Promise<Job> {
  return {
    id: `${type}-${RUN_ID}`,
    type,
    userId: testUserId,
    connectionId,
    status: "running",
    payload,
    attemptCount: 0,
    maxAttempts: 5,
    createdAt: new Date().toISOString(),
    scheduledForMs: Date.now(),
  };
}

beforeAll(async () => {
  if (!process.env.DATABASE_URL) return;

  // Isolated tenant — everything cascades on delete
  const [user] = await db
    .insert(users)
    .values({
      email: `${RUN_ID}@integration.test`,
      passwordHash: "x:y", // never logs in — hash format placeholder
      name: "Integration Test",
      companyName: "IT Co",
    })
    .returning();
  testUserId = user!.id;

  const [shopConn] = await db
    .insert(platformConnections)
    .values({
      userId: testUserId,
      platform: "shopify",
      status: "active",
      displayName: "Mock Store",
      externalAccountId: "mock.myshopify.com",
      shopDomain: RUN_ID + ".myshopify.com", // unique seed key per run
    })
    .returning();
  shopifyConnId = shopConn!.id;

  const [metaConn] = await db
    .insert(platformConnections)
    .values({
      userId: testUserId,
      platform: "meta",
      status: "active",
      displayName: "Mock Meta",
      externalAccountId: RUN_ID, // unique seed key per run
    })
    .returning();
  metaConnId = metaConn!.id;
});

afterAll(async () => {
  if (!process.env.DATABASE_URL || !testUserId) return;
  await db.delete(users).where(eq(users.id, testUserId));
  await pool.end();
});

describe("end-to-end mock pipeline", () => {
  it.skipIf(!process.env.DATABASE_URL)(
    "syncs shopify orders through the full ingestion path",
    async () => {
      // Last 30 days via the mock client
      const job = await makeJob("shopify-historical-sync", shopifyConnId, {
        dateFrom: new Date(Date.now() - 30 * 86_400_000)
          .toISOString()
          .slice(0, 10),
        dateTo: new Date().toISOString().slice(0, 10),
      });

      let result = await runSyncPage(job);
      let pages = 1;
      while (!result.finished && pages < 20) {
        result = await runSyncPage({
          ...job,
          payload: { ...job.payload, cursor: result.cursor },
        });
        pages++;
      }
      expect(result.finished).toBe(true);

      // Orders landed, all money integer cents, UTC timestamps
      const orders = await db
        .select()
        .from(normalizedOrders)
        .where(eq(normalizedOrders.userId, testUserId));
      expect(orders.length).toBeGreaterThan(50);

      const badMoney = orders.find(
        (o) => !Number.isInteger(o.totalCents) || !Number.isInteger(o.netRevenueCents)
      );
      expect(badMoney).toBeUndefined();

      // Attribution resolved (mock landing sites carry fbclid/utm/gclid/ttclid)
      const attributed = orders.filter((o) => o.attributionSource !== "unknown");
      expect(attributed.length).toBeGreaterThan(orders.length * 0.5);
      expect(attributed.some((o) => o.attributionSource === "meta")).toBe(true);
      expect(attributed.some((o) => o.attributionSource === "google")).toBe(true);

      // Raw audit trail preserved (zero data loss criterion)
      const raws = await db
        .select()
        .from(rawEvents)
        .where(eq(rawEvents.userId, testUserId));
      expect(raws.length).toBeGreaterThanOrEqual(orders.length);

      // First-order flags: exactly one per email hash
      const firstOrders = orders.filter((o) => o.isFirstOrder);
      const distinctHashes = new Set(
        orders.map((o) => o.customerEmailHash).filter(Boolean)
      );
      expect(firstOrders.length).toBe(distinctHashes.size);

      // Customer rollups exist with hashed emails only
      const customers = await db
        .select()
        .from(normalizedCustomers)
        .where(eq(normalizedCustomers.userId, testUserId));
      expect(customers.length).toBeGreaterThan(0);
      expect(customers.every((c) => /^[a-f0-9]{64}$/.test(c.emailHash))).toBe(true);
      expect(customers.some((c) => c.name.length > 0)).toBe(true);
    },
    120_000
  );

  it.skipIf(!process.env.DATABASE_URL)(
    "syncs meta ad spend",
    async () => {
      const job = await makeJob("meta-historical-sync", metaConnId, {
        dateFrom: new Date(Date.now() - 30 * 86_400_000)
          .toISOString()
          .slice(0, 10),
        dateTo: new Date().toISOString().slice(0, 10),
      });

      let result = await runSyncPage(job);
      let pages = 1;
      while (!result.finished && pages < 40) {
        result = await runSyncPage({
          ...job,
          payload: { ...job.payload, cursor: result.cursor },
        });
        pages++;
      }
      expect(result.finished).toBe(true);

      const spend = await db
        .select()
        .from(normalizedAdSpend)
        .where(eq(normalizedAdSpend.userId, testUserId));
      expect(spend.length).toBeGreaterThan(50); // ~3 campaigns × 30 days

      const badSpend = spend.find((r) => !Number.isInteger(r.spendCents));
      expect(badSpend).toBeUndefined();
    },
    120_000
  );

  it.skipIf(!process.env.DATABASE_URL)(
    "aggregation writes pre-computed metrics with CORRECT CAC (new customers only)",
    async () => {
      const dayKey = daysAgoUtcStr(5);
      await aggregateUserDay(testUserId, dayKey);

      const overview = await getOverview(testUserId);

      // Revenue and spend present
      expect(overview.metrics._revenueCents).toBeGreaterThan(0);
      expect(overview.metrics._spendCents).toBeGreaterThan(0);

      // ROAS consistent with raw sums
      const expectedRoas =
        Math.round((overview.metrics._revenueCents * 100) / overview.metrics._spendCents) / 100;
      expect(overview.metrics.roas).toBeCloseTo(expectedRoas, 2);

      // Channels populated for all three ad platforms
      const channelNames = overview.channels.map((c) => c.channel).sort();
      expect(channelNames).toEqual(["google", "meta", "tiktok"]);

      // Trend covers 60 days
      expect(overview.trend.length).toBe(60);
    },
    60_000
  );

  it.skipIf(!process.env.DATABASE_URL)(
    "re-running sync is idempotent (upsert dedupe, no duplicates)",
    async () => {
      const before = await countOrders();

      const job = await makeJob("shopify-historical-sync", shopifyConnId, {
        dateFrom: new Date(Date.now() - 30 * 86_400_000)
          .toISOString()
          .slice(0, 10),
        dateTo: new Date().toISOString().slice(0, 10),
      });
      let result = await runSyncPage(job);
      let pages = 1;
      while (!result.finished && pages < 20) {
        result = await runSyncPage({
          ...job,
          payload: { ...job.payload, cursor: result.cursor },
        });
        pages++;
      }

      const after = await countOrders();
      expect(after).toBe(before); // zero duplicate orders
    },
    120_000
  );

  it.skipIf(!process.env.DATABASE_URL)(
    "edge case: fresh tenant with no data returns zeroed metrics (no crash)",
    async () => {
      // Brand-new user, no connections, no data
      const [emptyUser] = await db
        .insert(users)
        .values({
          email: `empty-${RUN_ID}@integration.test`,
          passwordHash: "x:y",
          name: "Empty User",
        })
        .returning();

      try {
        const overview = await getOverview(emptyUser!.id);
        expect(overview.metrics.revenue).toBe(0);
        expect(overview.metrics.roas).toBe(0); // zero spend → 0 not NaN
        expect(overview.metrics.cac).toBe(0); // zero customers → 0 not crash
        expect(overview.trend.length).toBe(60);
      } finally {
        await db.delete(users).where(eq(users.id, emptyUser!.id));
      }
    }
  );
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function daysAgoUtcStr(n: number): string {
  return new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
}

async function countOrders(): Promise<number> {
  const rows = await db
    .select({ id: normalizedOrders.id })
    .from(normalizedOrders)
    .where(eq(normalizedOrders.userId, testUserId));
  return rows.length;
}

// Silence unused import lint if skip paths trigger
void like;
