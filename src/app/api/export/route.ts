// src/app/api/export/route.ts
// Clawjin Prism — CSV Export API
// Exports orders and customer data for paid plan users

import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { normalizedCustomers, normalizedOrders } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { hasPaidPlan } from "@/lib/billing";
import { computeSegment, SEGMENT_LABELS } from "@/lib/segments";
import { centsToDisplay } from "@/lib/money";

const DAY_MS = 86_400_000;

function csvCell(v: unknown): string {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function rowToCsv(cols: unknown[]): string {
  return cols.map(csvCell).join(",");
}

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasPaidPlan(user.plan)) {
    return Response.json(
      { error: "Report export is a Clawjin Prism Pro feature. Upgrade to continue." },
      { status: 402 }
    );
  }

  const type     = new URL(req.url).searchParams.get("type") ?? "customers";
  let csv        = "";
  let filename   = "clawjin-prism-export.csv";

  if (type === "orders") {
    const rows = await db
      .select()
      .from(normalizedOrders)
      .where(eq(normalizedOrders.userId, user.id))
      .orderBy(desc(normalizedOrders.orderedAt));

    csv = [
      rowToCsv([
        "order_number",
        "platform",           // ← was "channel" (old schema)
        "attribution_source", // ← new field showing where customer came from
        "status",
        "revenue_usd",        // ← was "revenue" float, now converted from cents
        "shipping_usd",       // ← was "shipping" float
        "tax_usd",
        "total_usd",
        "ordered_at",         // ← was "created_at"
      ]),
      ...rows.map((r) =>
        rowToCsv([
          r.orderNumber ?? r.externalOrderId,
          r.platform,
          r.attributionSource,
          r.status,
          centsToDisplay(r.netRevenueCents),   // ← was r.revenue (float)
          centsToDisplay(r.shippingCents),      // ← was r.shipping (float)
          centsToDisplay(r.taxCents),
          centsToDisplay(r.totalCents),
          r.orderedAt.toISOString(),            // ← was r.createdAt
        ])
      ),
    ].join("\n");

    filename = `clawjin-prism-orders-${Date.now()}.csv`;

  } else {
    // Customer export
    const rows = await db
      .select()
      .from(normalizedCustomers)
      .where(eq(normalizedCustomers.userId, user.id));

    const now = Date.now();

    csv = [
      rowToCsv([
        "name",
        "email",
        "segment",
        "acquisition_source",  // ← new field
        "order_count",
        "ltv_usd",             // ← was totalSpend float, now from cents
        "first_order_at",
        "last_order_at",
      ]),
      ...rows
        .filter((c) => c.lastOrderAt && c.firstOrderAt) // skip incomplete rows
        .map((c) => {
          const recencyDays = Math.round(
            (now - c.lastOrderAt!.getTime()) / DAY_MS
          );
          const segment = computeSegment({
            orderCount:  c.orderCount,
            totalSpend:  centsToDisplay(c.totalSpentCents), // segments uses dollars
            recencyDays,
          });

          return rowToCsv([
            c.name,
            c.email ?? "***",                              // privacy: show *** if no email
            SEGMENT_LABELS[segment],
            c.acquisitionSource,
            c.orderCount,
            centsToDisplay(c.totalSpentCents),             // ← was c.totalSpend (float)
            c.firstOrderAt!.toISOString(),                 // ← safe after filter above
            c.lastOrderAt!.toISOString(),
          ]);
        }),
    ].join("\n");

    filename = `clawjin-prism-customers-${Date.now()}.csv`;
  }

  return new Response(csv, {
    headers: {
      "Content-Type":        "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}