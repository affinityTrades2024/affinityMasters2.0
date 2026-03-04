import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { supabase } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isAdmin(session.email))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const clientId = body?.clientId != null ? parseInt(String(body.clientId), 10) : NaN;
  const bank = typeof body?.bank === "string" ? body.bank.trim() : "";
  const accountNumber = typeof body?.account_number === "string" ? body.account_number.trim() : "";
  const ifscCode = typeof body?.ifsc_code === "string" ? body.ifsc_code.trim() : "";

  if (!Number.isInteger(clientId) || clientId <= 0) {
    return NextResponse.json({ error: "Valid client is required" }, { status: 400 });
  }
  if (!bank || !accountNumber || !ifscCode) {
    return NextResponse.json(
      { error: "Bank, account number, and IFSC code are required" },
      { status: 400 }
    );
  }

  const { data: clientRow } = await supabase
    .from("clients")
    .select("id")
    .eq("id", clientId)
    .maybeSingle();

  if (!clientRow) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  const { data: existing } = await supabase
    .from("bank_accounts")
    .select("id")
    .eq("client_id", clientId);
  const isFirst = !existing || existing.length === 0;

  const { data: inserted, error } = await supabase
    .from("bank_accounts")
    .insert({
      client_id: clientId,
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
