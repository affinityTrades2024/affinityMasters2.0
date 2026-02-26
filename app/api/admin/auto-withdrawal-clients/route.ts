import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { supabase } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";

function maskAccountNumber(accountNumber: string): string {
  const s = (accountNumber || "").trim();
  if (s.length <= 4) return "****";
  return "****" + s.slice(-4);
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isAdmin(session.email))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: clients } = await supabase
    .from("clients")
    .select("id, email, name, investment_account_id, auto_withdrawal_enabled_at")
    .eq("auto_withdrawal_enabled", true);

  if (!clients?.length) {
    return NextResponse.json({ clients: [] });
  }

  const accountIds = [...new Set(clients.map((c) => c.investment_account_id).filter(Boolean))] as number[];
  const { data: accounts } = await supabase
    .from("accounts")
    .select("account_id, account_number, balance, client_id")
    .in("account_id", accountIds);

  const accountMap = new Map(
    (accounts ?? []).map((a) => [a.account_id, { account_number: a.account_number, balance: Number(a.balance ?? 0), client_id: a.client_id }])
  );

  const { data: bankRows } = await supabase
    .from("bank_accounts")
    .select("id, client_id, bank, account_number, ifsc_code")
    .in(
      "client_id",
      clients.map((c) => c.id)
    )
    .eq("is_default", true);

  const bankByClientId = new Map(
    (bankRows ?? []).map((b) => [
      b.client_id,
      {
        bank: b.bank,
        accountNumberMasked: maskAccountNumber(String(b.account_number ?? "")),
        ifscCode: b.ifsc_code,
      },
    ])
  );

  const list = clients.map((c) => {
    const acc = accountMap.get(c.investment_account_id as number);
    const bank = bankByClientId.get(c.id);
    return {
      clientId: c.id,
      email: c.email,
      name: c.name,
      enabledAt: c.auto_withdrawal_enabled_at,
      accountId: c.investment_account_id,
      accountNumber: acc?.account_number ?? c.investment_account_id,
      availableBalanceUsd: acc?.balance ?? 0,
      defaultBank: bank
        ? `${bank.bank} — ${bank.accountNumberMasked} — IFSC: ${bank.ifscCode}`
        : null,
    };
  });

  return NextResponse.json({ clients: list });
}
