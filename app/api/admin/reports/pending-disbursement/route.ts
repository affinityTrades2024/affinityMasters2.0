import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { supabase } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
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

  const from = (page - 1) * pageSize;
  const to = isCsv ? 9999 : from + pageSize - 1;

  const { data: requests, error, count } = await supabase
    .from("funds_requests")
    .select(
      "id, client_id, type, account_id, amount_usd, amount_inr, status, requested_at, reviewed_at, admin_notes",
      isCsv ? undefined : { count: "exact" }
    )
    .eq("type", "withdrawal")
    .eq("status", "approved_pending_disbursement")
    .order("requested_at", { ascending: true })
    .range(isCsv ? 0 : from, to);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const clientIds = [...new Set((requests || []).map((r) => r.client_id))];
  const { data: clients } = await supabase
    .from("clients")
    .select("id, email, name")
    .in("id", clientIds);
  const clientMap = new Map(
    (clients || []).map((c) => [c.id, { email: c.email as string, name: c.name as string }])
  );

  const accountIds = [...new Set((requests || []).map((r) => r.account_id))];
  const { data: accounts } = await supabase
    .from("accounts")
    .select("account_id, account_number")
    .in("account_id", accountIds);
  const { data: pamm } = await supabase
    .from("pamm_master")
    .select("id, account_number")
    .in("id", accountIds);
  const accountLabel = (id: number): string => {
    const a = (accounts || []).find((x) => x.account_id === id);
    if (a) return String(a.account_number ?? a.account_id);
    const p = (pamm || []).find((x) => x.id === id);
    if (p) return String(p.account_number ?? p.id);
    return String(id);
  };

  const list = (requests || []).map((r) => ({
    id: r.id,
    clientEmail: clientMap.get(r.client_id)?.email ?? "—",
    clientName: clientMap.get(r.client_id)?.name ?? "—",
    accountLabel: accountLabel(r.account_id),
    amountUsd: Number(r.amount_usd),
    amountInr: Number(r.amount_inr),
    requestedAt: r.requested_at,
    reviewedAt: r.reviewed_at,
    adminNotes: r.admin_notes ?? null,
  }));

  if (isCsv) {
    const headers = [
      "ID",
      "Client Email",
      "Client Name",
      "Account",
      "Amount (USD)",
      "Amount (INR)",
      "Requested At",
      "Reviewed At",
      "Payout Remark",
    ];
    const rows = list.map((r) => [
      r.id,
      r.clientEmail,
      r.clientName,
      r.accountLabel,
      r.amountUsd,
      r.amountInr,
      r.requestedAt ? new Date(r.requestedAt).toISOString() : "",
      r.reviewedAt ? new Date(r.reviewedAt).toISOString() : "",
      r.adminNotes ?? "",
    ]);
    const csv = buildCsv(headers, rows);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="pending-disbursement-report.csv"',
      },
    });
  }

  const totalCount = count ?? list.length;
  return NextResponse.json({ rows: list, totalCount });
}
