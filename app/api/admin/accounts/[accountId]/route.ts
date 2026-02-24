import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { supabase } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";

const ALLOWED_ACCOUNT_FIELDS = [
  "client_name",
  "email",
  "interest_rate_monthly",
  "balance",
  "free_funds",
] as const;

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ accountId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isAdmin(session.email))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { accountId: accountIdParam } = await params;
  const accountId = parseInt(accountIdParam, 10);
  if (!Number.isFinite(accountId) || accountId <= 0) {
    return NextResponse.json({ error: "Invalid account ID" }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const updates: Record<string, unknown> = {};

  for (const field of ALLOWED_ACCOUNT_FIELDS) {
    if (body[field] === undefined) continue;
    if (field === "interest_rate_monthly") {
      const v = parseFloat(String(body[field]));
      if (Number.isNaN(v) || v < 0 || v > 100) continue;
      updates[field] = v;
    } else if (field === "balance" || field === "free_funds") {
      const v = parseFloat(String(body[field]));
      if (!Number.isNaN(v) && v >= 0) updates[field] = v;
    } else {
      updates[field] = body[field] === "" ? null : body[field];
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ ok: true });
  }

  const { error } = await supabase
    .from("accounts")
    .update(updates)
    .eq("account_id", accountId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
