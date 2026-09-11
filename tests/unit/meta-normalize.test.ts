// Unit tests — Meta insights normalizer.
// Verifies: dollar-string → cents, string metrics → ints, purchase action
// extraction from actions[]/action_values[], date validation.

import { describe, expect, it } from "vitest";
import { normalizeMetaInsight, extractPurchases } from "@/modules/meta/normalize";

const CTX = { userId: 1, connectionId: 3 };

function baseInsight(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    date_start: "2026-08-15",
    campaign_id: "2385000",
    campaign_name: "Prospecting",
    spend: "123.45",
    impressions: "45678",
    clicks: "512",
    actions: [{ action_type: "purchase", value: "7" }],
    action_values: [{ action_type: "purchase", value: "412.30" }],
    ...overrides,
  };
}

describe("extractPurchases", () => {
  it("sums purchase actions across attribution flavors", () => {
    const p = extractPurchases({
      actions: [
        { action_type: "purchase", value: "3" },
        { action_type: "offsite_conversion.fb_pixel_purchase", value: "2" },
        { action_type: "link_click", value: "50" }, // ignored
      ],
      action_values: [
        { action_type: "purchase", value: "100.00" },
        { action_type: "offsite_conversion.fb_pixel_purchase", value: "55.55" },
      ],
    });
    expect(p.count).toBe(5);
    expect(p.valueCents).toBe(15555);
  });

  it("handles missing action arrays", () => {
    expect(extractPurchases({})).toEqual({ count: 0, valueCents: 0 });
  });
});

describe("normalizeMetaInsight", () => {
  it("converts spend and metrics to integers/cents", () => {
    const row = normalizeMetaInsight(baseInsight(), CTX)!;
    expect(row.spendCents).toBe(12345);
    expect(row.impressions).toBe(45678);
    expect(row.clicks).toBe(512);
    expect(row.conversions).toBe(7);
    expect(row.conversionValueCents).toBe(41230);
  });

  it("keeps platform + campaign identity", () => {
    const row = normalizeMetaInsight(baseInsight(), CTX)!;
    expect(row.platform).toBe("meta");
    expect(row.campaignId).toBe("2385000");
    expect(row.campaignName).toBe("Prospecting");
    expect(row.spendDate).toBe("2026-08-15");
  });

  it("rejects rows without campaign_id", () => {
    expect(normalizeMetaInsight(baseInsight({ campaign_id: undefined }), CTX)).toBeNull();
  });

  it("rejects invalid dates", () => {
    expect(
      normalizeMetaInsight(baseInsight({ date_start: "08/15/2026" }), CTX)
    ).toBeNull();
    expect(normalizeMetaInsight(baseInsight({ date_start: undefined }), CTX)).toBeNull();
  });

  it("handles zero-spend days gracefully", () => {
    const row = normalizeMetaInsight(
      baseInsight({ spend: "0.00", impressions: "0", clicks: "0", actions: [], action_values: [] }),
      CTX
    )!;
    expect(row.spendCents).toBe(0);
    expect(row.impressions).toBe(0);
    expect(row.clicks).toBe(0);
  });

  it("parses numeric strings Meta sends as text", () => {
    const row = normalizeMetaInsight(
      baseInsight({ spend: "1,299.99", impressions: "1000000", clicks: "2500" }),
      CTX
    )!;
    // toCents strips commas
    expect(row.spendCents).toBe(129999);
    expect(row.impressions).toBe(1000000);
  });
});
