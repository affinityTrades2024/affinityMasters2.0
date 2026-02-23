import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { supabase } from "@/lib/supabase/server";

const MASTER_ACCOUNT_ID = 129;

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { isAdmin } = await import("@/lib/admin");
  if (!(await isAdmin(session.email))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const recipientAccountId = body?.recipientAccountId;
  const referralAccountId = body?.referralAccountId;
  const totalDeposits = body?.totalDeposits;
  const percent = body?.percent;
  if (
    recipientAccountId == null ||
    referralAccountId == null ||
    totalDeposits == null ||
    percent == null
  ) {
    return NextResponse.json(
      { error: "recipientAccountId, referralAccountId, totalDeposits, percent required" },
      { status: 400 }
    );
  }
  const amount = (Number(totalDeposits) * Number(percent)) / 100;
  if (amount <= 0) return NextResponse.json({ error: "Invalid amount" }, { status: 400 });

  const { data: maxRow } = await supabase
    .from("transactions")
    .select("id")
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextId = maxRow?.id != null ? Number(maxRow.id) + 1 : 1;

  const { data: acc } = await supabase
    .from("accounts")
    .select("client_id")
    .eq("account_id", recipientAccountId)
    .single();
  const clientId = acc?.client_id ?? null;

  const { error: txError } = await supabase.from("transactions").insert({
    id: nextId,
    client_id: clientId,
    type: "partnership_fee_admin",
    source_account_id: MASTER_ACCOUNT_ID,
    destination_account_id: recipientAccountId,
    source_amount: amount,
    source_currency: "USD",
    destination_amount: amount,
    destination_currency: "USD",
    status: "completed",
    operation_date: new Date().toISOString().slice(0, 10),
  });
  if (txError) return NextResponse.json({ error: txError.message }, { status: 500 });

  const { data: balanceRow } = await supabase
    .from("accounts")
    .select("balance")
    .eq("account_id", recipientAccountId)
    .single();
  const newBalance = (Number(balanceRow?.balance ?? 0)) + amount;
  const { error: updError } = await supabase
    .from("accounts")
    .update({ balance: newBalance })
    .eq("account_id", recipientAccountId);
  if (updError) return NextResponse.json({ error: updError.message }, { status: 500 });

  return NextResponse.json({ ok: true, transactionId: nextId });
}
