import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { alerts } from "@/db/schema";
import { ensureDemoWorkspace } from "@/lib/demo";
import { getCohorts, getCustomers, getInsights, getOverview } from "@/lib/analytics";
import { relativeTime } from "@/lib/format";
import { AuroraBackground } from "@/components/effects";
import { Logo } from "@/components/ui";
import { DemoTour } from "@/components/demo/demo-tour";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Live Demo — Clawjin Prism",
  description:
    "Explore the Clawjin Prism dashboard with a real, live dataset. See your blended CAC, ROAS, contribution margin, cohort retention and executive briefing before you buy.",
};

export default async function DemoPage() {
  const demoUserId = await ensureDemoWorkspace();

  const [overview, cohorts, customers, insights, alertRows] = await Promise.all([
    getOverview(demoUserId),
    getCohorts(demoUserId),
    getCustomers(demoUserId),
    getInsights(demoUserId),
    db
      .select()
      .from(alerts)
      .where(eq(alerts.userId, demoUserId))
      .orderBy(desc(alerts.createdAt))
      .limit(5),
  ]);

  const demoAlerts = alertRows.map((a) => ({
    title: a.title,
    message: a.message,
    severity: a.severity as "critical" | "warning" | "success" | "info",
    time: relativeTime(a.createdAt),
  }));

  return (
    <div className="relative min-h-screen overflow-hidden">
      <AuroraBackground />

      {/* Nav */}
      <header className="sticky top-0 z-50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="glass mt-4 flex h-16 items-center justify-between rounded-2xl px-5">
            <Logo />
            <div className="flex items-center gap-3">
              <Link
                href="/login"
                className="text-sm font-medium text-zinc-400 transition hover:text-white"
              >
                Sign in
              </Link>
              <Link
                href="/signup"
                className="btn-shine inline-flex items-center gap-1.5 rounded-xl bg-prism px-4 py-2 text-sm font-semibold text-black transition hover:opacity-90"
              >
                Start free <span className="hidden sm:inline">trial</span>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Intro */}
      <div className="mx-auto max-w-3xl px-4 pt-16 text-center sm:px-6">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-400">
          Interactive tour
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
          See your dashboard <span className="text-gradient-animated">before you buy</span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-zinc-400">
          This is a real, live workspace with sample data. Click through the six
          screens to see exactly what your unit economics would look like.
        </p>
      </div>

      <div className="px-4 py-12 sm:px-6 lg:px-8">
        <DemoTour
          metrics={overview.metrics}
          trend={overview.trend}
          channels={overview.channels}
          cohorts={cohorts}
          segments={customers.segments}
          insights={insights}
          alerts={demoAlerts}
        />
      </div>
    </div>
  );
}
