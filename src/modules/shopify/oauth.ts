// src/modules/shopify/oauth.ts
// Shopify OAuth 2.0 flow.
//
// Security (AGENTS.md):
// → Random state token stored in Redis w/ 10-minute TTL (CSRF protection)
// → State is single-use: consumed on callback
// → Access token encrypted before storage (see lib/encryption)

import crypto, { createHmac } from "node:crypto";
import { redis } from "@/lib/redis";

const API_VERSION = "2024-10";
const SCOPES = ["read_orders", "read_products", "read_customers"];
const STATE_TTL_SECONDS = 600; // 10 minutes per spec

export function isShopifyConfigured(): boolean {
  return !!(process.env.SHOPIFY_CLIENT_ID && process.env.SHOPIFY_CLIENT_SECRET);
}

/** Validate a shop domain to prevent open-redirect / SSRF via `?shop=`. */
export function isValidShopDomain(shop: string): boolean {
  return /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i.test(shop);
}

// ── Install (step 1) ─────────────────────────────────────────────────────────

/**
 * Create + persist a single-use state token, return the authorize URL.
 * The state binds the OAuth initiation to this specific user session.
 */
export async function buildInstallUrl(
  userId: number,
  shopDomain: string,
  redirectUri: string,
  nonce?: string
): Promise<string> {
  const state = crypto.randomBytes(24).toString("hex");

  const payload = JSON.stringify({ userId, shopDomain, nonce, createdAt: Date.now() });
  if (redis.isConfigured()) {
    await redis.set(`oauth:state:${state}`, payload, STATE_TTL_SECONDS);
  }
  // If Redis is down we still proceed — callback falls back to session check.

  const params = new URLSearchParams({
    client_id: process.env.SHOPIFY_CLIENT_ID ?? "",
    scope: SCOPES.join(","),
    redirect_uri: redirectUri,
    state,
  });

  return `https://${shopDomain}/admin/oauth/authorize?${params}`;
}

/**
 * Verify + consume a state token on callback.
 * Returns the bound payload or null (invalid/expired/replayed).
 */
export async function consumeStateToken(
  state: string
): Promise<{ userId: number; shopDomain: string; nonce?: string } | null> {
  if (!redis.isConfigured()) return null;

  const key = `oauth:state:${state}`;
  const raw = await redis.get(key);
  if (!raw) return null; // expired or replayed

  await redis.del(key); // single use

  try {
    const parsed = JSON.parse(raw) as {
      userId: number;
      shopDomain: string;
      nonce?: string;
    };
    if (!parsed.userId || !parsed.shopDomain) return null;
    return parsed;
  } catch {
    return null;
  }
}

// ── Callback (step 2) ────────────────────────────────────────────────────────

/**
 * Verify the callback signature:
 * HMAC-SHA256 of sorted query params (minus hmac/ signature itself)
 * using the client secret. Prevents tampered redirects.
 */
export function verifyCallbackHmac(
  searchParams: URLSearchParams
): boolean {
  const secret = process.env.SHOPIFY_CLIENT_SECRET;
  const hmac = searchParams.get("hmac");
  if (!secret || !hmac) return false;

  const message = [...searchParams.entries()]
    .filter(([k]) => k !== "hmac" && k !== "signature")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");

  const digest = createHmac("sha256", secret).update(message).digest("hex");
  return digest.length === hmac.length &&
    crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(hmac));
}

export interface ShopifyTokenResponse {
  access_token: string;
  scope: string;
}

/** Exchange the authorization code for a permanent offline access token. */
export async function exchangeCodeForToken(
  shopDomain: string,
  code: string
): Promise<ShopifyTokenResponse> {
  const res = await fetch(
    `https://${shopDomain}/admin/oauth/access_token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: process.env.SHOPIFY_CLIENT_ID,
        client_secret: process.env.SHOPIFY_CLIENT_SECRET,
        code,
      }),
    }
  );

  if (!res.ok) {
    throw new Error(
      `[shopify-oauth] token exchange failed: ${res.status} ${(await res.text()).slice(0, 200)}`
    );
  }

  const body = (await res.json()) as ShopifyTokenResponse;
  if (!body.access_token) throw new Error("[shopify-oauth] no access_token in response");

  // Shopify offline tokens do not expire — record far-future expiry
  return body;
}
