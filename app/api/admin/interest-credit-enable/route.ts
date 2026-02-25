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
  const enabled = body?.enabled;

  if (accountId == null || typeof enabled !== "boolean") {
    return NextResponse.json(
      { error: "accountId (number) and enabled (boolean) required" },
      { status: 400 }
    );
  }
  const id = Number(accountId);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "Invalid accountId" }, { status: 400 });
  }

  const { error } = await supabase
    .from("accounts")
    .update({ interest_credit_enabled: enabled })
    .eq("account_id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, enabled });
}
