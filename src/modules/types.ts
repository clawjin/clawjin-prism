// src/modules/types.ts
// Contracts every platform connector implements. The sync worker only talks
// to these interfaces — real API clients and deterministic mocks are
// interchangeable behind them (USE_REAL_API feature flag).

import type { NewNormalizedAdSpend, NewNormalizedOrder } from "@/db/schema";

/** Raw platform payload stored verbatim in raw_events. */
export interface RawRecord {
  /** Platform's own unique id for this record (dedupe key). */
  externalId: string;
  /** "order" | "ad_spend" | ... */
  eventType: string;
  /** EXACT JSON from the platform API — never modified downstream. */
  payload: Record<string, unknown>;
}

export interface FetchPage<TRaw> {
  records: TRaw[];
  /** Cursor to resume from. null/undefined = last page. */
  nextCursor?: string | null;
}

export interface ShopifyFetchParams {
  accessToken: string;
  shopDomain: string;
  /** ISO timestamps — inclusive/exclusive bounds on order creation. */
  createdAtMin: string;
  createdAtMax: string;
  cursor?: string | null;
  limit?: number;
}

export interface MetaFetchParams {
  accessToken: string;
  adAccountId: string;
  /** "YYYY-MM-DD" inclusive day keys. */
  since: string;
  until: string;
  cursor?: string | null;
  limit?: number;
}

/** Minimal capability surface the sync engine needs from any platform. */
export interface PlatformClient {
  listOrders(
    params: ShopifyFetchParams
  ): Promise<FetchPage<RawRecord> & { orders: Record<string, unknown>[] }>;
  listInsights(
    params: MetaFetchParams
  ): Promise<FetchPage<RawRecord> & { insights: Record<string, unknown>[] }>;
}

export interface NormalizedBundle {
  orders: NewNormalizedOrder[];
  adSpend: NewNormalizedAdSpend[];
}
