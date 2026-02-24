import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getProfileByEmail } from "@/lib/profile";
import { getInvestmentAccount } from "@/lib/investment-account";
import { supabase } from "@/lib/supabase/server";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const profile = await getProfileByEmail(session.email);
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const account = await getInvestmentAccount(profile.id);
  if (!account) {
    return NextResponse.json({ pamm: [] });
  }
  const { data: pammRow } = await supabase
    .from("pamm_master")
    .select("ref_id")
    .eq("id", account.account_id)
    .eq("client_id", profile.id)
    .maybeSingle();
  const pamm = [
    {
      id: account.account_id,
      account_number: account.account_number,
      name: "Investment Account",
      ref_id: pammRow?.ref_id ?? null,
    },
  ];
  return NextResponse.json({ pamm });
}
