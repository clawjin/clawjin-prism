// Unit tests — attribution waterfall (4-tier resolution).

import { describe, expect, it } from "vitest";
import { resolveAttribution } from "@/lib/attribution";

describe("Tier 1: ad click IDs", () => {
  it("fbclid → meta with 0.95 confidence", () => {
    const r = resolveAttribution({
      landingSite:
        "https://store.com/p/serum?utm_source=facebook&utm_medium=cpc&fbclid=IwAR123",
    });
    expect(r.source).toBe("meta");
    expect(r.confidence).toBe(0.95);
    expect(r.clickId?.key).toBe("fbclid");
    expect(r.utmCampaign).toBeUndefined(); // no utm_campaign in URL
  });

  it("gclid → google", () => {
    const r = resolveAttribution({
      landingSite: "https://store.com/?gclid=EAIaIQ",
    });
    expect(r.source).toBe("google");
    expect(r.confidence).toBe(0.95);
  });

  it("ttclid → tiktok", () => {
    const r = resolveAttribution({
      landingSite: "https://store.com/?ttclid=ABC123",
    });
    expect(r.source).toBe("tiktok");
    expect(r.confidence).toBe(0.95);
  });

  it("click ID beats conflicting UTM", () => {
    const r = resolveAttribution({
      landingSite: "https://store.com/?utm_source=tiktok&utm_medium=cpc&gclid=G123",
    });
    expect(r.source).toBe("google"); // click id wins
  });
});

describe("Tier 2: UTM parameters", () => {
  it("facebook UTM → meta", () => {
    const r = resolveAttribution({
      landingSite:
        "https://store.com/?utm_source=facebook&utm_medium=cpc&utm_campaign=spring_promo",
    });
    expect(r.source).toBe("meta");
    expect(r.confidence).toBe(0.85);
    expect(r.utmSource).toBe("facebook");
    expect(r.utmMedium).toBe("cpc");
    expect(r.utmCampaign).toBe("spring_promo");
  });

  it("newsletter UTM → email", () => {
    const r = resolveAttribution({
      landingSite: "https://store.com/?utm_source=newsletter",
    });
    expect(r.source).toBe("email");
  });

  it("unknown source with paid medium → organic", () => {
    const r = resolveAttribution({
      landingSite: "https://store.com/?utm_source=pinterest&utm_medium=cpc",
    });
    expect(r.source).toBe("organic");
    expect(r.confidence).toBe(0.85);
  });
});

describe("Tier 3: referrer / source_name", () => {
  it("facebook referrer → meta", () => {
    const r = resolveAttribution({
      referringSite: "https://l.facebook.com/",
      sourceName: "web",
    });
    expect(r.source).toBe("meta");
    expect(r.confidence).toBe(0.6);
  });

  it("google referrer → google", () => {
    const r = resolveAttribution({
      referringSite: "https://www.google.com/",
    });
    expect(r.source).toBe("google");
  });

  it("source_name direct → direct", () => {
    const r = resolveAttribution({ sourceName: "direct" });
    expect(r.source).toBe("direct");
    expect(r.confidence).toBe(0.6);
  });
});

describe("Tier 4: fallbacks", () => {
  it("no signals at all → unknown, confidence 0", () => {
    const r = resolveAttribution({});
    expect(r.source).toBe("unknown");
    expect(r.confidence).toBe(0);
  });

  it("web + no referrer → direct", () => {
    const r = resolveAttribution({ sourceName: "web" });
    expect(r.source).toBe("direct");
    expect(r.confidence).toBe(0.5);
  });
});
