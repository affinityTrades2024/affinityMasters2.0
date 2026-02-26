import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import {
  buildAccountMaps,
  getTransactionsByType,
  toDisplayTransactions,
} from "@/lib/transactions";
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

  const rawTxs = await getTransactionsByType("partnership_fee_admin");
  const { byId, selfAccountNumbers } = await buildAccountMaps(0, rawTxs);
  const transactions = toDisplayTransactions(rawTxs, byId, selfAccountNumbers);

  const totalCount = transactions.length;

  if (isCsv) {
    const headers = [
      "Transaction ID",
      "Date & Time",
      "Type",
      "Amount",
      "Currency",
      "From Account",
      "To Account",
      "Platform",
      "Status",
    ];
    const rows = transactions.map((t) => [
      t.transactionId,
      t.createTime ? new Date(t.createTime).toISOString() : "",
      t.type,
      t.creditDetails.amount,
      t.creditDetails.currency.alphabeticCode,
      `${t.debitDetails.account.clientName} (${t.debitDetails.account.accountNumber})`,
      `${t.creditDetails.account.clientName} (${t.creditDetails.account.accountNumber})`,
      t.creditDetails.account.platform,
      t.status,
    ]);
    const csv = buildCsv(headers, rows);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="partnership-earnings-report.csv"',
      },
    });
  }

  const from = (page - 1) * pageSize;
  const paginated = transactions.slice(from, from + pageSize);

  return NextResponse.json({
    rows: paginated.map((t) => ({
      transactionId: t.transactionId,
      createTime: t.createTime,
      type: t.type,
      amount: t.creditDetails.amount,
      currency: t.creditDetails.currency.alphabeticCode,
      fromAccount: `${t.debitDetails.account.clientName} (${t.debitDetails.account.accountNumber})`,
      toAccount: `${t.creditDetails.account.clientName} (${t.creditDetails.account.accountNumber})`,
      platform: t.creditDetails.account.platform,
      status: t.status,
    })),
    totalCount,
  });
}
