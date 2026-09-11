// src/lib/attribution.ts
// Order attribution waterfall (ported from the retired Python engine).
//
// Resolution order — highest confidence wins:
//   Tier 1: Ad click IDs in landing URL (fbclid/gclid/ttclid)      conf 0.95
//   Tier 2: UTM parameters (utm_source + utm_medium)               conf 0.85
//   Tier 3: Platform-reported source_name / referring domain       conf 0.60
//   Tier 4: Fallbacks — "direct" when Shopify says so, else unknown conf ≤0.50

export type AttributionSource =
  | "meta"
  | "google"
  | "tiktok"
  | "email"
  | "organic"
  | "direct"
  | "unknown";

export interface AttributionInput {
  /** Full landing site URL, may include query params (UTMs, click IDs). */
  landingSite?: string | null;
  /** Referring site domain, e.g. "https://l.facebook.com". */
  referringSite?: string | null;
  /** Shopify's own source classification, e.g. "web", "facebook", "google". */
  sourceName?: string | null;
}

export interface AttributionResult {
  source: AttributionSource;
  confidence: number; // 0..1
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  clickId?: { key: string; value: string };
}

// ── Tier 1: ad click IDs ─────────────────────────────────────────────────────

const CLICK_ID_MAP: Record<string, AttributionSource> = {
  fbclid: "meta",
  gclid: "google",
  wbraid: "google",
  gbraid: "google",
  ttclid: "tiktok",
};

function detectClickId(params: URLSearchParams): {
  source: AttributionSource;
  clickId: { key: string; value: string };
} | null {
  for (const [key, value] of params.entries()) {
    const mapped = CLICK_ID_MAP[key.toLowerCase()];
    if (mapped && value) {
      return { source: mapped, clickId: { key, value } };
    }
  }
  return null;
}

// ── Tier 2: UTM parameters ───────────────────────────────────────────────────

const UTM_SOURCE_MAP: Array<{
  match: RegExp;
  source: AttributionSource;
}> = [
  { match: /^(facebook|fb|instagram|ig|meta|fb\.com)/i, source: "meta" },
  { match: /^(google|adwords|googleads|youtube)/i, source: "google" },
  { match: /^(tiktok|tt)/i, source: "tiktok" },
  { match: /(mail|newsletter|klaviyo|mailchimp|omnisend|email)/i, source: "email" },
];

const PAID_MEDIUM_RE = /(cpc|ppc|paid|ad?s$|display|retarget)/i;

function detectUtm(params: URLSearchParams): {
  source: AttributionSource;
  utm: Pick<AttributionResult, "utmSource" | "utmMedium" | "utmCampaign">;
} | null {
  const utmSource = params.get("utm_source");
  if (!utmSource) return null;

  const utmMedium = params.get("utm_medium") ?? undefined;
  const utmCampaign = params.get("utm_campaign") ?? undefined;

  let source: AttributionSource = "organic";
  const rule = UTM_SOURCE_MAP.find((r) => r.match.test(utmSource));
  if (rule) {
    source = rule.source;
  } else if (utmMedium && PAID_MEDIUM_RE.test(utmMedium)) {
    // Unknown paid source — attribute organically but flag medium
    source = "organic";
  }

  return {
    source,
    utm: {
      utmSource: utmSource.slice(0, 120),
      utmMedium: utmMedium?.slice(0, 120),
      utmCampaign: utmCampaign?.slice(0, 180),
    },
  };
}

// ── Tier 3: referrer / source_name domains ───────────────────────────────────

const REFERRER_MAP: Array<{ match: RegExp; source: AttributionSource }> = [
  { match: /(facebook|instagram|fb\.\w+|facebook\.com)/i, source: "meta" },
  { match: /google/i, source: "google" },
  { match: /tiktok/i, source: "tiktok" },
  { match: /(mail\w*\.|klaviyo|mailchimp|omnisend)/i, source: "email" },
];

function detectReferrer(
  input: AttributionInput
): { source: AttributionSource } | null {
  const haystack = `${input.referringSite ?? ""} ${input.sourceName ?? ""}`;
  if (!haystack.trim()) return null;

  const rule = REFERRER_MAP.find((r) => r.match.test(haystack));
  if (rule) return { source: rule.source };

  // Shopify's own classifications
  const sn = (input.sourceName ?? "").toLowerCase();
  if (sn === "direct" || sn === "pos") return { source: "direct" };
  if (sn === "email") return { source: "email" };

  return null;
}

// ── Main waterfall ───────────────────────────────────────────────────────────

/**
 * Resolve the acquisition channel for an order.
 * Pure function — no I/O, fully unit-testable.
 */
export function resolveAttribution(
  input: AttributionInput
): AttributionResult {
  const params = extractParams(input.landingSite);

  // Tier 1 — paid click IDs are the strongest signal
  const click = params && detectClickId(params);
  if (click) {
    const utm = params && detectUtm(params);
    return {
      source: click.source,
      confidence: 0.95,
      clickId: click.clickId,
      ...(utm?.utm ?? {}),
    };
  }

  // Tier 2 — explicit UTMs
  const utm = params && detectUtm(params);
  if (utm) {
    return {
      source: utm.source,
      confidence: 0.85,
      ...utm.utm,
    };
  }

  // Tier 3 — platform-reported source or referrer domain
  const ref = detectReferrer(input);
  if (ref) {
    return { source: ref.source, confidence: 0.6 };
  }

  // Tier 4 — fallbacks
  if ((input.referringSite ?? "").trim() === "" &&
      (input.sourceName ?? "").trim() === "") {
    return { source: "unknown", confidence: 0 };
  }
  if (!input.referringSite && (input.sourceName ?? "") === "web") {
    return { source: "direct", confidence: 0.5 };
  }
  return { source: "unknown", confidence: 0 };
}

function extractParams(url?: string | null): URLSearchParams | null {
  if (!url || !url.includes("?")) return null;
  try {
    const qs = url.slice(url.indexOf("?") + 1);
    return new URLSearchParams(qs.split("#")[0]);
  } catch {
    return null;
  }
}
