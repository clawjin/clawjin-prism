// src/app/api/cron/cleanup/route.ts
// Runs weekly (vercel.json: "0 4 * * 0"). Bounds unbounded Redis keys:
// recovered stale worker claims, caps per-user job history + DLQ.

import { NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { cleanupRedisKeys } from "@/lib/cleanup";

export const maxDuration = 60;

export async function POST(req: Request) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const summary = await cleanupRedisKeys();
  return NextResponse.json({ ok: true, ...summary });
}

export async function GET(req: Request) {
  return POST(req);
}