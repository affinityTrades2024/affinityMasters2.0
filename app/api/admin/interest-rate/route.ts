import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { supabase } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { isAdmin } = await import("@/lib/admin");
  if (!(await isAdmin(session.email))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const accountId = body?.accountId;
  const rate = body?.rate;
  if (accountId == null || rate == null) {
    return NextResponse.json({ error: "accountId and rate required" }, { status: 400 });
  }
  const numRate = parseFloat(String(rate));
  if (Number.isNaN(numRate) || numRate < 0 || numRate > 100) {
    return NextResponse.json({ error: "Invalid rate" }, { status: 400 });
  }
  const { error } = await supabase
    .from("accounts")
    .update({ interest_rate_monthly: numRate })
    .eq("account_id", accountId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
