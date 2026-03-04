import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { supabase } from "@/lib/supabase/server";
import { getFundsRates } from "@/lib/funds-rates";
import { getInvestmentAccountId } from "@/lib/investment-account";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isAdmin(session.email))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const clientId = body?.clientId != null ? parseInt(String(body.clientId), 10) : NaN;
  const amountUsd = body?.amountUsd != null ? parseFloat(String(body.amountUsd)) : NaN;
  const bankAccountId = body?.bankAccountId != null ? parseInt(String(body.bankAccountId), 10) : null;
  const bank = typeof body?.bank === "string" ? body.bank.trim() : "";
  const accountNumber = typeof body?.account_number === "string" ? body.account_number.trim() : "";
  const ifscCode = typeof body?.ifsc_code === "string" ? body.ifsc_code.trim() : "";

  if (!Number.isInteger(clientId) || clientId <= 0) {
    return NextResponse.json({ error: "Valid client is required" }, { status: 400 });
  }
  if (Number.isNaN(amountUsd) || amountUsd <= 0) {
    return NextResponse.json(
      { error: "Amount (USD) must be a positive number" },
      { status: 400 }
    );
  }
  if (amountUsd < 10) {
    return NextResponse.json(
      { error: "Minimum withdrawal is 10 USD" },
      { status: 400 }
    );
  }

  const accountId = await getInvestmentAccountId(clientId);
  if (accountId === null) {
    return NextResponse.json(
      { error: "No investment account linked for this client" },
      { status: 400 }
    );
  }

  const { data: accountRow, error: accError } = await supabase
    .from("accounts")
    .select("account_id, balance")
    .eq("account_id", accountId)
    .eq("client_id", clientId)
    .not("platform", "ilike", "%demo%")
    .maybeSingle();

  if (accError || !accountRow) {
    return NextResponse.json(
      { error: "Account not found or does not belong to this client" },
      { status: 403 }
    );
  }

  const available = Number(accountRow.balance ?? 0);
  if (amountUsd > available) {
    return NextResponse.json(
      { error: "Amount exceeds available balance" },
      { status: 400 }
    );
  }

  let effectiveBankAccountId: number;

  if (bankAccountId != null && Number.isInteger(bankAccountId) && bankAccountId > 0) {
    const { data: bankRow } = await supabase
      .from("bank_accounts")
      .select("id")
      .eq("id", bankAccountId)
      .eq("client_id", clientId)
      .maybeSingle();
    if (!bankRow) {
      return NextResponse.json(
        { error: "Bank account not found or does not belong to this client" },
        { status: 403 }
      );
    }
    effectiveBankAccountId = bankAccountId;
  } else if (bank && accountNumber && ifscCode) {
    const { data: existing } = await supabase
      .from("bank_accounts")
      .select("id")
      .eq("client_id", clientId);
    const isFirst = !existing || existing.length === 0;
    const { data: insertedBank, error: bankError } = await supabase
      .from("bank_accounts")
      .insert({
        client_id: clientId,
        bank,
        account_number: accountNumber,
        ifsc_code: ifscCode,
        is_default: isFirst,
      })
      .select("id")
      .single();
    if (bankError || !insertedBank) {
      return NextResponse.json(
        { error: bankError?.message ?? "Failed to add bank account" },
        { status: 500 }
      );
    }
    effectiveBankAccountId = insertedBank.id;
  } else {
    return NextResponse.json(
      { error: "Provide bankAccountId or bank details (bank, account_number, ifsc_code)" },
      { status: 400 }
    );
  }

  const rates = await getFundsRates();
  const rateUsed = rates.withdrawalInrPerUsd;
  const amountInr = Math.round(amountUsd * rateUsed * 100) / 100;

  const { data: inserted, error } = await supabase
    .from("funds_requests")
    .insert({
      client_id: clientId,
      type: "withdrawal",
      account_id: accountId,
      bank_account_id: effectiveBankAccountId,
      amount_usd: amountUsd,
      amount_inr: amountInr,
      rate_used: rateUsed,
      status: "pending",
      is_admin_initiated: true,
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { createNotification } = await import("@/lib/notifications");
  try {
    await createNotification({
      recipientType: "admin",
      recipientId: null,
      type: "withdrawal_request_received",
      title: "Withdraw request received for approval",
      link: "/manage/funds-requests",
      payload: { amountUsd, amountInr, clientId, requestId: inserted?.id },
    });
  } catch (e) {
    console.error("[notifications] withdrawal_request_received:", e);
  }

  return NextResponse.json({ ok: true, id: inserted?.id });
}
