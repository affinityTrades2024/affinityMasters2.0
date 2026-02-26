import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { supabase } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { getTransactionsByType, buildAccountMaps, toDisplayTransactions } from "@/lib/transactions";
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

  const rawTxs = await getTransactionsByType("deposit");
  const { byId, selfAccountNumbers } = await buildAccountMaps(0, rawTxs);
  const transactions = toDisplayTransactions(rawTxs, byId, selfAccountNumbers);

  const txIds = rawTxs.map((r) => r.id);
  const remarkMap = new Map<number, string>();
  if (txIds.length > 0) {
    const batchSize = 500;
    for (let i = 0; i < txIds.length; i += batchSize) {
      const batch = txIds.slice(i, i + batchSize);
      const { data: frRows } = await supabase
        .from("funds_requests")
        .select("transaction_id, admin_notes")
        .in("transaction_id", batch)
        .not("admin_notes", "is", null);
      for (const fr of frRows || []) {
        if (fr.transaction_id != null && fr.admin_notes) {
          remarkMap.set(fr.transaction_id, fr.admin_notes as string);
        }
      }
    }
  }

  const clientIds = [...new Set(rawTxs.map((r) => r.client_id).filter(Boolean))];
  const clientMap = new Map<number, { email: string; name: string }>();
  if (clientIds.length > 0) {
    const batchSize = 500;
    for (let i = 0; i < clientIds.length; i += batchSize) {
      const batch = clientIds.slice(i, i + batchSize);
      const { data: clients } = await supabase
        .from("clients")
        .select("id, email, name")
        .in("id", batch);
      for (const c of clients || []) {
        clientMap.set(c.id, { email: c.email as string, name: c.name as string });
      }
    }
  }

  const list = transactions.map((t, idx) => {
    const raw = rawTxs[idx];
    const client = raw?.client_id ? clientMap.get(raw.client_id) : null;
    return {
      transactionId: t.transactionId,
      date: t.createTime,
      clientEmail: client?.email ?? "—",
      clientName: client?.name ?? "—",
      toAccount: `${t.creditDetails.account.clientName} (${t.creditDetails.account.accountNumber})`,
      amount: t.creditDetails.amount,
      currency: t.creditDetails.currency.alphabeticCode,
      status: t.status,
      depositRemark: remarkMap.get(t.transactionId) ?? null,
    };
  });

  const totalCount = list.length;

  if (isCsv) {
    const headers = [
      "Transaction ID",
      "Date",
      "Client Email",
      "Client Name",
      "To Account",
      "Amount",
      "Currency",
      "Status",
      "Deposit Remark",
    ];
    const rows = list.map((r) => [
      r.transactionId,
      r.date ? new Date(r.date).toISOString() : "",
      r.clientEmail,
      r.clientName,
      r.toAccount,
      r.amount,
      r.currency,
      r.status,
      r.depositRemark ?? "",
    ]);
    const csv = buildCsv(headers, rows);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="deposits-report.csv"',
      },
    });
  }

  const from = (page - 1) * pageSize;
  const paginated = list.slice(from, from + pageSize);

  return NextResponse.json({ rows: paginated, totalCount });
}
