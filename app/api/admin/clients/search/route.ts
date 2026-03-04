import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { supabase } from "@/lib/supabase/server";

const LIMIT = 20;

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isAdmin(session.email))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";

  const base = supabase
    .from("accounts")
    .select("account_id, account_number, client_name, email, client_id")
    .or("type.eq.investment,type.is.null,product.eq.PAMM Investor")
    .not("platform", "ilike", "%demo%")
    .not("client_id", "is", null)
    .order("account_number")
    .limit(LIMIT);

  const term = q.replace(/\*/g, "");
  const query = term
    ? base.or(
        `account_number.ilike.*${term}*,client_name.ilike.*${term}*,email.ilike.*${term}*`
      )
    : base;

  const { data: rows, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const list = (rows || []).map((r: { account_id: number; account_number: string | null; client_name: string | null; email: string | null; client_id: number | null }) => ({
    clientId: r.client_id,
    name: (r.client_name as string) ?? "",
    email: (r.email as string) ?? "",
    accountNumber: String(r.account_number ?? r.account_id),
    accountId: r.account_id,
  }));

  return NextResponse.json({ clients: list });
}
