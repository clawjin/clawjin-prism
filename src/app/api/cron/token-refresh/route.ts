// src/app/api/cron/token-refresh/route.ts
// Runs every 2 days (vercel.json — Hobby daily-cron cap). Meta long-lived
// tokens expire after ~60 days and CANNOT be silently refreshed server-side
// — the merchant must re-authorize.
// Strategy: flag connections expiring within 7 days, alert the user to
// reconnect. Shopify offline tokens never expire (no-op).

import { NextResponse } from "next/server";
import { eq, isNotNull, lte, and } from "drizzle-orm";
import { db } from "@/db";
import { alerts, platformConnections } from "@/db/schema";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";

export const maxDuration = 60;

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export async function POST(req: Request) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cutoff = new Date(Date.now() + SEVEN_DAYS_MS);

  const expiring = await db
    .select()
    .from(platformConnections)
    .where(
      and(
        eq(platformConnections.platform, "meta"),
        isNotNull(platformConnections.tokenExpiresAt),
        lte(platformConnections.tokenExpiresAt, cutoff)
      )
    );

  let flagged = 0;
  for (const conn of expiring) {
    await db.insert(alerts).values({
      userId: conn.userId,
      severity: "warning",
      title: "Meta connection expiring soon",
      message: `Your Meta Ads token for "${conn.displayName}" expires ${
        conn.tokenExpiresAt?.toISOString().slice(0, 10) ?? "soon"
      }. Reconnect before it lapses to keep ad data flowing.`,
    });
    flagged++;
  }

  return NextResponse.json({
    ok: true,
    checked: true,
    expiringConnections: flagged,
  });
}

export async function GET(req: Request) {
  return POST(req);
}
