// Unit tests — webhook HMAC verification (Shopify base64 + Meta hex).
// AGENTS.md security requirement: mismatches rejected immediately.

import { describe, expect, it, beforeAll } from "vitest";
import crypto from "node:crypto";
import { verifyShopifyHmac, verifyMetaHmac } from "@/lib/webhook-verify";

const BODY = JSON.stringify({ id: 12345, total_price: "42.00" });
const SECRET = "test-webhook-secret";

function shopifySig(body: string, secret = SECRET): string {
  return crypto.createHmac("sha256", secret).update(body, "utf8").digest("base64");
}

function metaSig(body: string, secret = SECRET): string {
  return (
    "sha256=" +
    crypto.createHmac("sha256", secret).update(body, "utf8").digest("hex")
  );
}

describe("verifyShopifyHmac", () => {
  beforeAll(() => {
    process.env.SHOPIFY_WEBHOOK_SECRET = SECRET;
  });

  it("accepts a valid signature", () => {
    expect(verifyShopifyHmac(BODY, shopifySig(BODY), SECRET)).toBe(true);
  });

  it("rejects tampered body", () => {
    const tampered = BODY.replace("42.00", "999.00");
    expect(verifyShopifyHmac(tampered, shopifySig(BODY), SECRET)).toBe(false);
  });

  it("rejects wrong secret", () => {
    expect(verifyShopifyHmac(BODY, shopifySig(BODY, "other"), SECRET)).toBe(false);
  });

  it("rejects missing header", () => {
    expect(verifyShopifyHmac(BODY, null, SECRET)).toBe(false);
  });

  it("rejects empty secret", () => {
    expect(verifyShopifyHmac(BODY, shopifySig(BODY), "")).toBe(false);
  });
});

describe("verifyMetaHmac", () => {
  beforeAll(() => {
    process.env.META_WEBHOOK_SECRET = SECRET;
  });

  it("accepts a valid sha256= signature", () => {
    expect(verifyMetaHmac(BODY, metaSig(BODY), SECRET)).toBe(true);
  });

  it("rejects tampered body", () => {
    const tampered = BODY.replace("12345", "99999");
    expect(verifyMetaHmac(tampered, metaSig(BODY), SECRET)).toBe(false);
  });

  it("rejects missing sha256= prefix", () => {
    const bare = crypto.createHmac("sha256", SECRET).update(BODY).digest("hex");
    expect(verifyMetaHmac(BODY, bare, SECRET)).toBe(false);
  });

  it("rejects missing header", () => {
    expect(verifyMetaHmac(BODY, null, SECRET)).toBe(false);
  });
});
