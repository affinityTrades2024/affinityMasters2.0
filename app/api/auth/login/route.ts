import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/server";
import { setSession, normalizeEmail } from "@/lib/auth";
import { getProfileByEmail } from "@/lib/profile";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = body?.email;
    const password = body?.password;
    if (!email || typeof password !== "string") {
      return NextResponse.json(
        { error: "Email and password required" },
        { status: 400 }
      );
    }
    const emailClean = normalizeEmail(email);
    const { data: authRow, error: authError } = await supabase
      .from("auth_users")
      .select("id, email, password")
      .ilike("email", emailClean)
      .maybeSingle();

    if (authError || !authRow) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }
    if (authRow.password !== password) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }
    const profile = await getProfileByEmail(authRow.email);
    await setSession({
      email: authRow.email,
      clientId: profile?.id ?? null,
    });
    return NextResponse.json({ ok: true, clientId: profile?.id });
  } catch (e) {
    console.error("Login error", e);
    return NextResponse.json(
      { error: "Login failed" },
      { status: 500 }
    );
  }
}
