// src/lib/webhook-verify.ts
// HMAC signature verification for incoming platform webhooks.
// AGENTS.md: "Mismatches rejected immediately" — before any DB write.

import crypto from "node:crypto";
import { safeEqual } from "@/lib/hash";

/**
 * Shopify signs the RAW request body with HMAC-SHA256, base64-encoded,
 * in the X-Shopify-Hmac-Sha256 header.
 */
export function verifyShopifyHmac(
  rawBody: string,
  signatureHeader: string | null,
  secret: string = process.env.SHOPIFY_WEBHOOK_SECRET ?? ""
): boolean {
  if (!secret || !signatureHeader) return false;

  const digest = crypto
    .createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("base64");

  // Shopify sends base64; compare constant-time after length check
  return safeEqual(digest, signatureHeader);
}

/**
 * Meta signs with X-Hub-Signature-256: "sha256=<hexdigest>" over the raw body.
 */
export function verifyMetaHmac(
  rawBody: string,
  signatureHeader: string | null,
  secret: string = process.env.META_WEBHOOK_SECRET ?? ""
): boolean {
  if (!secret || !signatureHeader) return false;

  const expected = "sha256=" +
    crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");

  return safeEqual(expected, signatureHeader);
}
