import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getProfileByEmail } from "@/lib/profile";
import { supabase } from "@/lib/supabase/server";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const profile = await getProfileByEmail(session.email);
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const id = parseInt((await params).id, 10);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Valid bank account id required" }, { status: 400 });
  }

  const { data: account } = await supabase
    .from("bank_accounts")
    .select("id, is_default")
    .eq("id", id)
    .eq("client_id", profile.id)
    .maybeSingle();

  if (!account) {
    return NextResponse.json({ error: "Bank account not found" }, { status: 404 });
  }

  const { error: deleteError } = await supabase
    .from("bank_accounts")
    .delete()
    .eq("id", id)
    .eq("client_id", profile.id);

  if (deleteError) {
    return NextResponse.json(
      { error: deleteError.message || "Failed to remove bank account" },
      { status: 500 }
    );
  }

  if (account.is_default) {
    const { data: remaining } = await supabase
      .from("bank_accounts")
      .select("id")
      .eq("client_id", profile.id)
      .limit(1)
      .maybeSingle();
    if (remaining) {
      await supabase
        .from("bank_accounts")
        .update({ is_default: true })
        .eq("id", remaining.id)
        .eq("client_id", profile.id);
    }
  }

  return NextResponse.json({ ok: true });
}
