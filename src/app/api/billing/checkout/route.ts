import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getPriceId, getStripe, isStripeConfigured, type PlanId } from "@/lib/billing";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const plan = String(body.plan ?? "pro") as PlanId;
  const interval = body.interval === "year" ? "year" : "month";
  if (plan !== "pro" && plan !== "enterprise") {
    return NextResponse.json({ error: "Unsupported plan." }, { status: 400 });
  }

  // Demo mode — no Stripe keys configured. Let the client simulate payment.
  if (!isStripeConfigured()) {
    return NextResponse.json({ demo: true });
  }

  const priceId = getPriceId(plan, interval);
  if (!priceId) {
    return NextResponse.json(
      { error: `No Stripe price configured for ${plan} (${interval}).` },
      { status: 400 },
    );
  }

  const origin =
    req.headers.get("origin") ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    "http://localhost:3000";

  try {
    const session = await getStripe().checkout.sessions.create({
      mode: "subscription",
      customer_email: user.email,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/dashboard/billing?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/dashboard/billing?canceled=true`,
      client_reference_id: String(user.id),
      metadata: { userId: String(user.id), plan },
      allow_promotion_codes: true,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Stripe checkout error", err);
    return NextResponse.json(
      { error: "Could not start checkout. Please try again." },
      { status: 500 },
    );
  }
}
