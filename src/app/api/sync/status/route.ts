// src/app/api/sync/status/route.ts
// GET — recent sync jobs for the signed-in user (durable DB records).

import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { platformConnections, syncJobs } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await db
    .select({
      id: syncJobs.id,
      connection: platformConnections.displayName,
      platform: platformConnections.platform,
      type: syncJobs.type,
      status: syncJobs.status,
      dateRangeStart: syncJobs.dateRangeStart,
      dateRangeEnd: syncJobs.dateRangeEnd,
      recordsProcessed: syncJobs.recordsProcessed,
      recordsTotal: syncJobs.recordsTotal,
      attemptCount: syncJobs.attemptCount,
      errorMessage: syncJobs.errorMessage,
      startedAt: syncJobs.startedAt,
      completedAt: syncJobs.completedAt,
      createdAt: syncJobs.createdAt,
    })
    .from(syncJobs)
    .innerJoin(
      platformConnections,
      eq(syncJobs.connectionId, platformConnections.id)
    )
    .where(eq(syncJobs.userId, user.id))
    .orderBy(desc(syncJobs.createdAt))
    .limit(20);

  return NextResponse.json({ jobs: rows });
}
