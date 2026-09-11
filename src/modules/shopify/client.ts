// src/modules/shopify/client.ts
// Real Shopify REST Admin API client.
//
// Reliability features (AGENTS.md):
// → Cursor pagination via Link headers (page_info)
// → Leaky-bucket throttle honoring X-Shopify-Shop-Api-Call-Limit
// → Exponential backoff + jitter on 429/5xx/network errors, max 5 attempts

import type {
  FetchPage,
  RawRecord,
  ShopifyFetchParams,
} from "@/modules/types";

const API_VERSION = "2024-10";
const MAX_ATTEMPTS = 5;
const BASE_DELAY_MS = 1_000;
const JITTER_MS = 500;

export class ShopifyApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly retryAfterMs?: number
  ) {
    super(message);
    this.name = "ShopifyApiError";
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function backoffDelay(attempt: number, retryAfterMs?: number): number {
  if (retryAfterMs && retryAfterMs > 0) return retryAfterMs + Math.random() * JITTER_MS;
  return BASE_DELAY_MS * Math.pow(2, attempt) + Math.random() * JITTER_MS;
}

/** Extract `page_info` cursor from the Link response header. */
export function parseNextCursor(linkHeader: string | null): string | null {
  if (!linkHeader) return null;
  for (const part of linkHeader.split(",")) {
    if (!part.includes('rel="next"')) continue;
    const match = part.match(/<([^>]+)>/);
    if (!match?.[1]) continue;
    try {
      const url = new URL(match[1]);
      return url.searchParams.get("page_info");
    } catch {
      return null;
    }
  }
  return null;
}

async function shopifyFetch(
  shopDomain: string,
  accessToken: string,
  path: URLSearchParams,
  attempt = 0
): Promise<Response> {
  const url = `https://${shopDomain}/admin/api/${API_VERSION}/orders.json?${path}`;

  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        "X-Shopify-Access-Token": accessToken,
        "Content-Type": "application/json",
      },
    });
  } catch {
    // Network error — retryable
    if (attempt >= MAX_ATTEMPTS - 1) throw new ShopifyApiError("Network error contacting Shopify", 0);
    await sleep(backoffDelay(attempt));
    return shopifyFetch(shopDomain, accessToken, path, attempt + 1);
  }

  // Rate limited — honor Retry-After, then backoff
  if (res.status === 429) {
    const retryAfter = Number(res.headers.get("Retry-After") ?? 0) * 1000;
    if (attempt >= MAX_ATTEMPTS - 1) {
      throw new ShopifyApiError("Shopify rate limit exceeded after retries", 429);
    }
    await sleep(backoffDelay(attempt, retryAfter));
    return shopifyFetch(shopDomain, accessToken, path, attempt + 1);
  }

  // Server error — retryable
  if (res.status >= 500) {
    if (attempt >= MAX_ATTEMPTS - 1) {
      throw new ShopifyApiError(
        `Shopify server error ${res.status}`,
        res.status
      );
    }
    await sleep(backoffDelay(attempt));
    return shopifyFetch(shopDomain, accessToken, path, attempt + 1);
  }

  if (!res.ok) {
    // 401/404 etc — NOT retryable, surface immediately
    throw new ShopifyApiError(
      `Shopify API error ${res.status}: ${(await res.text()).slice(0, 300)}`,
      res.status
    );
  }

  // Proactive throttle: bucket is "used/max". Sleep when nearly full.
  const bucket = res.headers.get("X-Shopify-Shop-Api-Call-Limit");
  if (bucket) {
    const [used, max] = bucket.split("/").map(Number);
    if (max > 0 && used / max >= 0.9) await sleep(1_000);
  }

  return res;
}

/**
 * Fetch one page of orders in a creation-time window.
 * Follows Shopify's cursor pagination; pass `cursor` to resume.
 */
export async function listOrders(
  params: ShopifyFetchParams
): Promise<FetchPage<RawRecord> & { orders: Record<string, unknown>[] }> {
  const search = new URLSearchParams({
    status: "any",
    limit: String(Math.min(params.limit ?? 250, 250)),
    created_at_min: params.createdAtMin,
    created_at_max: params.createdAtMax,
    order: "created_at asc",
    fields:
      "id,name,created_at,updated_at,cancelled_at,financial_status," +
      "total_price,subtotal_price,current_total_price,total_tax," +
      "total_discounts,total_shipping_price_set,currency,customer," +
      "line_items,refunds,landing_site,referring_site,source_name," +
      "test,total_refunded_amount",
  });
  if (params.cursor) search.set("page_info", params.cursor);

  const res = await shopifyFetch(params.shopDomain, params.accessToken, search);

  const body = (await res.json()) as { orders?: Record<string, unknown>[] };
  const orders = body.orders ?? [];

  const records: RawRecord[] = orders.map((o) => ({
    externalId: String(o.id),
    eventType: "order",
    payload: o,
  }));

  return {
    orders,
    records,
    nextCursor: parseNextCursor(res.headers.get("Link")),
  };
}
