// src/modules/meta/client.ts
// Real Meta Marketing API insights client.
//
// Reliability features (AGENTS.md):
// → Cursor pagination via paging.cursors.after / paging.next
// → Rate-limit awareness: honors X-Business-Use-Case-Usage + 200 calls/hour
//   budget, exponential backoff + jitter on throttles and transient errors

import type {
  FetchPage,
  MetaFetchParams,
  RawRecord,
} from "@/modules/types";

const GRAPH_VERSION = "v21.0";
const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`;
const MAX_ATTEMPTS = 5;
const BASE_DELAY_MS = 2_000;
const JITTER_MS = 800;
// Meta allows ~200 calls/hour/token. Stay well under: ≥600ms between calls.
const MIN_CALL_INTERVAL_MS = 600;

export class MetaApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly isTransient: boolean
  ) {
    super(message);
    this.name = "MetaApiError";
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let lastCallAt = 0;

/** Enforce a minimum spacing between Graph API calls. */
async function throttle(): Promise<void> {
  const wait = lastCallAt + MIN_CALL_INTERVAL_MS - Date.now();
  if (wait > 0) await sleep(wait);
  lastCallAt = Date.now();
}

async function graphGet<T>(
  url: string,
  attempt = 0
): Promise<T> {
  await throttle();

  let res: Response;
  try {
    res = await fetch(url);
  } catch {
    if (attempt >= MAX_ATTEMPTS - 1) {
      throw new MetaApiError("Network error contacting Meta", 0, false);
    }
    await sleep(BASE_DELAY_MS * Math.pow(2, attempt) + Math.random() * JITTER_MS);
    return graphGet<T>(url, attempt + 1);
  }

  const body = (await res.json().catch(() => ({}))) as T & {
    error?: { code?: number; message?: string; is_transient?: boolean };
  };

  // Throttled / transient — retryable
  const errorCode = body.error?.code ?? 0;
  const throttled =
    res.status === 429 ||
    errorCode === 4 || // application request limit
    errorCode === 17 || // user request limit
    errorCode === 613;
  const transient = Boolean(body.error?.is_transient);

  if (throttled || transient || res.status >= 500) {
    if (attempt >= MAX_ATTEMPTS - 1) {
      throw new MetaApiError(
        body.error?.message ?? `Meta API error ${res.status}`,
        res.status,
        true
      );
    }
    // Check BUC usage header guidance
    const usage = res.headers.get("x-business-use-case-usage");
    let extraDelay = 0;
    if (usage) {
      try {
        const parsed = JSON.parse(usage) as Record<string, Array<{ call_count?: number }>>;
        const maxPct = Object.values(parsed)
          .flat()
          .reduce((m, v) => Math.max(m, v.call_count ?? 0), 0);
        if (maxPct >= 95) extraDelay = 60_000; // hard throttle — cool down
        else if (maxPct >= 75) extraDelay = 10_000;
      } catch { /* header parse issues are non-fatal */ }
    }
    await sleep(
      extraDelay + BASE_DELAY_MS * Math.pow(2, attempt) + Math.random() * JITTER_MS
    );
    return graphGet<T>(url, attempt + 1);
  }

  if (!res.ok || body.error) {
    // Auth errors etc — not retryable
    throw new MetaApiError(
      body.error?.message ?? `Meta API error ${res.status}`,
      res.status,
      false
    );
  }

  return body;
}

export interface MetaInsightJson {
  date_start?: string;
  date_stop?: string;
  campaign_id?: string;
  campaign_name?: string;
  spend?: string;
  impressions?: string;
  clicks?: string;
  actions?: Array<{ action_type: string; value: string }>;
  action_values?: Array<{ action_type: string; value: string }>;
  [key: string]: unknown;
}

/**
 * Fetch one page of campaign-level daily insights for a date range.
 * time_increment=1 → each row covers exactly one day per campaign.
 */
export async function listInsights(
  params: MetaFetchParams
): Promise<FetchPage<RawRecord> & { insights: Record<string, unknown>[] }> {
  const fields =
    "campaign_id,campaign_name,spend,impressions,clicks,actions,action_values";

  const search = new URLSearchParams({
    level: "campaign",
    time_increment: "1",
    time_range: JSON.stringify({ since: params.since, until: params.until }),
    fields,
    limit: String(Math.min(params.limit ?? 100, 500)),
    access_token: params.accessToken,
  });
  if (params.cursor) search.set("after", params.cursor);

  const url = `${GRAPH}/act_${params.adAccountId.replace(/^act_/, "")}/insights?${search}`;

  const body = await graphGet<{
    data?: MetaInsightJson[];
    paging?: { cursors?: { after?: string }; next?: string };
  }>(url);

  const rows = body.data ?? [];
  const records: RawRecord[] = rows.map((r) => ({
    externalId: `${r.campaign_id ?? "?"}:${r.date_start ?? "?"}`,
    eventType: "ad_spend",
    payload: r as unknown as Record<string, unknown>,
  }));

  return {
    insights: rows as unknown as Record<string, unknown>[],
    records,
    nextCursor: body.paging?.cursors?.after && body.paging.next
      ? body.paging.cursors.after
      : null,
  };
}
