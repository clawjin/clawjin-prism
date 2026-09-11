// src/app/api/oauth/shopify/callback/route.ts
// Step 2: verify state + HMAC, exchange code, encrypt token, upsert
// connection, register webhooks, redirect back to dashboard.

import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  activityLog,
  platformConnections,
} from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { encryptToken } from "@/lib/encryption";
import {
  consumeStateToken,
  exchangeCodeForToken,
  verifyCallbackHmac,
} from "@/modules/shopify/oauth";

export async function GET(req: Request) {
  const url = new URL(req.url);

  // 1. Signature check FIRST (tamper-proof callback)
  if (!verifyCallbackHmac(url.searchParams)) {
    return NextResponse.redirect(`${url.origin}/dashboard/connections?error=bad_signature`);
  }

  // 2. CSRF: single-use state must match what we issued
  const state = url.searchParams.get("state");
  const bound = state ? await consumeStateToken(state) : null;
  if (!bound || bound.shopDomain === undefined) {
    return NextResponse.redirect(`${url.origin}/dashboard/connections?error=invalid_state`);
  }

  const code = url.searchParams.get("code");
  if (!code) {
    return NextResponse.redirect(`${url.origin}/dashboard/connections?error=missing_code`);
  }

  try {
    // 3. Exchange code → permanent access token
    const token = await exchangeCodeForToken(bound.shopDomain, code);
    const encrypted = encryptToken(token.access_token);
    if (!encrypted) throw new Error("token encryption failed");

    // 4. Upsert connection (multi-connection: one row per shop)
    const [existing] = await db
      .select()
      .from(platformConnections)
      .where(
        and(
          eq(platformConnections.userId, bound.userId),
          eq(platformConnections.platform, "shopify"),
          eq(platformConnections.shopDomain, bound.shopDomain)
        )
      )
      .limit(1);

    let connectionId: number;
    if (existing) {
      await db
        .update(platformConnections)
        .set({
          status: "active",
          accessTokenEncrypted: encrypted,
          scopes: token.scope?.split(",").filter(Boolean) ?? [],
          errorMessage: null,
          updatedAt: new Date(),
        })
        .where(eq(platformConnections.id, existing.id));
      connectionId = existing.id;
    } else {
      const [created] = await db
        .insert(platformConnections)
        .values({
          userId: bound.userId,
          platform: "shopify",
          status: "active",
          displayName: bound.shopDomain,
          externalAccountId: bound.shopDomain,
          shopDomain: bound.shopDomain,
          accessTokenEncrypted: encrypted,
          scopes: token.scope?.split(",").filter(Boolean) ?? [],
        })
        .returning();
      connectionId = created!.id;
    }

    await db.insert(activityLog).values({
      userId: bound.userId,
      action: "connection.shopify.linked",
      detail: `Connected ${bound.shopDomain}`,
    });

    // 5. Register webhook subscriptions so real-time updates flow in.
    //    Best-effort: polling sync still works without them.
    const appUrl =
      process.env.APP_URL ?? process.env.SITE_URL ?? url.origin;
    fetch(`https://${bound.shopDomain}/admin/api/2024-10/webhooks.json`, {
      method: "POST",
      headers: {
        "X-Shopify-Access-Token": token.access_token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        webhook: { topic: "orders/create", address: `${appUrl}/api/webhooks/shopify` },
      }),
    }).catch(() => {});

    return NextResponse.redirect(
      `${url.origin}/dashboard/connections?connected=shopify&id=${connectionId}`
    );
  } catch (err) {
    console.error("[oauth:shopify] callback failed:", err);
    return NextResponse.redirect(
      `${url.origin}/dashboard/connections?error=oauth_failed`
    );
  }
}
