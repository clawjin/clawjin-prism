// src/app/api/cron/aggregation/route.ts
// Runs every 2 days (vercel.json — Hobby daily-cron cap). Recomputes daily
// metrics for every tenant with data, covering today + yesterday (webhook
// freshness window), then refreshes RFM segments.

import { NextResponse } from "next/server";
import { db } from "@/db";
import { normalizedOrders } from "@/db/schema";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { aggregateUserDay, refreshSegments } from "@/lib/aggregation";

export const maxDuration = 300;

export async function POST(req: Request) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);

  // Distinct tenants that have any order data (bounded query via index)
  const usersRes = await db
    .selectDistinct({ userId: normalizedOrders.userId })
    .from(normalizedOrders);

  let processedUsers = 0;
  for (const { userId } of usersRes) {
    try {
      await aggregateUserDay(userId, today);
      await aggregateUserDay(userId, yesterday);
      await refreshSegments(userId);
      processedUsers++;
    } catch (err) {
      console.error(`[cron:aggregation] user ${userId} failed:`, err);
    }
  }

  return NextResponse.json({
    ok: true,
    users: processedUsers,
    days: [yesterday, today],
  });
}

export async function GET(req: Request) {
  return POST(req);
}
