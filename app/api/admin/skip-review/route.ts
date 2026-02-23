import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { supabase } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { isAdmin } = await import("@/lib/admin");
  if (!(await isAdmin(session.email))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const logId = body?.logId;
  const action = body?.action;
  if (logId == null || !["approve", "reject"].includes(action)) {
    return NextResponse.json(
      { error: "logId and action (approve|reject) required" },
      { status: 400 }
    );
  }
  if (action === "approve") {
    const { error } = await supabase
      .from("interest_credit_log")
      .delete()
      .eq("id", logId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { error } = await supabase
      .from("interest_credit_log")
      .update({ status: "rejected" })
      .eq("id", logId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
