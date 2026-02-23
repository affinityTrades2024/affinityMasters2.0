import { NextResponse } from "next/server";
import { clearSession } from "@/lib/auth";

export async function GET(request: Request) {
  await clearSession();
  const url = new URL(request.url);
  const origin = url.origin;
  return NextResponse.redirect(new URL("/auth/login", origin));
}

export async function POST() {
  await clearSession();
  return NextResponse.json({ ok: true });
}
