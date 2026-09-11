// src/lib/hash.ts
// Privacy hashing — customer emails are NEVER stored in plain text.
// HMAC-SHA256 with a server-side secret salt: even if the database is
// compromised, emails cannot be brute-forced or rainbow-tabled.

import crypto from "node:crypto";

function getHashSecret(): string {
  const secret =
    process.env.EMAIL_HASH_SECRET ?? process.env.ENCRYPTION_KEY;
  if (!secret) {
    throw new Error(
      "[hash] EMAIL_HASH_SECRET (or ENCRYPTION_KEY fallback) is not set."
    );
  }
  return secret;
}

/**
 * Normalize + HMAC-hash an email address.
 * Normalization (lowercase, trim) guarantees the same person always
 * produces the same hash across Shopify, Meta, and manual imports.
 *
 * "Jane.Doe@Example.com " → same hash as "jane.doe@example.com"
 */
export function hashEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;
  return crypto
    .createHmac("sha256", getHashSecret())
    .update(normalized)
    .digest("hex");
}

/** Constant-time comparison of two hashes/signatures. */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}
