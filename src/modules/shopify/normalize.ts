// src/modules/shopify/normalize.ts
// Convert raw Shopify order JSON into our normalized, platform-agnostic rows.
//
// Rules (AGENTS.md):
// → ALL money → integer cents (Shopify sends dollar strings)
// → Timestamps → UTC Date objects
// → Customer email → HMAC hash (never plain)
// → Attribution via the 4-tier waterfall on landing_site/referring_site

import type { NewNormalizedOrder } from "@/db/schema";
import { toCents } from "@/lib/money";
import { hashEmail } from "@/lib/hash";
import {
  resolveAttribution,
  type AttributionSource,
} from "@/lib/attribution";

// ── Raw Shopify JSON shapes (subset we consume) ──────────────────────────────

interface ShopifyLineItem {
  quantity?: number | string;
}

interface ShopifyRefundLineItem {
  subtotal?: number | string | null;
}

interface ShopifyRefundTransaction {
  status?: string;
  amount?: number | string;
}

interface ShopifyRefund {
  refund_line_items?: Array<{ line_item?: ShopifyRefundLineItem }>;
  transactions?: ShopifyRefundTransaction[];
}

export interface ShopifyCustomer {
  id?: number | string;
  email?: string;
  first_name?: string | null;
  last_name?: string | null;
}

export interface ShopifyOrderJson {
  id?: number | string;
  name?: string;
  created_at?: string;
  cancelled_at?: string | null;
  financial_status?: string | null;
  currency?: string;
  total_price?: string;
  subtotal_price?: string;
  current_total_price?: string;
  total_tax?: string;
  total_discounts?: string;
  total_shipping_price_set?: {
    shop_money?: { amount?: string };
  };
  total_refunded_amount?: string | null;
  refunds?: ShopifyRefund[];
  customer?: ShopifyCustomer | null;
  line_items?: ShopifyLineItem[];
  landing_site?: string | null;
  referring_site?: string | null;
  source_name?: string | null;
  test?: boolean;
}

// ── Status mapping ───────────────────────────────────────────────────────────

/**
 * Map Shopify financial_status (+ cancelled_at) to our order_status enum.
 * "voided" = payment never captured → treated as cancelled.
 */
export function mapOrderStatus(order: ShopifyOrderJson): NewNormalizedOrder["status"] {
  if (order.cancelled_at) return "cancelled";
  switch ((order.financial_status ?? "").toLowerCase()) {
    case "paid":
      return "paid";
    case "partially_refunded":
      return "partially_refunded";
    case "refunded":
      return "refunded";
    case "partially_paid":
    case "authorized":
    case "pending":
      return "pending";
    case "voided":
      return "cancelled";
    default:
      // Unknown statuses default to pending — safer than counting revenue
      return "pending";
  }
}

/** Sum refund amounts in cents. Transactions are the money truth; fall back to refunded line items. */
export function extractRefundedCents(order: ShopifyOrderJson): number {
  let cents = 0;

  for (const refund of order.refunds ?? []) {
    for (const tx of refund.transactions ?? []) {
      if (tx.status && !["success", "pending"].includes(tx.status)) continue;
      if (tx.amount !== undefined) cents += toCents(tx.amount);
    }
    if (!refund.transactions?.length) {
      for (const li of refund.refund_line_items ?? []) {
        if (li.line_item?.subtotal != null) cents += toCents(li.line_item.subtotal);
      }
    }
  }

  // Cross-check against Shopify's own running total — take the max
  const reported = order.total_refunded_amount ? toCents(order.total_refunded_amount) : 0;
  return Math.max(cents, reported);
}

// ── Main normalizer ──────────────────────────────────────────────────────────

export interface NormalizeOrderContext {
  userId: number;
  connectionId: number;
}

/**
 * Normalize one raw Shopify order.
 * Returns null for test orders and orders without an id (never drop silently).
 */
