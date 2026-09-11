// src/app/api/cron/incremental-sync/route.ts
// Runs every 2 days (vercel.json — Hobby daily-cron cap). Enqueues a 24h
// incremental sync for every active connection. Keeps dashboards fresh
// without user action (AGENTS.md "Ongoing Updates").

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  platformConnections,
  syncJobs,
} from "@/db/schema";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { enqueueJob } from "@/lib/queue";

export const maxDuration = 60;

function jobTypeFor(platform: string): "shopify-incremental-sync" | "meta-incremental-sync" | null {
  if (platform === "shopify") return "shopify-incremental-sync";
  if (platform === "meta") return "meta-incremental-sync";
  return null;
}

export async function POST(req: Request) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const active = await db
    .select()
    .from(platformConnections)
    .where(eq(platformConnections.status, "active"));

  let enqueued = 0;
  for (const conn of active) {
    const type = jobTypeFor(conn.platform);
    if (!type) continue;

    // Durable DB job record (survives redis TTL)
    const [jobRow] = await db
      .insert(syncJobs)
      .values({
        userId: conn.userId,
        connectionId: conn.id,
        type: "incremental",
        status: "pending",
        dateRangeStart: new Date(Date.now() - 86_400_000).toISOString().slice(0, 10),
        dateRangeEnd: new Date().toISOString().slice(0, 10),
      })
      .returning();

    await enqueueJob({
      type,
      userId: conn.userId,
      connectionId: conn.id,
      payload: { syncJobDbId: jobRow!.id },
    });
    enqueued++;
  }

  return NextResponse.json({ ok: true, connections: active.length, enqueued });
}

export async function GET(req: Request) {
  return POST(req);
}
