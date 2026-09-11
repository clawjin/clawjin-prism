// Unit tests — Shopify order normalizer.
// Verifies: integer-cents conversion, status mapping, refund handling,
// UTC timestamps, email hashing, attribution integration.

import { describe, expect, it } from "vitest";
import {
  mapOrderStatus,
  extractRefundedCents,
  normalizeShopifyOrder,
  markFirstOrders,
  extractCustomerMeta,
  type ShopifyOrderJson,
} from "@/modules/shopify/normalize";

const CTX = { userId: 1, connectionId: 2 };

function baseOrder(overrides: Partial<ShopifyOrderJson> = {}): ShopifyOrderJson {
  return {
    id: 9001,
    name: "#1001",
    created_at: "2026-08-15T10:30:00-04:00", // Eastern offset → UTC internally
    cancelled_at: null,
    financial_status: "paid",
    currency: "USD",
    subtotal_price: "100.00",
    current_total_price: "108.00",
    total_tax: "8.00",
    total_discounts: "0.00",
    total_shipping_price_set: { shop_money: { amount: "0.00" } },
    total_refunded_amount: "0.00",
    refunds: [],
    customer: { id: 77, email: "Jane.Doe@Example.com", first_name: "Jane", last_name: "Doe" },
    line_items: [{ quantity: 2 }],
    landing_site: "https://store.com/?utm_source=facebook&utm_medium=cpc&fbclid=X",
    referring_site: null,
    source_name: "web",
    test: false,
    ...overrides,
  };
}

describe("mapOrderStatus", () => {
  it("cancelled_at wins over financial_status", () => {
    expect(
      mapOrderStatus({ financial_status: "paid", cancelled_at: "2026-01-01" })
    ).toBe("cancelled");
  });

  it("maps known financial statuses", () => {
    expect(mapOrderStatus({ financial_status: "paid" })).toBe("paid");
    expect(mapOrderStatus({ financial_status: "partially_refunded" })).toBe("partially_refunded");
    expect(mapOrderStatus({ financial_status: "refunded" })).toBe("refunded");
    expect(mapOrderStatus({ financial_status: "pending" })).toBe("pending");
    expect(mapOrderStatus({ financial_status: "voided" })).toBe("cancelled");
  });

  it("unknown statuses default to pending (never count revenue)", () => {
    expect(mapOrderStatus({ financial_status: "weird_new_status" })).toBe("pending");
    expect(mapOrderStatus({})).toBe("pending");
  });
});

describe("extractRefundedCents", () => {
  it("sums successful transactions in cents", () => {
    const order = {
      refunds: [
        { transactions: [{ status: "success", amount: "5.25" }] },
        { transactions: [{ status: "success", amount: "3.75" }] },
      ],
    };
    expect(extractRefundedCents(order)).toBe(900);
  });

  it("ignores failed transactions", () => {
    const order = {
      refunds: [{ transactions: [{ status: "failure", amount: "5.25" }] }],
    };
    expect(extractRefundedCents(order)).toBe(0);
  });

  it("falls back to line items when no transactions", () => {
    const order = {
      refunds: [{ refund_line_items: [{ line_item: { subtotal: "12.34" } }] }],
    };
    expect(extractRefundedCents(order)).toBe(1234);
  });

  it("cross-checks against total_refunded_amount (max wins)", () => {
    const order = {
      refunds: [{ transactions: [{ status: "success", amount: "5.00" }] }],
      total_refunded_amount: "7.50",
    };
    expect(extractRefundedCents(order)).toBe(750);
  });
});

