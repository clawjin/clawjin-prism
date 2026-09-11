// src/modules/meta/mock.ts
// Deterministic mock Meta insights generator.
// Same (adAccountId, day) → same campaign rows, so re-syncs are idempotent.

import { utcDayKey, eachDay, DAY_MS } from "@/lib/dates";
import type {
  FetchPage,
  MetaFetchParams,
  RawRecord,
} from "@/modules/types";
import type { MetaInsightJson } from "@/modules/meta/client";

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

const CAMPAIGNS = [
  { id: "23851234567890001", name: "Prospecting — Broad", dailyBudget: 180 },
  { id: "23851234567890002", name: "Retargeting — 30d Visitors", dailyBudget: 90 },
  { id: "23851234567890003", name: "Spring Promo — Conversion", dailyBudget: 120 },
];

/** Generate mock insight rows: one row per campaign per day in range. */
export function generateMockInsights(
  params: Pick<MetaFetchParams, "since" | "until"> & {
    seedKey?: string | number;
  }
): MetaInsightJson[] {
  const seedKey = params.seedKey ?? 0;

  // Clamp range to last 400 days
  const sinceMs = Date.parse(`${params.since}T00:00:00Z`);
  const untilMs = Date.parse(`${params.until}T00:00:00Z`);
  const from = Math.max(sinceMs, Date.now() - 400 * DAY_MS);
  const to = Math.min(untilMs, Date.now());
  if (!(from < to)) return [];

  const days = eachDay(
    utcDayKey(new Date(from)),
    utcDayKey(new Date(to - DAY_MS))
  );

  const out: MetaInsightJson[] = [];

  for (const day of days) {
    for (const campaign of CAMPAIGNS) {
      const rng = mulberry32(hashSeed("meta-mock", seedKey, day, campaign.id));

      // Weekend dip, recent-day upward trend
      const weekday = new Date(`${day}T00:00:00Z`).getUTCDay();
      const weekendFactor = weekday === 0 || weekday === 6 ? 0.75 : 1;
      const ageDays = (Date.now() - Date.parse(`${day}T00:00:00Z`)) / DAY_MS;
      const trendFactor = ageDays > 90 ? 0.7 : ageDays > 30 ? 0.9 : 1.1;

      const spend = campaign.dailyBudget * weekendFactor * trendFactor * (0.8 + rng() * 0.4);
      const cpm = 8 + rng() * 6; // $8–14 per 1000 impressions
      const impressions = Math.round((spend / cpm) * 1000);
      const ctr = 0.9 + rng() * 1.2; // 0.9%–2.1%
      const clicks = Math.max(1, Math.round((impressions * ctr) / 100));
      // ~3–5% of clicks convert at AOV-ish values
      const conversions = Math.max(0, Math.round(clicks * (0.03 + rng() * 0.02)));
      const conversionValue = conversions * (55 + rng() * 40);

      out.push({
        date_start: day,
        date_stop: day,
        campaign_id: campaign.id,
        campaign_name: campaign.name,
        spend: spend.toFixed(2),
        impressions: String(impressions),
        clicks: String(clicks),
        actions:
          conversions > 0
            ? [{ action_type: "purchase", value: String(conversions) }]
            : [],
        action_values:
          conversions > 0
            ? [{ action_type: "purchase", value: conversionValue.toFixed(2) }]
            : [],
      });
    }
  }

  return out;
}

/** Mock page fetcher matching the real client signature. */
export async function listInsights(
  params: MetaFetchParams
): Promise<FetchPage<RawRecord> & { insights: Record<string, unknown>[] }> {
  const all = generateMockInsights({
    since: params.since,
    until: params.until,
    seedKey: params.adAccountId,
  });

  const offset = params.cursor ? Number(params.cursor) || 0 : 0;
  const pageSize = Math.min(params.limit ?? 50, 500);
  const page = all.slice(offset, offset + pageSize);

  const records: RawRecord[] = page.map((r) => ({
    externalId: `${r.campaign_id}:${r.date_start}`,
    eventType: "ad_spend",
    payload: r as unknown as Record<string, unknown>,
  }));

  const nextOffset = offset + pageSize;
  return {
    insights: page as unknown as Record<string, unknown>[],
    records,
    nextCursor: nextOffset < all.length ? String(nextOffset) : null,
  };
}
