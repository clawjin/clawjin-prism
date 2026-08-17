import type { ReactNode } from "react";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { ArrowRight, Sparkles } from "lucide-react";
import { db } from "@/db";
import { alerts } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { trialDaysLeft } from "@/lib/billing";
import { AuroraBackground } from "@/components/effects";
import { Sidebar } from "@/components/dashboard/sidebar";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await requireUser();

  const unread = await db
    .select()
    .from(alerts)
    .where(eq(alerts.userId, user.id));

  const daysLeft = trialDaysLeft(user);

  return (
    <div className="min-h-screen">
      <AuroraBackground subtle />
      <Sidebar
        user={{
          name: user.name,
          companyName: user.companyName,
          plan: user.plan,
          email: user.email,
        }}
        unread={unread.filter((a) => !a.read).length}
      />
      <main className="lg:pl-64">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {user.plan === "trial" && (
            <div className="gradient-border mb-6 rounded-2xl">
              <div className="glass-strong flex flex-col gap-3 rounded-2xl p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white ring-1 ring-inset ring-white/15">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <p className="text-sm text-zinc-300">
                    <span className="font-semibold text-white">
                      {daysLeft > 0 ? `${daysLeft} day${daysLeft === 1 ? "" : "s"} left` : "Trial expired"}
                    </span>{" "}
                    on your free trial. Upgrade to Pro for unlimited sources and
                    report exports.
                  </p>
                </div>
                <Link
                  href="/dashboard/billing"
                  className="btn-shine inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-prism px-4 py-2 text-sm font-semibold text-black transition hover:opacity-90"
                >
                  Upgrade to Pro <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          )}
          {children}
        </div>
      </main>
    </div>
  );
}
