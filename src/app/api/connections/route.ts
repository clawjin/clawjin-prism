import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { activityLog, connections } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { hasPaidPlan } from "@/lib/billing";

const PROVIDERS = ["shopify", "meta", "google", "tiktok", "klaviyo", "amazon", "stripe"];
const TRIAL_MAX_CONNECTIONS = 5;
const PROVIDER_NAMES: Record<string, string> = {
  shopify: "Shopify Orders",
  meta: "Meta Ads",
  google: "Google Ads",
  tiktok: "TikTok Ads",
  klaviyo: "Klaviyo Email",
  amazon: "Amazon Marketplace",
  stripe: "Stripe Payments",
};

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db
    .select()
    .from(connections)
    .where(eq(connections.userId, user.id));
  return NextResponse.json({ connections: rows });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const provider = String(body.provider ?? "").toLowerCase();
  if (!PROVIDERS.includes(provider)) {
    return NextResponse.json({ error: "Unsupported provider." }, { status: 400 });
  }

  const existing = await db
    .select()
    .from(connections)
    .where(eq(connections.userId, user.id));
  if (existing.some((c) => c.provider === provider)) {
    return NextResponse.json({ error: "This source is already connected." }, { status: 409 });
  }

  if (!hasPaidPlan(user.plan) && existing.length >= TRIAL_MAX_CONNECTIONS) {
    return NextResponse.json(
      { error: "Trial plan allows up to 5 data sources. Upgrade to Pro for unlimited." },
      { status: 402 },
    );
  }

  const [conn] = await db
    .insert(connections)
    .values({
      userId: user.id,
      provider,
      name: body.name
        ? String(body.name).trim().slice(0, 80)
        : (PROVIDER_NAMES[provider] ?? provider),
      status: "connected",
      lastSyncAt: new Date(),
    })
    .returning();

  await db.insert(activityLog).values({
    userId: user.id,
    action: "connection.added",
    detail: `Connected ${conn.name}`,
  });

  return NextResponse.json({ connection: conn }, { status: 201 });
}
