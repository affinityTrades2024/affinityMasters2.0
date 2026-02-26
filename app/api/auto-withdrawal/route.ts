import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getProfileByEmail } from "@/lib/profile";
import { supabase } from "@/lib/supabase/server";
import { getDefaultBankAccount } from "@/lib/bank-accounts";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const profile = await getProfileByEmail(session.email);
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: clientRow } = await supabase
    .from("clients")
    .select("auto_withdrawal_enabled, auto_withdrawal_enabled_at")
    .eq("id", profile.id)
    .maybeSingle();

  const defaultBankAccount = await getDefaultBankAccount(profile.id);

  return NextResponse.json({
    enabled: Boolean(clientRow?.auto_withdrawal_enabled),
    enabledAt: clientRow?.auto_withdrawal_enabled_at ?? null,
    defaultBankAccount: defaultBankAccount
      ? {
          id: defaultBankAccount.id,
          bank: defaultBankAccount.bank,
          accountNumberMasked: defaultBankAccount.accountNumberMasked,
          ifscCode: defaultBankAccount.ifscCode,
        }
      : null,
  });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const profile = await getProfileByEmail(session.email);
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const enable = body?.enable === true;

  if (enable) {
    const defaultBank = await getDefaultBankAccount(profile.id);
    if (!defaultBank) {
      return NextResponse.json(
        { error: "Please set a default bank account in Bank Accounts first." },
        { status: 400 }
      );
    }
  }

  const { error } = await supabase
    .from("clients")
    .update({
      auto_withdrawal_enabled: enable,
      auto_withdrawal_enabled_at: enable ? new Date().toISOString() : null,
    })
    .eq("id", profile.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, enabled: enable });
}
