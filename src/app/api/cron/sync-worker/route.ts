// src/app/api/cron/sync-worker/route.ts
// Runs every 2 days (vercel.json — Vercel Hobby caps cron at once per day).
// Drains queues by priority: webhooks first, then syncs, then aggregations.
// Max runtime bounded.

import { NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { processJobs } from "@/lib/worker";

export const maxDuration = 60;

export async function POST(req: Request) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const summary = await processJobs(25_000);
  return NextResponse.json({ ok: true, ...summary });
}

// GET convenience for manual browser/CLI triggers with ?key=
export async function GET(req: Request) {
  return POST(req);
}
