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

  const { data } = await supabase
    .from("transactions")
    .select("destination_amount")
    .eq("type", "deposit")
    .eq("destination_account_id", parseInt(accountId, 10));
  const totalDeposits = (data || []).reduce(
    (s, r) => s + Number(r.destination_amount ?? 0),
    0
  );
  return NextResponse.json({ totalDeposits });
}
