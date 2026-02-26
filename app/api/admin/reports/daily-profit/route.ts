import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { getTransactionsByType } from "@/lib/transactions";
import { buildCsv } from "@/lib/reports";

const PAGE_SIZES = [20, 50, 100] as const;

function getPageSize(n: unknown): number {
  const num = typeof n === "string" ? parseInt(n, 10) : 20;
  return PAGE_SIZES.includes(num as (typeof PAGE_SIZES)[number]) ? num : 20;
}

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isAdmin(session.email))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format");
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const pageSize = getPageSize(searchParams.get("pageSize"));

  const isCsv = format === "csv";

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
  const reportRows = Array.from(byDate.entries())
    .map(([date, { total, count }]) => ({
      date,
      totalProfitShared: total,
      numberOfAccounts: count,
    }))
    .sort((a, b) => b.date.localeCompare(a.date));

  const totalCount = reportRows.length;

  if (isCsv) {
    const headers = ["Date", "Total Profit Shared (USD)", "Number of Accounts"];
    const csvRows = reportRows.map((r) => [
      r.date,
      r.totalProfitShared,
      r.numberOfAccounts,
    ]);
    const csv = buildCsv(headers, csvRows);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="daily-profit-report.csv"',
      },
    });
  }

  const from = (page - 1) * pageSize;
  const paginated = reportRows.slice(from, from + pageSize);

  return NextResponse.json({ rows: paginated, totalCount });
}
