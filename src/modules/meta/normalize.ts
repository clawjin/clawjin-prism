// src/modules/meta/normalize.ts
// Convert raw Meta insight rows into normalized ad-spend rows.
//
// Rules (AGENTS.md):
// → spend is a dollar STRING → integer cents
// → impressions/clicks are strings → integers
// → Conversions pulled from the actions[] array (purchase action types)
// → Attribution window documented per AGENTS.md (Meta's default 7d-click)

import type { NewNormalizedAdSpend } from "@/db/schema";
import { toCents } from "@/lib/money";
import { isValidDayKey } from "@/lib/dates";

interface MetaInsightRow {
  date_start?: string;
  campaign_id?: string;
  campaign_name?: string;
  spend?: string;
  impressions?: string;
  clicks?: string;
  actions?: Array<{ action_type: string; value: string }>;
  action_values?: Array<{ action_type: string; value: string }>;
}

/**
 * Action types Meta uses for purchase conversions across attribution windows.
 * We sum all purchase-flavored actions — the row documents the default
 * 7-day-click / 1-day-view window Meta reports.
 */
const PURCHASE_ACTION_RE = /^(purchase|offsite_conversion\.fb_pixel_purchase|onsite_web_pixel_purchase)$/;

export function extractPurchases(row: MetaInsightRow): {
  count: number;
  valueCents: number;
} {
  let count = 0;
  let valueCents = 0;

  for (const a of row.actions ?? []) {
    if (PURCHASE_ACTION_RE.test(a.action_type)) {
      count += Number(a.value ?? 0);
    }
  }
  for (const a of row.action_values ?? []) {
    if (PURCHASE_ACTION_RE.test(a.action_type)) {
      valueCents += toCents(a.value ?? 0);
    }
  }

  return { count, valueCents };
}

export interface NormalizeInsightContext {
  userId: number;
  connectionId: number;
}

/** Normalize one raw Meta insight row. Null when unidentifiable. */
export function normalizeMetaInsight(
  raw: Record<string, unknown>,
  ctx: NormalizeInsightContext
): NewNormalizedAdSpend | null {
  const row = raw as MetaInsightRow;

  if (!row.campaign_id) {
    console.warn("[meta-normalize] insight missing campaign_id, skipping");
    return null;
  }
  if (!row.date_start || !isValidDayKey(row.date_start)) {
    console.warn(`[meta-normalize] campaign ${row.campaign_id} bad date`);
    return null;
  }

  const purchases = extractPurchases(row);

  return {
    userId: ctx.userId,
    connectionId: ctx.connectionId,
    platform: "meta",
    campaignId: String(row.campaign_id),
    campaignName: row.campaign_name?.slice(0, 200) ?? "",
    adsetId: null,
    adsetName: null,
    adId: null,
    adName: null,
    spendDate: row.date_start.slice(0, 10),
    currency: "USD", // Meta reports in account currency; stored at connection level
    spendCents: toCents(row.spend ?? 0),
    impressions: Number(row.impressions ?? 0),
    clicks: Number(row.clicks ?? 0),
    conversions: Math.round(purchases.count),
    conversionValueCents: purchases.valueCents,
  };
}
