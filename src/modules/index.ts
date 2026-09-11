// src/modules/index.ts
// Connector factory — the ONLY place mock/real selection happens.
//
// USE_REAL_API=true  → real Shopify/Meta API clients (needs credentials)
// USE_REAL_API=false → deterministic mocks (default; full pipeline testable
//                      without any platform credentials)
//
// Per-connection override: if a connection has real encrypted tokens AND
// credentials are configured, real clients are used for it regardless of the
// global flag — production connections never silently fall back to mocks.

import type { PlatformClient } from "@/modules/types";
import * as shopifyMock from "@/modules/shopify/mock";
import * as shopifyReal from "@/modules/shopify/client";
import * as metaMock from "@/modules/meta/mock";
import * as metaReal from "@/modules/meta/client";
import { isShopifyConfigured } from "@/modules/shopify/oauth";
import { isMetaConfigured } from "@/modules/meta/oauth";

export function shouldUseRealApi(platform: "shopify" | "meta"): boolean {
  if (process.env.USE_REAL_API !== "true") return false;
  return platform === "shopify"
    ? isShopifyConfigured()
    : isMetaConfigured();
}

export function getClient(
  platform: "shopify" | "meta",
  hasRealTokens: boolean
): PlatformClient {
  const realReady = shouldUseRealApi(platform);
  const preferReal = process.env.USE_REAL_API === "true" && hasRealTokens;

  if ((realReady || preferReal) && platform === "shopify") {
    if (!isShopifyConfigured() && preferReal) {
      throw new Error(
        "[modules] Connection has tokens but SHOPIFY_CLIENT_ID/SECRET are not configured."
      );
    }
    return shopifyReal as unknown as PlatformClient;
  }
  if ((realReady || preferReal) && platform === "meta") {
    if (!isMetaConfigured() && preferReal) {
      throw new Error(
        "[modules] Connection has tokens but META_APP_ID/SECRET are not configured."
      );
    }
    return metaReal as unknown as PlatformClient;
  }

  console.log(`[modules] Using MOCK ${platform} connector`);
  return (platform === "shopify" ? shopifyMock : metaMock) as unknown as PlatformClient;
}
