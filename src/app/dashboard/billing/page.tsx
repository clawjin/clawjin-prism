import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { payments } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { isStripeConfigured } from "@/lib/billing";
import { formatDate } from "@/lib/format";
import {
  BillingPanel,
  type PaymentRow,
} from "@/components/dashboard/billing-panel";

export const dynamic = "force-dynamic";

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string; canceled?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const justPaid = Boolean(params.session_id);

  const rows = await db
    .select()
    .from(payments)
    .where(eq(payments.userId, user.id))
    .orderBy(desc(payments.createdAt))
    .limit(25);

  const paymentItems: PaymentRow[] = rows.map((p) => ({
    id: p.id,
    amount: p.amount,
    currency: p.currency,
    status: p.status,
    provider: p.provider,
    time: formatDate(p.createdAt),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          Billing
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          Manage your plan and payment method. Prices in USD.
        </p>
      </div>

      {justPaid && (
        <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">
          🎉 Payment confirmed — your Pro plan is now active. Thank you!
        </div>
      )}

      <BillingPanel
        user={{ plan: user.plan, email: user.email }}
        payments={paymentItems}
        stripeConfigured={isStripeConfigured()}
        hasCustomer={Boolean(user.stripeCustomerId)}
        celebrateInitial={justPaid}
      />
    </div>
  );
}
