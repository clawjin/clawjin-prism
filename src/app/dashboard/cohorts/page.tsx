import { requireUser } from "@/lib/auth";
import { getCohorts } from "@/lib/analytics";
import { Card } from "@/components/ui";

export const dynamic = "force-dynamic";

function cellBackground(value: number): string {
  const alpha = Math.max(0.06, Math.min(1, value / 100));
  return `rgba(255,255,255,${alpha})`;
}

export default async function CohortsPage() {
  const user = await requireUser();
  const { columns, rows } = await getCohorts(user.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          Cohort retention
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          Monthly repurchase matrix — the percentage of each cohort still buying
          in the months after their first order.
        </p>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto p-5 sm:p-6">
          <table className="w-full border-separate border-spacing-1 text-sm">
            <thead>
              <tr>
                <th className="px-2 py-1 text-left text-xs font-medium text-zinc-400">
                  Cohort
                </th>
                <th className="px-2 py-1 text-right text-xs font-medium text-zinc-400">
                  Size
                </th>
                {columns.map((c, i) => (
                  <th
                    key={c}
                    className="px-2 py-1 text-right text-xs font-medium text-zinc-400"
                  >
                    {i === 0 ? "Month 0" : c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.label}>
                  <td className="whitespace-nowrap px-2 py-1 font-medium text-white">
                    {row.label}
                  </td>
                  <td className="px-2 py-1 text-right tabular-nums text-zinc-400">
                    {row.size}
                  </td>
                  {row.values.map((v, i) => (
                    <td
                      key={i}
                      className="rounded-md px-2 py-2 text-right text-xs font-semibold tabular-nums"
                      style={{
                        background: cellBackground(v),
                        color: v >= 45 ? "#0b0b0d" : "#a1a1aa",
                      }}
                    >
                      {v.toFixed(1)}%
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="border-t border-white/10 px-6 py-3 text-xs text-zinc-400">
          Reading the matrix: a cohort of{" "}
          <span className="text-zinc-200">first-time buyers in a given month</span>{" "}
          is tracked rightward. Darker cells = stronger repeat purchase retention.
        </div>
      </Card>

      <Card className="p-5 sm:p-6">
        <h2 className="mb-3 text-base font-semibold text-white">
          Why retention matters
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            {
              title: "Repeat purchase curve",
              body: "Watch the 30/60/90-day repurchase curve to understand when your customers come back — and where they drop off.",
            },
            {
              title: "Lower blended CAC",
              body: "Returning customers dilute acquisition cost, driving blended CAC down and contribution margin up over time.",
            },
            {
              title: "Segment playbooks",
              body: "Feed cohort behavior into RFM segments to build automated win-back and VIP campaigns.",
            },
          ].map((c) => (
            <div
              key={c.title}
              className="rounded-xl border border-white/10 bg-white/5 p-4"
            >
              <p className="text-sm font-medium text-white">{c.title}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">{c.body}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
