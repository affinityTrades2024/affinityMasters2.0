import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { supabase } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { isAdmin } = await import("@/lib/admin");
  if (!(await isAdmin(session.email))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const id = body?.id;
  const column = body?.column;
  const value = body?.value;
  if (id == null || !column || typeof column !== "string") {
    return NextResponse.json({ error: "id and column required" }, { status: 400 });
  }
  const allowed = ["pid", "account_number", "client_id", "name", "email", "nickname", "parent_account_number", "parent_client_id", "ref_id"];
  if (!allowed.includes(column)) {
    return NextResponse.json({ error: "Invalid column" }, { status: 400 });
  }
  const { error } = await supabase
    .from("pamm_master")
    .update({ [column]: value })
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
