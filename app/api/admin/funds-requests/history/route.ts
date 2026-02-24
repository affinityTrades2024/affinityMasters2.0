import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { supabase } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isAdmin(session.email))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: requests, error } = await supabase
    .from("funds_requests")
    .select(
      "id, client_id, type, account_id, amount_usd, amount_inr, status, requested_at, reviewed_at, transaction_id, disbursed_at, admin_notes"
    )
    .order("requested_at", { ascending: false });

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
    clientId: r.client_id,
    clientEmail: clientMap.get(r.client_id)?.email ?? "—",
    clientName: clientMap.get(r.client_id)?.name ?? "—",
    type: r.type,
    accountId: r.account_id,
    accountLabel: accountLabel(r.account_id),
    amountUsd: Number(r.amount_usd),
    amountInr: Number(r.amount_inr),
    status: r.status,
    requestedAt: r.requested_at,
    reviewedAt: r.reviewed_at,
    transactionId: r.transaction_id,
    disbursedAt: r.disbursed_at,
    adminNotes: r.admin_notes ?? null,
  }));

  return NextResponse.json({ requests: list });
}
