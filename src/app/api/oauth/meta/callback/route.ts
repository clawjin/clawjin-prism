// src/app/api/oauth/meta/callback/route.ts
// Step 2: verify state, exchange code → long-lived token, list ad accounts,
// auto-select first active account (multi-account selection via ?accountId=),
// encrypt + store connection.

import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { activityLog, platformConnections } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { consumeStateToken, exchangeCodeForToken, listAdAccounts } from "@/modules/meta/oauth";
import { encryptToken } from "@/lib/encryption";

export async function GET(req: Request) {
  const url = new URL(req.url);

  // 1. CSRF state check
  const state = url.searchParams.get("state");
  const bound = state ? await consumeStateToken(state) : null;
  if (!bound) {
    return NextResponse.redirect(`${url.origin}/dashboard/connections?error=invalid_state`);
  }
  // State binds to the initiating user — callback must be same session
  const user = await getCurrentUser();
  if (!user || user.id !== bound.userId) {
    return NextResponse.redirect(`${url.origin}/dashboard/connections?error=session_mismatch`);
  }

  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error_description");
  if (error || !code) {
    console.warn("[oauth:meta] user denied:", error);
    return NextResponse.redirect(`${url.origin}/dashboard/connections?error=denied`);
  }

  try {
    // 2. Code → long-lived token (~60 days)
    const { accessToken, expiresIn } = await exchangeCodeForToken(
      code,
      `${url.origin}/api/oauth/meta/callback`
    );

    // 3. Account discovery
    const accounts = await listAdAccounts(accessToken);
    if (accounts.length === 0) {
      return NextResponse.redirect(
        `${url.origin}/dashboard/connections?error=no_ad_accounts`
      );
    }

    const requestedId = url.searchParams.get("accountId");
    const account =
      accounts.find((a) => a.id === requestedId?.replace(/^act_/, "")) ??
      accounts[0]!;

    const encrypted = encryptToken(accessToken);
    if (!encrypted) throw new Error("token encryption failed");

    // 4. Upsert connection keyed on ad account (multi-connection support)
    const accountId = `act_${account.id.replace(/^act_/, "")}`;
    const [existing] = await db
      .select()
      .from(platformConnections)
      .where(
        and(
          eq(platformConnections.userId, bound.userId),
          eq(platformConnections.platform, "meta"),
          eq(platformConnections.externalAccountId, accountId)
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
          tokenExpiresAt: expiresIn
            ? new Date(Date.now() + expiresIn * 1000)
            : null,
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
          platform: "meta",
          status: "active",
          displayName: `Meta Ads — ${account.name}`,
          externalAccountId: accountId,
          accessTokenEncrypted: encrypted,
          tokenExpiresAt: expiresIn
            ? new Date(Date.now() + expiresIn * 1000)
            : null,
          scopes: ["ads_read", "read_insights"],
        })
        .returning();
      connectionId = created!.id;
    }

    await db.insert(activityLog).values({
      userId: bound.userId,
      action: "connection.meta.linked",
      detail: `Connected ${account.name} (${accountId})`,
    });

    return NextResponse.redirect(
      `${url.origin}/dashboard/connections?connected=meta&id=${connectionId}`
    );
  } catch (err) {
    console.error("[oauth:meta] callback failed:", err);
    return NextResponse.redirect(`${url.origin}/dashboard/connections?error=oauth_failed`);
  }
}
