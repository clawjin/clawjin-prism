// src/app/api/oauth/shopify/install/route.ts
// Step 1: redirect merchant to Shopify's consent screen.
// GET /api/oauth/shopify/install?shop=mystore.myshopify.com

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  buildInstallUrl,
  isValidShopDomain,
} from "@/modules/shopify/oauth";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const shop = (url.searchParams.get("shop") ?? "").toLowerCase().trim();

  if (!isValidShopDomain(shop)) {
    return NextResponse.json(
      { error: "Provide your shop domain, e.g. mystore.myshopify.com." },
      { status: 400 }
    );
  }

  if (!process.env.SHOPIFY_CLIENT_ID || !process.env.SHOPIFY_CLIENT_SECRET) {
    return NextResponse.json(
      { error: "Shopify app not configured on the server. Set SHOPIFY_CLIENT_ID/SECRET." },
      { status: 501 }
    );
  }

  const redirectUri = `${url.origin}/api/oauth/shopify/callback`;
  const authorizeUrl = await buildInstallUrl(user.id, shop, redirectUri);

  return NextResponse.redirect(authorizeUrl);
}
