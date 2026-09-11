// src/app/api/stripe/webhook/route.ts
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import type Stripe from "stripe";
import { db } from "@/db";
import { activityLog, payments, users } from "@/db/schema";
import { getStripe } from "@/lib/billing";
import { toCents } from "@/lib/money";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json(
      { error: "Webhook not configured." },
      { status: 400 }
    );
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json(
      { error: "Missing signature." },
      { status: 400 }
    );
  }

  const payload = await req.text();

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(
      payload,
      signature,
      webhookSecret
    );
  } catch (err) {
    console.error("Stripe webhook signature verification failed", err);
    return NextResponse.json(
      { error: "Invalid signature." },
      { status: 400 }
    );
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId  = Number(
          session.metadata?.userId ?? session.client_reference_id
        );

        // Map old "pro" plan to "growth"
        const rawPlan = (session.metadata?.plan ?? "growth") as string;
        const plan    = rawPlan === "pro" ? "growth" : rawPlan;

        if (Number.isInteger(userId) && userId > 0) {
          const patch: Record<string, unknown> = {
            plan,
            updatedAt: new Date(),
          };
          if (session.customer) {
            patch.stripeCustomerId = String(session.customer);
          }
          if (session.subscription) {
            patch.stripeSubscriptionId = String(session.subscription);
          }

          await db.update(users).set(patch).where(eq(users.id, userId));

          // amount_total is already in cents from Stripe
          // Stripe sends 4990 for $49.90 — use directly, no conversion needed
          const amountCents = session.amount_total ?? 4900;

          await db.insert(payments).values({
            userId,
            amountCents,                          // ← was "amount: amount/100"
            currency:   session.currency ?? "usd",
            status:     session.payment_status ?? "paid",
            provider:   "stripe",
            providerId: session.id,
          });

          await db.insert(activityLog).values({
            userId,
            action: "billing.upgrade",
            detail: `Upgraded to ${plan} via Stripe`,
          });
        }
        break;
      }

      case "customer.subscription.deleted": {
        const sub        = event.data.object as Stripe.Subscription;
        const customerId = String(sub.customer);

        const [owner] = await db
          .select()
          .from(users)
          .where(eq(users.stripeCustomerId, customerId))
          .limit(1);

        if (owner) {
          await db
            .update(users)
            .set({
              plan:                   "trial",
              stripeSubscriptionId:   null,
              updatedAt:              new Date(),
            })
            .where(eq(users.id, owner.id));

          await db.insert(activityLog).values({
            userId: owner.id,
            action: "billing.canceled",
            detail: "Subscription canceled — downgraded to Trial",
          });
        }
        break;
      }

      default:
        break;
    }
  } catch (err) {
    console.error("Stripe webhook handler error", err);
    return NextResponse.json({ error: "Handler error." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}