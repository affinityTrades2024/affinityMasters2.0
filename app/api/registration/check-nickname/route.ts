import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/server";

function suggestNicknameFromName(name: string): string {
  const s = name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
  return s.slice(0, 64) || "";
}

export async function GET(
  request: Request
): Promise<NextResponse<{ suggested: string; available: boolean } | { error: string }>> {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get("name");
  const nicknameParam = searchParams.get("nickname");

  const suggested = suggestNicknameFromName(typeof name === "string" ? name : "");
  const toCheck = typeof nicknameParam === "string" && nicknameParam.trim() !== ""
    ? nicknameParam.trim()
    : suggested;

  if (toCheck === "") {
    return NextResponse.json({ suggested, available: false });
  }

  const { data, error } = await supabase
    .from("clients")
    .select("id")
    .eq("nickname", toCheck)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    suggested,
    available: !data,
  });
}
