// src/app/api/connections/[id]/sync/route.ts
// POST — start a historical sync for this connection.
//
// Body: { range: "7d" | "30d" | "90d" | "custom", from?: "YYYY-MM-DD", to?: ... }
// Creates a durable sync_jobs row + enqueues the worker job. Returns job id
// so the UI can poll /api/sync/status.

import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  activityLog,
  platformConnections,
  syncJobs,
} from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { enqueueJob, type JobType } from "@/lib/queue";
import { isValidDayKey } from "@/lib/dates";

const RANGE_DAYS: Record<string, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
};

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const connId = Number(id);
  if (!Number.isInteger(connId) || connId <= 0) {
    return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  }

  const [conn] = await db
    .select()
    .from(platformConnections)
    .where(
      and(
        eq(platformConnections.id, connId),
        eq(platformConnections.userId, user.id) // tenant isolation
      )
    )
    .limit(1);

  if (!conn) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  if (conn.status === "revoked") {
    return NextResponse.json({ error: "Connection is revoked." }, { status: 409 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const range = String(body.range ?? "30d");
  const today = new Date().toISOString().slice(0, 10);
  let dateFrom: string;
  let dateTo: string;

  if (range === "custom") {
    const from = body.from;
    const to = body.to ?? today;
    if (!isValidDayKey(from)) {
      return NextResponse.json(
        { error: 'Custom range requires valid "from" (YYYY-MM-DD).' },
        { status: 400 }
      );
    }
    // Guard: max 400 days back (API practicality + rate limits)
    const minAllowed = new Date(Date.now() - 400 * 86_400_000)
      .toISOString()
      .slice(0, 10);
    if ((from as string) < minAllowed || !isValidDayKey(to) || (to as string) > today || (to as string) < (from as string)) {
      return NextResponse.json(
        { error: `Range must be between ${minAllowed} and ${today}, from ≤ to.` },
        { status: 400 }
      );
    }
    dateFrom = from as string;
    dateTo = to as string;
  } else {
    const days = RANGE_DAYS[range];
    if (!days) {
      return NextResponse.json(
        { error: 'range must be one of "7d", "30d", "90d", "custom".' },
        { status: 400 }
      );
    }
    dateTo = today;
    dateFrom = new Date(Date.now() - days * 86_400_000)
      .toISOString()
      .slice(0, 10);
  }

  const type: JobType =
    conn.platform === "shopify"
      ? "shopify-historical-sync"
      : conn.platform === "meta"
      ? "meta-historical-sync"
      : "shopify-historical-sync"; // unreachable for current platforms

  // Durable record first — redis is only the transport
  const [jobRow] = await db
    .insert(syncJobs)
    .values({
      userId: user.id,
      connectionId: conn.id,
      type: conn.platform === "google" ? "incremental" : "historical",
      status: "pending",
      dateRangeStart: dateFrom,
      dateRangeEnd: dateTo,
    })
    .returning();

  const jobId = await enqueueJob({
    type,
    userId: user.id,
    connectionId: conn.id,
    payload: {
      dateFrom,
      dateTo,
      syncJobDbId: jobRow!.id,
    },
  });

  await db.insert(activityLog).values({
    userId: user.id,
    action: "sync.started",
    detail: `${conn.displayName}: ${dateFrom} → ${dateTo}`,
  });

  return NextResponse.json(
    {
      ok: true,
      jobId,
      syncJobId: jobRow!.id,
      range: { from: dateFrom, to: dateTo },
      note: "Sync queued. Progress available at /api/sync/status.",
    },
    { status: 202 }
  );
}