describe("normalizeShopifyOrder", () => {
  it("converts money to integer cents", () => {
    const row = normalizeShopifyOrder(
      baseOrder() as unknown as Record<string, unknown>,
      CTX
    )!;
    expect(row.subtotalCents).toBe(10000);
    expect(row.taxCents).toBe(800);
    expect(row.totalCents).toBe(10800);
    expect(row.netRevenueCents).toBe(10800);
  });

  it("subtracts refunds from net revenue", () => {
    const raw = baseOrder({
      financial_status: "partially_refunded",
      total_refunded_amount: "18.00",
      refunds: [{ transactions: [{ status: "success", amount: "18.00" }] }],
    });
    const row = normalizeShopifyOrder(raw as unknown as Record<string, unknown>, CTX)!;
    expect(row.refundedCents).toBe(1800);
    expect(row.netRevenueCents).toBe(9000); // 108.00 - 18.00
  });

  it("converts Eastern timestamp to UTC Date", () => {
    const row = normalizeShopifyOrder(
      baseOrder() as unknown as Record<string, unknown>,
      CTX
    )!;
    // 2026-08-15T10:30:00-04:00 === 14:30 UTC
    expect((row.orderedAt as Date).toISOString()).toBe("2026-08-15T14:30:00.000Z");
  });

  it("hashes email with HMAC — never plain, deterministic", () => {
    const a = normalizeShopifyOrder(baseOrder() as unknown as Record<string, unknown>, CTX)!;
    const b = normalizeShopifyOrder(
      baseOrder({
        customer: { id: 77, email: "jane.doe@example.com" }, // different case → same hash
      }) as unknown as Record<string, unknown>,
      CTX
    )!;
    expect(a.customerEmailHash).toBeTruthy();
    expect(b.customerEmailHash).toBeTruthy();
    expect(a.customerEmailHash).not.toBe("jane.doe@example.com");
    expect(a.customerEmailHash).toBe(b.customerEmailHash); // normalization works
  });

  it("resolves attribution from landing site", () => {
    const row = normalizeShopifyOrder(
      baseOrder() as unknown as Record<string, unknown>,
      CTX
    )!;
    expect(row.attributionSource).toBe("meta"); // fbclid present
    expect(row.fbclid).toBe("X");
  });

  it("skips test orders", () => {
    const row = normalizeShopifyOrder(
      baseOrder({ test: true }) as unknown as Record<string, unknown>,
      CTX
    );
    expect(row).toBeNull();
  });

  it("skips orders without id or created_at", () => {
    expect(normalizeShopifyOrder({} as Record<string, unknown>, CTX)).toBeNull();
    expect(
      normalizeShopifyOrder(
        baseOrder({ created_at: undefined }) as unknown as Record<string, unknown>,
        CTX
      )
    ).toBeNull();
  });

  it("rejects invalid timestamps", () => {
    const row = normalizeShopifyOrder(
      baseOrder({ created_at: "not-a-date" }) as unknown as Record<string, unknown>,
      CTX
    );
    expect(row).toBeNull();
  });
});

describe("markFirstOrders", () => {
  const mk = (id: string, at: string, hash: string | null) =>
    ({
      externalOrderId: id,
      orderedAt: new Date(at),
      customerEmailHash: hash,
      isFirstOrder: false,
    }) as unknown as Parameters<typeof markFirstOrders>[0][number];

  it("marks only the earliest order per customer", () => {
    const orders = [
      mk("1", "2026-01-05T00:00:00Z", "h1"),
      mk("2", "2026-02-05T00:00:00Z", "h1"), // returning customer h1
      mk("3", "2026-01-01T00:00:00Z", "h2"),
    ];
    markFirstOrders(orders);

    expect(orders[0]!.isFirstOrder).toBe(true);
    expect(orders[1]!.isFirstOrder).toBe(false);
    expect(orders[2]!.isFirstOrder).toBe(true);
  });

  it("orders without email hash are never first", () => {
    const orders = [
      mk("x", "2026-01-01T00:00:00Z", null),
    ];
    markFirstOrders(orders);
    expect(orders[0]!.isFirstOrder).toBe(false);
  });
});

describe("extractCustomerMeta", () => {
  it("assembles display name + hashed email", () => {
    const meta = extractCustomerMeta(baseOrder() as unknown as Record<string, unknown>);
    expect(meta?.name).toBe("Jane Doe");
    expect(meta?.externalCustomerId).toBe("77");
    expect(meta?.emailHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("returns null when no customer/email", () => {
    expect(extractCustomerMeta({ customer: null })).toBeNull();
  });
});
