// src/modules/meta/oauth.ts
// Meta (Facebook) OAuth flow for Marketing API access.
//
// Security mirrors Shopify module:
// → Single-use state token in Redis, 10-min TTL
// → Code exchanged server-side (client secret never leaves the server)
// → Long-lived token exchange (~60 day validity), encrypted at rest

import crypto from "node:crypto";
import { redis } from "@/lib/redis";

const GRAPH_VERSION = "v21.0";
export const META_SCOPES = ["ads_read", "read_insights"];
const STATE_TTL_SECONDS = 600;

const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`;

export function isMetaConfigured(): boolean {
  return !!(process.env.META_APP_ID && process.env.META_APP_SECRET);
}

/** Build the OAuth consent URL and persist the single-use state token. */
export async function buildInstallUrl(
  userId: number,
  redirectUri: string,
  nonce?: string
): Promise<string> {
  const state = crypto.randomBytes(24).toString("hex");

  if (redis.isConfigured()) {
    await redis.set(
      `oauth:state:${state}`,
      JSON.stringify({ userId, nonce, createdAt: Date.now() }),
      STATE_TTL_SECONDS
    );
  }

  const params = new URLSearchParams({
    client_id: process.env.META_APP_ID ?? "",
    redirect_uri: redirectUri,
    state,
    response_type: "code",
    scope: META_SCOPES.join(","),
  });

  return `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth?${params}`;
}

/** Verify + consume a state token. Null = expired/replayed/invalid. */
export async function consumeStateToken(
  state: string
): Promise<{ userId: number; nonce?: string } | null> {
  if (!redis.isConfigured()) return null;

  const key = `oauth:state:${state}`;
  const raw = await redis.get(key);
  if (!raw) return null;

  await redis.del(key);

  try {
    const parsed = JSON.parse(raw) as { userId: number; nonce?: string };
    return parsed.userId ? parsed : null;
  } catch {
    return null;
  }
}

interface TokenJson {
  access_token?: string;
  expires_in?: number;
  error?: { message?: string };
}

async function tokenRequest(params: URLSearchParams): Promise<TokenJson> {
  const res = await fetch(`${GRAPH}/oauth/access_token?${params}`);
  const body = (await res.json()) as TokenJson;
  if (!res.ok || body.error || !body.access_token) {
    throw new Error(
      `[meta-oauth] token request failed: ${body.error?.message ?? res.status}`
    );
  }
  return body;
}

/** Exchange authorization code → short-lived token → long-lived token. */
export async function exchangeCodeForToken(
  code: string,
  redirectUri: string
): Promise<{ accessToken: string; expiresIn: number | null }> {
  const shortParams = new URLSearchParams({
    client_id: process.env.META_APP_ID ?? "",
    client_secret: process.env.META_APP_SECRET ?? "",
    redirect_uri: redirectUri,
    code,
  });
  const short = await tokenRequest(shortParams);

  // Upgrade to long-lived (~60 days)
  const longParams = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: process.env.META_APP_ID ?? "",
    client_secret: process.env.META_APP_SECRET ?? "",
    fb_exchange_token: short.access_token!,
  });
  const long = await tokenRequest(longParams);

  return {
    accessToken: long.access_token!,
    expiresIn: long.expires_in ?? null,
  };
}

// ── Ad account discovery ─────────────────────────────────────────────────────

export interface MetaAdAccount {
  id: string; // "act_123456789"
  name: string;
  currency: string;
  accountStatus: number; // 1 = active
}

/** List ad accounts the granted user can access (for account selection UI). */
export async function listAdAccounts(
  accessToken: string
): Promise<MetaAdAccount[]> {
  const params = new URLSearchParams({
    fields: "id,name,currency,account_status",
    limit: "100",
    access_token: accessToken,
  });

  const out: MetaAdAccount[] = [];
  let url: string | null = `${GRAPH}/me/adaccounts?${params}`;

  while (url) {
    const res = await fetch(url);
    const body = (await res.json()) as {
      data?: Array<{
        id: string;
        name: string;
        currency: string;
        account_status: number;
      }>;
      paging?: { next?: string };
      error?: { message?: string };
    };

    if (!res.ok || body.error) {
      throw new Error(`[meta-oauth] adaccounts failed: ${body.error?.message ?? res.status}`);
    }

    for (const a of body.data ?? []) {
      out.push({
        id: a.id,
        name: a.name,
        currency: a.currency,
        accountStatus: a.account_status,
      });
    }
    url = body.paging?.next ?? null;
  }

  return out.filter((a) => a.accountStatus === 1);
}
