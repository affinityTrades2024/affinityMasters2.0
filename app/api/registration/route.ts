import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/server";

const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_UPPER = /[A-Z]/;
const PASSWORD_LOWER = /[a-z]/;
const PASSWORD_NUMBER = /[0-9]/;
const PASSWORD_SPECIAL = /[!@#$%^&*()\-_}{.+|/\\]/;

function validatePassword(password: string): string | null {
  if (typeof password !== "string" || password.length < PASSWORD_MIN_LENGTH)
    return "Password must be at least 8 characters";
  if (!PASSWORD_UPPER.test(password)) return "Password must contain at least one upper-case letter";
  if (!PASSWORD_LOWER.test(password)) return "Password must contain at least one lower-case letter";
  if (!PASSWORD_NUMBER.test(password)) return "Password must contain at least one number";
  if (!PASSWORD_SPECIAL.test(password))
    return "Password must contain at least one special character: !@#$%^&*()-_}{.+|/\\";
  return null;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = typeof body?.email === "string" ? body.email.trim() : "";
    const password = typeof body?.password === "string" ? body.password : "";
    const givenName = typeof body?.givenName === "string" ? body.givenName.trim() : "";
    const familyName = typeof body?.familyName === "string" ? body.familyName.trim() : "";
    const phone = typeof body?.phone === "string" ? body.phone.trim() : "";
    const country = typeof body?.country === "string" ? body.country.trim() : "";
    const birthday = body?.birthday;
    const nickname = typeof body?.nickname === "string" ? body.nickname.trim() : "";

    const emailClean = normalizeEmail(email);
    if (!emailClean) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailClean)) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      return NextResponse.json({ error: passwordError }, { status: 400 });
    }

    const name = [givenName, familyName].filter(Boolean).join(" ");
    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    if (!nickname) {
      return NextResponse.json({ error: "Nickname is required" }, { status: 400 });
    }

    const birthdayStr = typeof birthday === "string" ? birthday.trim() : "";
    let birthdayDate: Date | null = null;
    if (birthdayStr) {
      const d = new Date(birthdayStr);
      if (Number.isNaN(d.getTime())) {
        return NextResponse.json({ error: "Invalid date of birth" }, { status: 400 });
      }
      birthdayDate = d;
    }

    const { data, error } = await supabase.rpc("register_new_user", {
      p_email: emailClean,
      p_password: password,
      p_name: name,
      p_nickname: nickname,
      p_phone: phone || null,
      p_country: country || null,
      p_birthday: birthdayDate ? birthdayDate.toISOString().slice(0, 10) : null,
    });

    if (error) {
      const msg = error.message || "Registration failed";
      if (msg.includes("already registered")) {
        return NextResponse.json({ error: "Email already registered" }, { status: 409 });
      }
      if (msg.includes("already taken")) {
        return NextResponse.json({ error: "Nickname already taken" }, { status: 409 });
      }
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    return NextResponse.json({ ok: true, clientId: data?.clientId, accountNumber: data?.accountNumber });
  } catch (e) {
    console.error("Registration error", e);
    return NextResponse.json({ error: "Registration failed" }, { status: 500 });
  }
}
