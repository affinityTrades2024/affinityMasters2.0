import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { supabase } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { getInvestmentAccountId } from "@/lib/investment-account";
import { createNotification } from "@/lib/notifications";

const MASTER_ACCOUNT_ID = 129;

async function getNextTransactionId(): Promise<number> {
  const { data } = await supabase
    .from("transactions")
    .select("id")
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.id != null ? Number(data.id) + 1 : 1;
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isAdmin(session.email))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: entries, error } = await supabase
    .from("pending_disbursal_entries")
    .select("id, client_id, amount_usd, source_funds_request_id, admin_comments, created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const clientIds = [...new Set((entries || []).map((e) => e.client_id))];
  const { data: clients } = await supabase
    .from("clients")
    .select("id, email, name")
    .in("id", clientIds);
  const clientMap = new Map(
    (clients || []).map((c) => [c.id, { email: c.email as string, name: c.name as string }])
  );

  const requestIds = [...new Set((entries || []).map((e) => e.source_funds_request_id))];
  const { data: fundsRequests } = await supabase
    .from("funds_requests")
    .select("id, amount_usd, requested_at")
    .in("id", requestIds);
  const requestMap = new Map(
    (fundsRequests || []).map((r) => [
      r.id,
      { amountUsd: Number(r.amount_usd), requestedAt: r.requested_at },
    ])
  );

  const list = (entries || []).map((e) => {
    const req = requestMap.get(e.source_funds_request_id);
    return {
      id: e.id,
      clientId: e.client_id,
      clientEmail: clientMap.get(e.client_id)?.email ?? "—",
      clientName: clientMap.get(e.client_id)?.name ?? "—",
      amountUsd: Number(e.amount_usd),
      sourceRequestId: e.source_funds_request_id,
      sourceRequestAmount: req?.amountUsd,
      sourceRequestedAt: req?.requestedAt,
      adminComments: e.admin_comments ?? "",
      createdAt: e.created_at,
    };
  });

  return NextResponse.json({ entries: list });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isAdmin(session.email))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const id = body?.id != null ? parseInt(String(body.id), 10) : NaN;
  const settlementComments =
    typeof body?.settlement_comments === "string" ? body.settlement_comments.trim() : "";

  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Valid entry id required" }, { status: 400 });
  }
  if (!settlementComments) {
    return NextResponse.json(
      { error: "Settlement comments are mandatory" },
      { status: 400 }
    );
  }

  const { data: adminRow } = await supabase
    .from("admin_users")
    .select("id")
    .ilike("email", session.email.trim().toLowerCase())
    .maybeSingle();
  const settledByAdminId = adminRow?.id ?? null;

  const { data: entry, error: fetchErr } = await supabase
    .from("pending_disbursal_entries")
    .select("id, client_id, amount_usd, status")
    .eq("id", id)
    .single();

  if (fetchErr || !entry) {
    return NextResponse.json({ error: "Entry not found" }, { status: 400 });
  }
  if (entry.status !== "pending") {
    return NextResponse.json({ error: "Entry is already settled" }, { status: 400 });
  }

  const amount = Number(entry.amount_usd ?? 0);
  const clientId = entry.client_id;
  const accountId = await getInvestmentAccountId(clientId);

  if (accountId == null) {
    return NextResponse.json(
      { error: "User has no investment account to credit" },
      { status: 400 }
    );
  }

  const nextTxId = await getNextTransactionId();
  const operationDate = new Date().toISOString().slice(0, 10);

  const { error: txError } = await supabase.from("transactions").insert({
    id: nextTxId,
    client_id: clientId,
    type: "pending_disbursal_settlement",
    source_account_id: MASTER_ACCOUNT_ID,
    destination_account_id: accountId,
    source_amount: amount,
    source_currency: "USD",
    destination_amount: amount,
    destination_currency: "USD",
    status: "completed",
    operation_date: operationDate,
  });
  if (txError) {
    return NextResponse.json({ error: txError.message }, { status: 500 });
  }

  const { data: acc } = await supabase
    .from("accounts")
    .select("balance")
    .eq("account_id", accountId)
    .single();
  const newBalance = (Number(acc?.balance ?? 0)) + amount;
  const { error: updAcc } = await supabase
    .from("accounts")
    .update({ balance: newBalance })
    .eq("account_id", accountId);
  if (updAcc) {
    return NextResponse.json({ error: updAcc.message }, { status: 500 });
  }

  const { error: updEntry } = await supabase
    .from("pending_disbursal_entries")
    .update({
      status: "settled",
      settled_at: new Date().toISOString(),
      settled_by_admin_id: settledByAdminId,
      settlement_comments: settlementComments,
      settlement_transaction_id: nextTxId,
    })
    .eq("id", id);
  if (updEntry) {
    return NextResponse.json({ error: updEntry.message }, { status: 500 });
  }

  try {
    await createNotification({
      recipientType: "user",
      recipientId: clientId,
      type: "pending_disbursal_settled",
      title: "Pending disbursal settled",
      link: "/funds",
      payload: { amount, settlementComments },
    });
  } catch (e) {
    console.error("[notifications] pending_disbursal_settled:", e);
  }

  return NextResponse.json({ ok: true });
}
