import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getProfileByEmail } from "@/lib/profile";
import { getInvestmentAccountId } from "@/lib/investment-account";
import { supabase } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const profile = await getProfileByEmail(session.email);
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const accountId = body?.accountId;
  if (accountId == null) {
    return NextResponse.json({ error: "accountId required" }, { status: 400 });
  }
  const investmentAccountId = await getInvestmentAccountId(profile.id);
  if (investmentAccountId === null || Number(accountId) !== investmentAccountId) {
    return NextResponse.json({ error: "Investment account not found" }, { status: 404 });
  }
  const refId = Math.floor(100000 + Math.random() * 900000);
  const { error } = await supabase
    .from("pamm_master")
    .update({ ref_id: refId })
    .eq("id", accountId)
    .eq("client_id", profile.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ refId });
}
