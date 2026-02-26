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

  const { data: bankRows, error, count } = await supabase
    .from("bank_accounts")
    .select("id, client_id, bank, account_number, ifsc_code, is_default, created_at", isCsv ? undefined : { count: "exact" })
    .order("id", { ascending: true })
    .range(isCsv ? 0 : from, to);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const clientIds = [...new Set((bankRows || []).map((r) => r.client_id))];
  const { data: clients } = await supabase
    .from("clients")
    .select("id, email, name")
    .in("id", clientIds);
  const clientMap = new Map(
    (clients || []).map((c) => [c.id, { email: c.email as string, name: c.name as string }])
  );

  const list = (bankRows || []).map((r) => ({
    id: r.id,
    clientId: r.client_id,
    clientEmail: clientMap.get(r.client_id)?.email ?? "—",
    clientName: clientMap.get(r.client_id)?.name ?? "—",
    bank: r.bank,
    accountNumber: r.account_number,
    ifscCode: r.ifsc_code,
    isDefault: Boolean(r.is_default),
    createdAt: r.created_at,
  }));

  if (isCsv) {
    const headers = [
      "ID",
      "Client ID",
      "Client Email",
      "Client Name",
      "Bank",
      "Account Number",
      "IFSC Code",
      "Is Default",
      "Created At",
    ];
    const rows = list.map((r) => [
      r.id,
      r.clientId,
      r.clientEmail,
      r.clientName,
      r.bank,
      r.accountNumber,
      r.ifscCode,
      r.isDefault ? "Yes" : "No",
      r.createdAt ? new Date(r.createdAt).toISOString() : "",
    ]);
    const csv = buildCsv(headers, rows);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="bank-details-report.csv"',
      },
    });
  }

  const totalCount = count ?? list.length;
  return NextResponse.json({ rows: list, totalCount });
}
