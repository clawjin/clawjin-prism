import { eq } from "drizzle-orm";
import { db } from "@/db";
import { customers, orders } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { hasPaidPlan } from "@/lib/billing";
import { computeSegment, SEGMENT_LABELS } from "@/lib/segments";

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
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  if (!hasPaidPlan(user.plan)) {
    return Response.json(
      { error: "Report export is a Pro feature. Upgrade to continue." },
      { status: 402 },
    );
  }

  const type = new URL(req.url).searchParams.get("type") ?? "customers";
  let csv = "";
  let filename = "clawjin-prism-export.csv";

  if (type === "orders") {
    const rows = await db
      .select()
      .from(orders)
      .where(eq(orders.userId, user.id))
      .orderBy(orders.createdAt);
    csv = [
      rowToCsv(["order_number", "channel", "status", "revenue", "cogs", "shipping", "created_at"]),
      ...rows.map((r) =>
        rowToCsv([r.orderNumber, r.channel, r.status, r.revenue, r.cogs, r.shipping, r.createdAt.toISOString()]),
      ),
    ].join("\n");
    filename = `clawjin-prism-orders-${Date.now()}.csv`;
  } else {
    const rows = await db
      .select()
      .from(customers)
      .where(eq(customers.userId, user.id));
    const now = Date.now();
    csv = [
      rowToCsv(["name", "email", "segment", "orders", "ltv", "first_order_at", "last_order_at"]),
      ...rows.map((c) => {
        const recencyDays = Math.round((now - c.lastOrderAt.getTime()) / DAY_MS);
        const segment = computeSegment({
          orderCount: c.orderCount,
          totalSpend: c.totalSpend,
          recencyDays,
        });
        return rowToCsv([
          c.name,
          c.email,
          SEGMENT_LABELS[segment],
          c.orderCount,
          c.totalSpend,
          c.firstOrderAt.toISOString(),
          c.lastOrderAt.toISOString(),
        ]);
      }),
    ].join("\n");
    filename = `clawjin-prism-customers-${Date.now()}.csv`;
  }

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
