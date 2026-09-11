// src/app/api/billing/demo-upgrade/route.ts
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { activityLog, payments, users } from "@/db/schema";
import { getCurrentUser, toPublicUser } from "@/lib/auth";
import { isStripeConfigured, PLANS, type PlanId } from "@/lib/billing";
import { toCents } from "@/lib/money";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (isStripeConfigured()) {
    return NextResponse.json(
      { error: "Live billing is enabled. Use Stripe Checkout." },
      { status: 400 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 }
    );
  }

  // Map "pro" → "growth" for backward compatibility
  const rawPlan = String(body.plan ?? "growth");
  const planId  = (rawPlan === "pro" ? "growth" : rawPlan) as PlanId;

  if (!PLANS[planId] || planId === "trial") {
    return NextResponse.json({ error: "Unsupported plan." }, { status: 400 });
  }

  const monthlyUsd = PLANS[planId].monthlyUsd ?? 499;

  const [updated] = await db
    .update(users)
    .set({ plan: planId, updatedAt: new Date() })
    .where(eq(users.id, user.id))
    .returning();

  // Store amount in cents — never float
  await db.insert(payments).values({
    userId:     user.id,
    amountCents: toCents(monthlyUsd),   // ← was "amount", now "amountCents"
    currency:   "usd",
    status:     "demo",
    provider:   "stripe",
    providerId: `demo_${Date.now()}`,
  });

  await db.insert(activityLog).values({
    userId: user.id,
    action: "billing.upgrade",
    detail: `Upgraded to ${PLANS[planId].label} (demo)`,
  });

  return NextResponse.json({ user: toPublicUser(updated!), ok: true });
}