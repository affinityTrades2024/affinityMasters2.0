import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getProfileByEmail } from "@/lib/profile";
import { supabase } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const profile = await getProfileByEmail(session.email);
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const currentPassword = typeof body?.currentPassword === "string" ? body.currentPassword : "";
  const newPassword = typeof body?.newPassword === "string" ? body.newPassword : "";

  if (!currentPassword || !newPassword) {
    return NextResponse.json(
      { error: "Current password and new password are required" },
      { status: 400 }
    );
  }

  const emailClean = session.email.trim().toLowerCase();
  const { data: authRow, error: fetchError } = await supabase
    .from("auth_users")
    .select("id, email, password")
    .ilike("email", emailClean)
    .maybeSingle();

  if (fetchError || !authRow) {
    return NextResponse.json(
      { error: "Invalid current password" },
      { status: 401 }
    );
  }
  if (authRow.password !== currentPassword) {
    return NextResponse.json(
      { error: "Invalid current password" },
      { status: 401 }
    );
  }

  const { error: updateError } = await supabase
    .from("auth_users")
    .update({ password: newPassword })
    .eq("id", authRow.id);

  if (updateError) {
    return NextResponse.json(
      { error: updateError.message || "Failed to update password" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
