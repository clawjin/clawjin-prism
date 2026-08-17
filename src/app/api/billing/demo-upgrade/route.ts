import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { activityLog, payments, users } from "@/db/schema";
import { getCurrentUser, toPublicUser } from "@/lib/auth";
import { isStripeConfigured, PLANS, type PlanId } from "@/lib/billing";

// Simulated payment for local / no-Stripe environments. Only available when
// Stripe is NOT configured — so real deployments never bypass real billing.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (isStripeConfigured()) {
    return NextResponse.json(
      { error: "Live billing is enabled. Use Stripe Checkout." },
      { status: 400 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const plan = String(body.plan ?? "pro") as PlanId;
  if (!PLANS[plan] || plan === "trial") {
    return NextResponse.json({ error: "Unsupported plan." }, { status: 400 });
  }

  const amount = PLANS[plan].monthlyUsd ?? (plan === "enterprise" ? 2000 : 499);

  const [updated] = await db
    .update(users)
    .set({ plan })
    .where(eq(users.id, user.id))
    .returning();

  await db.insert(payments).values({
    userId: user.id,
    amount,
    currency: "usd",
    status: "demo",
    provider: "stripe",
    providerId: `demo_${Date.now()}`,
  });

  await db.insert(activityLog).values({
    userId: user.id,
    action: "billing.upgrade",
    detail: `Upgraded to ${PLANS[plan].label} (demo)`,
  });

  return NextResponse.json({ user: toPublicUser(updated), ok: true });
}
