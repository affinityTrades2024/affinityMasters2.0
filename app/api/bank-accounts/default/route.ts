import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getProfileByEmail } from "@/lib/profile";
import { supabase } from "@/lib/supabase/server";

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const profile = await getProfileByEmail(session.email);
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await request.json().catch(() => ({}));
  const id =
    body?.id != null ? parseInt(String(body.id), 10) : NaN;
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Valid bank account id required" }, { status: 400 });
  }

  const { data: account } = await supabase
    .from("bank_accounts")
    .select("id")
    .eq("id", id)
    .eq("client_id", profile.id)
    .maybeSingle();

  if (!account) {
    return NextResponse.json({ error: "Bank account not found" }, { status: 404 });
  }

  await supabase
    .from("bank_accounts")
    .update({ is_default: false })
    .eq("client_id", profile.id);

  const { error } = await supabase
    .from("bank_accounts")
    .update({ is_default: true })
    .eq("id", id)
    .eq("client_id", profile.id);

  if (error) {
    return NextResponse.json(
      { error: error.message || "Failed to set default" },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true });
}
