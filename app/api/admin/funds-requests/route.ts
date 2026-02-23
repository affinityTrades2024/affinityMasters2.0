import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { supabase } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";

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

  const { data: requests, error } = await supabase
    .from("funds_requests")
    .select(
      "id, client_id, type, account_id, amount_usd, amount_inr, status, requested_at"
    )
    .eq("status", "pending")
    .order("requested_at", { ascending: true });

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
    requestedAt: r.requested_at,
  }));

  return NextResponse.json({ requests: list });
}

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isAdmin(session.email))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const id = body?.id != null ? parseInt(String(body.id), 10) : NaN;
  const action = body?.action;

  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Valid id required" }, { status: 400 });
  }
  if (action !== "approve" && action !== "reject") {
    return NextResponse.json(
      { error: "action must be 'approve' or 'reject'" },
      { status: 400 }
    );
  }

  const { data: adminRow } = await supabase
    .from("admin_users")
    .select("id")
    .ilike("email", session.email.trim().toLowerCase())
    .maybeSingle();
  const reviewedByAdminId = adminRow?.id ?? null;

  const { data: row, error: fetchError } = await supabase
    .from("funds_requests")
    .select("id, client_id, type, account_id, amount_usd, status")
    .eq("id", id)
    .single();

  if (fetchError || !row || row.status !== "pending") {
    return NextResponse.json(
      { error: "Request not found or not pending" },
      { status: 400 }
    );
  }

  const amount = Number(row.amount_usd ?? 0);
  const accountId = Number(row.account_id);
  const clientId = row.client_id;

  if (action === "reject") {
    const { error: updError } = await supabase
      .from("funds_requests")
      .update({
        status: "rejected",
        reviewed_at: new Date().toISOString(),
        reviewed_by_admin_id: reviewedByAdminId,
      })
      .eq("id", id);
    if (updError) {
      return NextResponse.json({ error: updError.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  if (action === "approve") {
    if (row.type === "withdrawal") {
      const { data: acc } = await supabase
        .from("accounts")
        .select("balance, free_funds")
        .eq("account_id", accountId)
        .single();
      const available =
        Number(acc?.free_funds ?? acc?.balance ?? 0) ?? 0;
      if (amount > available) {
        return NextResponse.json(
          { error: "Insufficient balance to approve withdrawal" },
          { status: 400 }
        );
      }
    }

    const nextTxId = await getNextTransactionId();
    const operationDate = new Date().toISOString().slice(0, 10);

    if (row.type === "deposit") {
      const { error: txError } = await supabase.from("transactions").insert({
        id: nextTxId,
        client_id: clientId,
        type: "deposit",
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
    } else {
      const { error: txError } = await supabase.from("transactions").insert({
        id: nextTxId,
        client_id: clientId,
        type: "withdrawal",
        source_account_id: accountId,
        destination_account_id: MASTER_ACCOUNT_ID,
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
      const newBalance = Math.max(0, Number(acc?.balance ?? 0) - amount);
      const { error: updAcc } = await supabase
        .from("accounts")
        .update({ balance: newBalance })
        .eq("account_id", accountId);
      if (updAcc) {
        return NextResponse.json({ error: updAcc.message }, { status: 500 });
      }
    }

    const { error: updReq } = await supabase
      .from("funds_requests")
      .update({
        status: "approved",
        reviewed_at: new Date().toISOString(),
        reviewed_by_admin_id: reviewedByAdminId,
        transaction_id: nextTxId,
      })
      .eq("id", id);
    if (updReq) {
      return NextResponse.json({ error: updReq.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
