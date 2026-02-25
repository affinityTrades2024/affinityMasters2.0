import { getTransactionsByType } from "@/lib/transactions";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminCard from "@/components/admin/AdminCard";
import DailyReportTableClient from "./daily-report-table-client";

export interface DailyProfitRow {
  date: string;
  totalProfitShared: number;
  numberOfAccounts: number;
}

export default async function DailyProfitReportPage() {
  const rows = await getTransactionsByType("daily_interest");
  const byDate = new Map<string, { total: number; count: number }>();
  for (const r of rows) {
    const date = r.operation_date || "";
    if (!date) continue;
    const existing = byDate.get(date) ?? { total: 0, count: 0 };
    existing.total += Number(r.destination_amount ?? 0);
    existing.count += 1;
    byDate.set(date, existing);
  }
  const reportRows: DailyProfitRow[] = Array.from(byDate.entries())
    .map(([date, { total, count }]) => ({
      date,
      totalProfitShared: total,
      numberOfAccounts: count,
    }))
    .sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div>
      <AdminPageHeader
        title="Daily Profit Report"
        description="Date-wise sum of all profit sharing (daily interest) credited across accounts."
      />
      <AdminCard className="mt-6">
        <DailyReportTableClient rows={reportRows} />
      </AdminCard>
    </div>
  );
}
