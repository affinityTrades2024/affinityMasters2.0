import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { supabase } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { isAdmin } = await import("@/lib/admin");
  if (!(await isAdmin(session.email))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const row: Record<string, unknown> = {};
  const cols = ["pid", "account_number", "client_id", "name", "email", "nickname", "parent_account_number", "parent_client_id", "ref_id"];
  for (const col of cols) {
    const v = body[col];
    if (v === undefined) continue;
    if (col === "pid" || col === "client_id" || col === "parent_client_id" || col === "ref_id") {
      row[col] = v === "" || v === null ? null : parseInt(String(v), 10);
    } else {
      row[col] = v === "" || v === null ? null : String(v);
    }
  }
  const { data, error } = await supabase.from("pamm_master").insert(row).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ row: data });
}
