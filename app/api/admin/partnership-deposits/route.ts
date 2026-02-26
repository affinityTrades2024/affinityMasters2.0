import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { supabase } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { isAdmin } = await import("@/lib/admin");
  if (!(await isAdmin(session.email))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const accountId = request.nextUrl.searchParams.get("accountId");
  if (!accountId) return NextResponse.json({ error: "accountId required" }, { status: 400 });

  const parsedAccountId = parseInt(accountId, 10);

  const { data: accountRow } = await supabase
    .from("accounts")
    .select("client_id")
    .eq("account_id", parsedAccountId)
    .maybeSingle();
  const clientId = accountRow?.client_id != null ? Number(accountRow.client_id) : null;

  const seen = new Set<number>();
  let totalDeposits = 0;

  const { data: byDest } = await supabase
    .from("transactions")
    .select("id, destination_amount")
    .eq("type", "deposit")
    .eq("destination_account_id", parsedAccountId);
  for (const r of byDest || []) {
    if (!seen.has(r.id)) {
      seen.add(r.id);
      totalDeposits += Number(r.destination_amount ?? 0);
    }
  }

  if (clientId != null) {
    const { data: byClient } = await supabase
      .from("transactions")
      .select("id, destination_amount")
      .eq("type", "deposit")
      .eq("client_id", clientId);
    for (const r of byClient || []) {
      if (!seen.has(r.id)) {
        seen.add(r.id);
        totalDeposits += Number(r.destination_amount ?? 0);
      }
    }
  }

  return NextResponse.json({ totalDeposits });
}
