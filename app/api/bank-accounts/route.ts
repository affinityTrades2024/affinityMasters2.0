import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getProfileByEmail } from "@/lib/profile";
import { getBankAccounts } from "@/lib/bank-accounts";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const profile = await getProfileByEmail(session.email);
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const accounts = await getBankAccounts(profile.id);
    return NextResponse.json({ accounts });
  } catch (e) {
    console.error("Bank accounts list error", e);
    return NextResponse.json(
      { error: "Failed to load bank accounts" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const profile = await getProfileByEmail(session.email);
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await request.json().catch(() => ({}));
  const bank = typeof body?.bank === "string" ? body.bank.trim() : "";
  const accountNumber = typeof body?.account_number === "string" ? body.account_number.trim() : "";
  const confirmAccountNumber =
    typeof body?.confirm_account_number === "string" ? body.confirm_account_number.trim() : "";
  const ifscCode = typeof body?.ifsc_code === "string" ? body.ifsc_code.trim() : "";

  if (!bank || !accountNumber || !ifscCode) {
    return NextResponse.json(
      { error: "Bank, account number, and IFSC code are required" },
      { status: 400 }
    );
  }
  if (accountNumber !== confirmAccountNumber) {
    return NextResponse.json(
      { error: "Account number and confirmation do not match" },
      { status: 400 }
    );
  }

  const { supabase } = await import("@/lib/supabase/server");
  const { data: existing } = await supabase
    .from("bank_accounts")
    .select("id")
    .eq("client_id", profile.id);
  const isFirst = !existing || existing.length === 0;

  const { data: inserted, error } = await supabase
    .from("bank_accounts")
    .insert({
      client_id: profile.id,
      bank,
      account_number: accountNumber,
      ifsc_code: ifscCode,
      is_default: isFirst,
    })
    .select("id, bank, account_number, ifsc_code, is_default, created_at")
    .single();

  if (error) {
    return NextResponse.json(
      { error: error.message || "Failed to add bank account" },
      { status: 500 }
    );
  }
  return NextResponse.json({
    id: inserted.id,
    bank: inserted.bank,
    accountNumberMasked:
      inserted.account_number && inserted.account_number.length > 4
        ? "****" + inserted.account_number.slice(-4)
        : "****",
    ifscCode: inserted.ifsc_code,
    isDefault: inserted.is_default,
    created_at: inserted.created_at,
  });
}
