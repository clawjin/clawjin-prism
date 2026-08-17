import { Sparkles } from "lucide-react";
import type { Insight } from "@/lib/analytics";

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

const TONE_STYLE: Record<Insight["tone"], { dot: string; ring: string }> = {
  positive: { dot: "bg-emerald-400", ring: "border-emerald-400/30" },
  negative: { dot: "bg-rose-400", ring: "border-rose-400/30" },
  neutral: { dot: "bg-zinc-400", ring: "border-white/10" },
};

export function TodayTakeaway({
  name,
  insights,
}: {
  name: string;
  insights: Insight[];
}) {
  const first = name.split(" ")[0] || "there";
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="glass-strong gradient-border relative overflow-hidden rounded-3xl p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{today}</p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight text-white sm:text-2xl">
            {greeting()}, {first} <span className="inline-block">👋</span>
          </h2>
        </div>
        <div className="flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-sm font-semibold text-white ring-1 ring-inset ring-white/15">
          <Sparkles className="h-4 w-4" />
          Today&apos;s takeaway
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
        {insights.map((ins, i) => {
          const tone = TONE_STYLE[ins.tone];
          return (
            <div
              key={i}
              className={`flex items-start gap-3 rounded-2xl border bg-white/[0.03] p-4 ${tone.ring}`}
            >
              <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${tone.dot}`} />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white">{ins.title}</p>
                <p className="mt-0.5 text-sm leading-relaxed text-zinc-400">{ins.body}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