export function normalizeShopifyOrder(
  raw: Record<string, unknown>,
  ctx: NormalizeOrderContext
): NewNormalizedOrder | null {
  const order = raw as ShopifyOrderJson;

  if (!order.id) {
    console.warn("[shopify-normalize] order missing id, skipping");
    return null;
  }
  if (order.test === true) return null; // test orders pollute metrics
  if (!order.created_at) {
    console.warn(`[shopify-normalize] order ${order.id} missing created_at`);
    return null;
  }

  const orderedAt = new Date(order.created_at); // ISO w/ offset → UTC internally
  if (isNaN(orderedAt.getTime())) {
    console.warn(`[shopify-normalize] order ${order.id} invalid created_at`);
    return null;
  }

  const status = mapOrderStatus(order);

  // Money — Shopify prices are strings like "150.00"
  const subtotalCents = toCents(order.subtotal_price ?? 0);
  const taxCents = toCents(order.total_tax ?? 0);
  const discountCents = toCents(order.total_discounts ?? 0);
  const shippingCents = toCents(
    order.total_shipping_price_set?.shop_money?.amount ?? 0
  );
  // current_total_price reflects post-edit totals; prefer it when present
  const totalCents =
    order.current_total_price !== undefined
      ? toCents(order.current_total_price)
      : toCents(order.total_price ?? 0);
  const refundedCents = Math.min(extractRefundedCents(order), totalCents);

  // Net revenue: what the merchant actually keeps from this order
  const netRevenueCents = Math.max(0, totalCents - refundedCents);

  // Attribution waterfall
  const attribution = resolveAttribution({
    landingSite: order.landing_site,
    referringSite: order.referring_site,
    sourceName: order.source_name,
  });

  // Privacy: HMAC-hash the email, keep platform's customer id for joins
  const emailHash = hashEmail(order.customer?.email);

  const lineItemsCount = (order.line_items ?? []).reduce(
    (sum, li) => sum + Number(li.quantity ?? 1),
    0
  );

  return {
    userId: ctx.userId,
    connectionId: ctx.connectionId,
    platform: "shopify",
    externalOrderId: String(order.id),
    orderNumber: order.name ?? null,
    status,
    currency: (order.currency ?? "USD").toUpperCase().slice(0, 8),
    subtotalCents,
    discountCents,
    shippingCents,
    taxCents,
    totalCents,
    refundedCents,
    netRevenueCents,
    attributionSource:
      attribution.source as NewNormalizedOrder["attributionSource"],
    utmSource: attribution.utmSource ?? null,
    utmMedium: attribution.utmMedium ?? null,
    utmCampaign: attribution.utmCampaign ?? null,
    fbclid:
      attribution.clickId?.key === "fbclid" ? attribution.clickId.value : null,
    customerEmailHash: emailHash,
    externalCustomerId: order.customer?.id
      ? String(order.customer.id)
      : null,
    isFirstOrder: false, // set by backfill pass below
    lineItemsCount,
    orderedAt,
  };
}

/**
 * Backfill `isFirstOrder`: an order is a first order iff no earlier paid
 * order exists with the same customerEmailHash for this user.
 * Runs per sync batch — O(n log n), bounded by batch size.
 */
export function markFirstOrders(orders: NewNormalizedOrder[]): void {
  const firstSeen = new Map<string, number>(); // emailHash → earliest ms

  for (const o of orders) {
    if (!o.customerEmailHash) continue;
    const ms = (o.orderedAt as Date).getTime();
    const prev = firstSeen.get(o.customerEmailHash);
    if (prev === undefined || ms < prev) {
      firstSeen.set(o.customerEmailHash, ms);
    }
  }

  for (const o of orders) {
    if (!o.customerEmailHash) continue;
    o.isFirstOrder =
      (o.orderedAt as Date).getTime() === firstSeen.get(o.customerEmailHash);
  }
}

// ── Customer metadata (for display rollups; email itself never stored) ───────

export interface OrderCustomerMeta {
  emailHash: string;
  /** Display name assembled from Shopify's split name fields. */
  name: string;
  externalCustomerId: string | null;
}

/** Pull display-safe customer info from a raw order (no plain email kept). */
export function extractCustomerMeta(
  raw: Record<string, unknown>
): OrderCustomerMeta | null {
  const order = raw as ShopifyOrderJson;
  const emailHash = hashEmail(order.customer?.email);
  if (!emailHash) return null;

  const name =
    [order.customer?.first_name, order.customer?.last_name]
      .filter((p): p is string => Boolean(p && p.trim()))
      .join(" ")
      .slice(0, 120) || "";

  return {
    emailHash,
    name,
    externalCustomerId: order.customer?.id ? String(order.customer.id) : null,
  };
}
