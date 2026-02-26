import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getProfileByEmail } from "@/lib/profile";
import { supabase } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = await isAdmin(session.email);
  const profile = await getProfileByEmail(session.email);
  const clientId = profile?.id ?? session.clientId ?? null;

  if (!admin && clientId == null) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const filter = admin
    ? { recipient_type: "admin" }
    : { recipient_type: "user", recipient_id: clientId };

  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .match(filter)
    .is("read_at", null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ unread: count ?? 0 });
}
