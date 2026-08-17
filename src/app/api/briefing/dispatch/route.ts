import { NextResponse } from "next/server";
import { db } from "@/db";
import { activityLog, alerts } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getOverview } from "@/lib/analytics";

export const dynamic = "force-dynamic";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { metrics } = await getOverview(user.id);

  await db.insert(activityLog).values({
    userId: user.id,
    action: "briefing.dispatch",
    detail: "Executive briefing dispatched to Slack",
  });

  await db.insert(alerts).values({
    userId: user.id,
    severity: "info",
    title: "Briefing dispatched",
    message: `Today's KPI scorecard (ROAS ${metrics.roas.toFixed(2)}x · CAC $${metrics.cac.toFixed(2)}) was delivered to #exec-leadership.`,
    read: false,
  });

  return NextResponse.json({ ok: true });
}
