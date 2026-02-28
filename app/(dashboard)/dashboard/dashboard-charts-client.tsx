"use client";

import type { MonthlySeriesPoint } from "@/lib/dashboard-metrics";

interface Props {
  ownProfitByMonth: MonthlySeriesPoint[];
  partnershipEarningsByMonth: MonthlySeriesPoint[];
  dailyProfitByMonth: MonthlySeriesPoint[];
}

function formatMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function BarChart({
  title,
  data,
  valueKey,
  colorClass,
}: {
  title: string;
  data: MonthlySeriesPoint[];
  valueKey: keyof MonthlySeriesPoint;
  colorClass: string;
}) {
  const values = data.map((d) => d[valueKey] as number);
  const max = Math.max(1, ...values);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-medium text-gray-700">{title}</h3>
      <div className="mt-3 space-y-2">
        {data.length === 0 ? (
          <p className="text-sm text-gray-500">No data for the selected range.</p>
        ) : (
          data.map((d) => {
            const v = d[valueKey] as number;
            const pct = max > 0 ? (v / max) * 100 : 0;
            return (
              <div key={d.month} className="flex items-center gap-2">
                <span className="w-20 shrink-0 text-xs text-gray-500">
                  {formatMonth(d.month)}
                </span>
                <div className="min-w-0 flex-1">
                  <div
                    className={`h-6 rounded ${colorClass}`}
                    style={{ width: `${pct}%`, minWidth: v > 0 ? "4px" : "0" }}
                    title={v.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  />
                </div>
                <span className="w-24 shrink-0 text-right text-xs font-medium text-gray-700">
                  ${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default function DashboardChartsClient({
  ownProfitByMonth,
  partnershipEarningsByMonth,
  dailyProfitByMonth,
}: Props) {
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-gray-900">Charts by month</h2>
      <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-3">
        <BarChart
          title="Own profits"
          data={ownProfitByMonth}
          valueKey="ownProfit"
          colorClass="bg-amber-500"
        />
        <BarChart
          title="Partnership earnings"
          data={partnershipEarningsByMonth}
          valueKey="partnershipEarnings"
          colorClass="bg-blue-500"
        />
        <BarChart
          title="Daily Profit"
          data={dailyProfitByMonth}
          valueKey="dailyProfit"
          colorClass="bg-emerald-500"
        />
      </div>
    </div>
  );
}
