import { requireUser } from "@/lib/auth";
import { getCustomers } from "@/lib/analytics";
import { SEGMENT_COLORS } from "@/lib/segments";
import { formatCurrency, formatNumber, relativeTime } from "@/lib/format";
import { Card, StatCard } from "@/components/ui";
import { Donut } from "@/components/charts";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const user = await requireUser();
  const { segments, customers } = await getCustomers(user.id);

  const topCustomers = [...customers]
    .sort((a, b) => b.totalSpend - a.totalSpend)
    .slice(0, 60);

  const donutData = segments.map((s) => ({ name: s.label, value: s.count }));
  const donutColors = segments.map((s) => SEGMENT_COLORS[s.segment]);

  const totalCustomers = customers.length;
  const totalLtv = customers.reduce((s, c) => s + c.totalSpend, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          Customers & RFM
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          Recency · frequency · monetary loyalty segmentation across your base.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Total customers"
          value={formatNumber(totalCustomers)}
          sub="Lifetime unique buyers"
        />
        <StatCard
          label="Customer lifetime value"
          value={formatCurrency(totalCustomers > 0 ? totalLtv / totalCustomers : 0)}
          sub="Average revenue per customer"
        />
        <StatCard
          label="VIP segment"
          value={formatNumber(segments.find((s) => s.segment === "vip")?.count ?? 0)}
          sub="Highest-value cohort"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <Card className="p-5 sm:p-6 xl:col-span-2">
          <h2 className="text-base font-semibold text-white">Segment mix</h2>
          <p className="text-xs text-zinc-400">Share of customers by loyalty tier</p>
          <Donut data={donutData} colors={donutColors} />
          <div className="mt-2 space-y-2">
            {segments.map((s) => (
              <div key={s.segment} className="flex items-center gap-2 text-sm">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ background: SEGMENT_COLORS[s.segment] }}
                />
                <span className="flex-1 text-zinc-200">{s.label}</span>
                <span className="tabular-nums text-zinc-400">
                  {formatNumber(s.count)} · {formatCurrency(s.avgSpend)}
                </span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5 sm:p-6 xl:col-span-3">
          <h2 className="mb-1 text-base font-semibold text-white">Segments</h2>
          <p className="mb-4 text-xs text-zinc-400">Lifetime value & purchase frequency</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-zinc-400">
                  <th className="py-2 pr-3 font-medium">Segment</th>
                  <th className="py-2 pr-3 text-right font-medium">Customers</th>
                  <th className="py-2 pr-3 text-right font-medium">Avg. LTV</th>
                  <th className="py-2 pr-3 text-right font-medium">Avg. orders</th>
                  <th className="py-2 text-right font-medium">Share</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {segments.map((s) => (
                  <tr key={s.segment}>
                    <td className="py-2.5 pr-3">
                      <span className="inline-flex items-center gap-2 font-medium text-white">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ background: SEGMENT_COLORS[s.segment] }}
                        />
                        {s.label}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3 text-right tabular-nums text-zinc-200">
                      {formatNumber(s.count)}
                    </td>
                    <td className="py-2.5 pr-3 text-right tabular-nums text-zinc-200">
                      {formatCurrency(s.avgSpend)}
                    </td>
                    <td className="py-2.5 pr-3 text-right tabular-nums text-zinc-200">
                      {s.avgOrders.toFixed(1)}
                    </td>
                    <td className="py-2.5 text-right tabular-nums text-zinc-200">
                      {s.share.toFixed(0)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <Card className="p-5 sm:p-6">
        <h2 className="mb-4 text-base font-semibold text-white">Top customers</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-zinc-400">
                <th className="py-2 pr-3 font-medium">Customer</th>
                <th className="py-2 pr-3 font-medium">Segment</th>
                <th className="py-2 pr-3 text-right font-medium">Orders</th>
                <th className="py-2 pr-3 text-right font-medium">Lifetime value</th>
                <th className="py-2 text-right font-medium">Last order</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {topCustomers.map((c) => (
                <tr key={c.id}>
                  <td className="py-2.5 pr-3">
                    <p className="font-medium text-white">{c.name || "—"}</p>
                    <p className="text-xs text-zinc-400">{c.email}</p>
                  </td>
                  <td className="py-2.5 pr-3">
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium"
                      style={{
                        color: SEGMENT_COLORS[c.segment],
                        background: `${SEGMENT_COLORS[c.segment]}1a`,
                      }}
                    >
                      {c.segmentLabel}
                    </span>
                  </td>
                  <td className="py-2.5 pr-3 text-right tabular-nums text-zinc-200">
                    {c.orderCount}
                  </td>
                  <td className="py-2.5 pr-3 text-right tabular-nums text-zinc-200">
                    {formatCurrency(c.totalSpend)}
                  </td>
                  <td className="py-2.5 text-right tabular-nums text-zinc-400">
                    {relativeTime(c.lastOrderAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
