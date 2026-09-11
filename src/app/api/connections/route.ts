// src/app/api/connections/route.ts
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { activityLog, platformConnections } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { hasPaidPlan } from "@/lib/billing";

// Platforms we support — must match platformEnum in schema
const VALID_PLATFORMS = [
  "shopify","meta","google","tiktok","klaviyo",
] as const;
type ValidPlatform = (typeof VALID_PLATFORMS)[number];

const TRIAL_MAX_CONNECTIONS = 5;

const PLATFORM_DISPLAY_NAMES: Record<ValidPlatform, string> = {
  shopify:  "Shopify Orders",
  meta:     "Meta Ads",
  google:   "Google Ads",
  tiktok:   "TikTok Ads",
  klaviyo:  "Klaviyo Email",
};

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await db
    .select()
    .from(platformConnections)
    .where(eq(platformConnections.userId, user.id));

  return NextResponse.json({ connections: rows });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const platform = String(body.platform ?? body.provider ?? "").toLowerCase() as ValidPlatform;

  if (!VALID_PLATFORMS.includes(platform)) {
    return NextResponse.json({ error: "Unsupported platform." }, { status: 400 });
  }

  // Check for existing connection to this platform
  const existing = await db
    .select()
    .from(platformConnections)
    .where(eq(platformConnections.userId, user.id));

  if (existing.some((c) => c.platform === platform)) {
    return NextResponse.json(
      { error: "This platform is already connected." },
      { status: 409 }
    );
  }

  if (!hasPaidPlan(user.plan) && existing.length >= TRIAL_MAX_CONNECTIONS) {
    return NextResponse.json(
      { error: "Trial plan allows up to 5 connections. Upgrade to unlock more." },
      { status: 402 }
    );
  }

  const displayName = body.name
    ? String(body.name).trim().slice(0, 80)
    : PLATFORM_DISPLAY_NAMES[platform];

  const [conn] = await db
    .insert(platformConnections)
    .values({
      userId:      user.id,
      platform,
      displayName,
      status:      "active",          // ← was "connected", now matches enum
      lastSyncAt:  new Date(),
    })
    .returning();

  await db.insert(activityLog).values({
    userId: user.id,
    action: "connection.added",
    detail: `Connected ${conn!.displayName}`, // ← was conn.name
  });

  return NextResponse.json({ connection: conn }, { status: 201 });
}