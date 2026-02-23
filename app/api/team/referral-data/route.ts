import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getProfileByEmail } from "@/lib/profile";
import { supabase } from "@/lib/supabase/server";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const profile = await getProfileByEmail(session.email);
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: pamm } = await supabase
    .from("pamm_master")
    .select("id, account_number, name, ref_id")
    .eq("client_id", profile.id);
  return NextResponse.json({ pamm: pamm || [] });
}
