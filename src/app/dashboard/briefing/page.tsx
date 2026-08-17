import { desc, eq } from "drizzle-orm";
import { Send } from "lucide-react";
import { db } from "@/db";
import { activityLog, alerts } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { getOverview } from "@/lib/analytics";
import { formatCurrency, formatMultiplier, relativeTime } from "@/lib/format";
import { Card } from "@/components/ui";
import { DispatchButton } from "@/components/dashboard/dispatch-button";
import { AlertsPanel, type AlertItem } from "@/components/dashboard/alerts-panel";

export const dynamic = "force-dynamic";

export default async function BriefingPage() {
  const user = await requireUser();
  const { metrics } = await getOverview(user.id);

  const alertRows = await db
    .select()
    .from(alerts)
    .where(eq(alerts.userId, user.id))
    .orderBy(desc(alerts.createdAt));

  const activityRows = await db
    .select()
    .from(activityLog)
    .where(eq(activityLog.userId, user.id))
    .orderBy(desc(activityLog.createdAt))
    .limit(8);

  const alertItems: AlertItem[] = alertRows.map((a) => ({
    id: a.id,
    title: a.title,
    message: a.message,
    severity: a.severity as AlertItem["severity"],
    read: a.read,
    time: relativeTime(a.createdAt),
  }));

  const scorecard = [
    { label: "Revenue", value: formatCurrency(metrics.revenue, { compact: true }) },
    { label: "Blended ROAS", value: formatMultiplier(metrics.roas) },
    { label: "Blended CAC", value: formatCurrency(metrics.cac) },
    { label: "Contribution margin", value: formatCurrency(metrics.cm1, { compact: true }) },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          Executive briefing
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          Your automated 8:00 AM intelligence briefing, delivered to leadership.
        </p>
      </div>

      {/* Slack dispatch card */}
      <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#4A154B] text-white">
            <Send className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-medium text-white">Daily Slack briefing</p>
            <p className="text-xs text-zinc-400">
              Verified KPI scorecard dispatched to{" "}
              <span className="text-zinc-400">#exec-leadership</span> at 8:00 AM.
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-4">
            {scorecard.map((s) => (
              <div key={s.label}>
                <p className="text-[11px] uppercase tracking-wide text-zinc-400">
                  {s.label}
                </p>
                <p className="text-sm font-semibold tabular-nums text-white">{s.value}</p>
              </div>
            ))}
          </div>
          <div className="sm:text-right">
            <DispatchButton />
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="p-5 sm:p-6 xl:col-span-2">
          <AlertsPanel alerts={alertItems} />
        </Card>

        <Card className="p-5 sm:p-6">
          <h2 className="mb-4 text-base font-semibold text-white">Recent activity</h2>
          <div className="space-y-3">
            {activityRows.map((a) => (
              <div key={a.id} className="flex items-start gap-3">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-white" />
                <div className="min-w-0">
                  <p className="text-sm text-zinc-100">{a.detail || a.action}</p>
                  <p className="text-xs text-zinc-400">{relativeTime(a.createdAt)}</p>
                </div>
              </div>
            ))}
            {activityRows.length === 0 && (
              <p className="text-sm text-zinc-400">No activity yet.</p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
