// src/modules/shopify/mock.ts
// Deterministic mock Shopify order generator.
//
// Same (connectionId, date window) always yields the SAME orders — external
// IDs are derived from connection + day + sequence, so upserts stay idempotent
// across repeated syncs. Payload shape mirrors the real REST Admin API.

import { utcDayKey, DAY_MS } from "@/lib/dates";
import type {
  FetchPage,
  RawRecord,
  ShopifyFetchParams,
} from "@/modules/types";
import type { ShopifyOrderJson } from "@/modules/shopify/normalize";

// ── Seeded PRNG (mulberry32) — deterministic across processes ────────────────

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(...parts: Array<string | number>): number {
  let h = 2166136261;
  const str = parts.join("|");
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// ── Mock catalog ─────────────────────────────────────────────────────────────

const PRODUCTS = [
  { title: "Vitamin C Serum", price: 42.0 },
  { title: "Hydrating Cleanser", price: 28.5 },
  { title: "Night Repair Cream", price: 64.99 },
  { title: "SPF 50 Sunscreen", price: 24.0 },
  { title: "Retinol Booster", price: 55.25 },
] as const;

const CHANNELS = [
  { utm_source: "facebook", utm_medium: "cpc", fbclid: true },
  { utm_source: "google", utm_medium: "cpc", fbclid: false },
  { utm_source: "tiktok", utm_medium: "paid_social", fbclid: false },
] as const;

const FIRST_NAMES = ["Emma", "Liam", "Olivia", "Noah", "Ava", "Ethan", "Mia", "Lucas"];
const LAST_NAMES = ["Johnson", "Smith", "Brown", "Garcia", "Miller", "Davis"];

// ── Generator ────────────────────────────────────────────────────────────────

/**
 * Generate mock raw orders for the given day range.
 * Orders per day scales with recency (recent days busier), 4-14/day.
 */
export function generateMockOrders(
  params: Pick<ShopifyFetchParams, "createdAtMin" | "createdAtMax"> & {
    seedKey?: string | number;
  }
): ShopifyOrderJson[] {
  const seedKey = params.seedKey ?? 0;
  const startMs = new Date(params.createdAtMin).getTime();
  const endMs = new Date(params.createdAtMax).getTime();

  // Clamp to sane bounds
  const from = Math.max(startMs, Date.now() - 400 * DAY_MS);
  const to = Math.min(endMs, Date.now() + DAY_MS);
  if (!(from < to)) return [];

  const out: ShopifyOrderJson[] = [];

  for (let dayStart = from; dayStart < to; dayStart += DAY_MS) {
    const dayKey = utcDayKey(new Date(dayStart));
    const rng = mulberry32(hashSeed("shopify-mock", seedKey, dayKey));

    // Recent days trend busier — gives dashboards an upward story
    const ageDays = (Date.now() - dayStart) / DAY_MS;
    const base = ageDays > 90 ? 4 : ageDays > 30 ? 8 : 12;
    const count = base - Math.floor(rng() * 4);

    for (let i = 0; i < count; i++) {
      out.push(
        buildMockOrder({
          rng,
          id: `mock-${seedKey}-${dayKey}-${i}`,
          placedAt: new Date(dayStart + Math.floor(rng() * DAY_MS)),
        })
      );
    }
  }

  return out;
}

function buildMockOrder(opts: {
  rng: () => number;
  id: string;
  placedAt: Date;
}): ShopifyOrderJson {
  const { rng, id, placedAt } = opts;

  const product = PRODUCTS[Math.floor(rng() * PRODUCTS.length)]!;
  const quantity = 1 + Math.floor(rng() * 3);

  const subtotal = product.price * quantity;
  const shipping = rng() < 0.3 ? 0 : 4.95;
  const tax = subtotal * 0.08;
  const total = subtotal + shipping + tax;

  // ~12% refunded, ~4% cancelled, rest paid/pending mix
  const roll = rng();
  let financial_status = "paid";
  let cancelled_at: string | null = null;
  let refunds: ShopifyOrderJson["refunds"];
  if (roll < 0.04) {
    financial_status = "voided";
    cancelled_at = new Date(placedAt.getTime() + 3600_000).toISOString();
  } else if (roll < 0.16) {
    financial_status = "refunded";
    refunds = [
      {
        transactions: [{ status: "success", amount: total.toFixed(2) }],
      },
    ];
  }

  const channelIdx = rng() < 0.45 ? 0 : rng() < 0.7 ? 1 : 2;
  const channel = CHANNELS[channelIdx]!;

  const first = FIRST_NAMES[Math.floor(rng() * FIRST_NAMES.length)]!;
  const last = LAST_NAMES[Math.floor(rng() * LAST_NAMES.length)]!;

  const clickParam = channel.fbclid ? `&fbclid=IwAR${id.slice(-8)}abc` : "";
  const landingSite =
    rng() < 0.75
      ? `https://acmeskincare.com/products/${encodeURIComponent(product.title.toLowerCase().replace(/\s+/g, "-"))}?utm_source=${channel.utm_source}&utm_medium=${channel.utm_medium}&utm_campaign=spring_promo${clickParam}`
      : "";

  const customerId = 900000 + (hashSeed(first, last) % 50000);

  return {
    id,
    name: `#M${id.replace(/\D/g, "").slice(-6)}`,
    created_at: placedAt.toISOString(),
    cancelled_at,
    financial_status,
    currency: "USD",
    subtotal_price: subtotal.toFixed(2),
    current_total_price: total.toFixed(2),
    total_tax: tax.toFixed(2),
    total_discounts: "0.00",
    total_shipping_price_set: { shop_money: { amount: shipping.toFixed(2) } },
    total_refunded_amount:
      financial_status === "refunded" ? total.toFixed(2) : "0.00",
    refunds,
    customer: {
      id: customerId,
      email: `${first.toLowerCase()}.${last.toLowerCase()}${customerId % 97}@example.com`,
      first_name: first,
      last_name: last,
    },
    line_items: [{ quantity }],
    landing_site: landingSite || null,
    referring_site: landingSite ? null : rng() < 0.2 ? "https://www.google.com/" : null,
    source_name: landingSite ? "web" : "direct",
    test: false,
  };
}

/** Mock page fetcher matching the real client signature. */
export async function listOrders(
  params: ShopifyFetchParams
): Promise<FetchPage<RawRecord> & { orders: Record<string, unknown>[] }> {
  const all = generateMockOrders({
    createdAtMin: params.createdAtMin,
    createdAtMax: params.createdAtMax,
    seedKey: params.shopDomain,
  });

  // Cursor = numeric offset into the sorted result set
  const offset = params.cursor ? Number(params.cursor) || 0 : 0;
  const pageSize = Math.min(params.limit ?? 100, 250);
  const page = all.slice(offset, offset + pageSize);

  const records: RawRecord[] = page.map((o) => ({
    externalId: String(o.id),
    eventType: "order",
    payload: o as unknown as Record<string, unknown>,
  }));

  const nextOffset = offset + pageSize;
  return {
    orders: page as unknown as Record<string, unknown>[],
    records,
    nextCursor: nextOffset < all.length ? String(nextOffset) : null,
  };
}
