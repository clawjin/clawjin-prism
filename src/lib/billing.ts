import Stripe from "stripe";

// ---------------------------------------------------------------------------
// Clawjin Prism — billing & plan helpers
// Works with Stripe when STRIPE_SECRET_KEY is configured, and falls back to a
// "demo" mode (simulated payment) so the full flow works with $0 setup.
// ---------------------------------------------------------------------------

export type PlanId = "trial" | "pro" | "enterprise";

export const PLANS: Record<
  PlanId,
  { label: string; level: number; monthlyUsd?: number; annualUsd?: number }
> = {
  trial: { label: "Trial", level: 0 },
  pro: { label: "Pro", level: 1, monthlyUsd: 499, annualUsd: 4990 },
  enterprise: { label: "Enterprise", level: 2 },
};

export function planLevel(plan: string): number {
  return PLANS[plan as PlanId]?.level ?? 0;
}

export function hasPaidPlan(plan: string): boolean {
  return plan === "pro" || plan === "enterprise";
}

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Stripe is not configured (STRIPE_SECRET_KEY).");
  if (!_stripe) _stripe = new Stripe(key);
  return _stripe;
}

export function getPriceId(plan: PlanId, interval: "month" | "year"): string | undefined {
  if (plan === "pro") {
    return interval === "month"
      ? process.env.STRIPE_PRO_MONTHLY_PRICE_ID
      : process.env.STRIPE_PRO_ANNUAL_PRICE_ID;
  }
  if (plan === "enterprise") return process.env.STRIPE_ENTERPRISE_PRICE_ID;
  return undefined;
}

export function trialDaysLeft(user: {
  plan: string;
  trialEndsAt: Date | null;
}): number {
  if (user.plan !== "trial" || !user.trialEndsAt) return 0;
  const days = Math.ceil((user.trialEndsAt.getTime() - Date.now()) / 86_400_000);
  return Math.max(0, days);
}

export function trialExpired(user: {
  plan: string;
  trialEndsAt: Date | null;
}): boolean {
  return (
    user.plan === "trial" &&
    Boolean(user.trialEndsAt) &&
    user.trialEndsAt!.getTime() < Date.now()
  );
}
