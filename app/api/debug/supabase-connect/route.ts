import { NextResponse } from "next/server";

/**
 * Debug route: test connectivity to Supabase from the Next.js server.
 * Open GET /api/debug/supabase-connect to see the actual error if fetch fails.
 * Remove or protect this route in production.
 */
export async function GET() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    return NextResponse.json({
      ok: false,
      error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env",
    });
  }

  const apiUrl = `${url.replace(/\/$/, "")}/rest/v1/auth_users?select=id&limit=1`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(apiUrl, {
      method: "GET",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({
        ok: false,
        error: `Supabase returned ${res.status}`,
        details: text.slice(0, 500),
      });
    }
    return NextResponse.json({ ok: true, message: "Connected to Supabase" });
  } catch (e) {
    clearTimeout(timeout);
    const err = e instanceof Error ? e : new Error(String(e));
    const cause = err.cause instanceof Error ? err.cause : null;
    return NextResponse.json(
      {
        ok: false,
        error: err.message,
        cause: cause?.message ?? (err.cause ? String(err.cause) : null),
        name: err.name,
        code: cause && "code" in cause ? (cause as NodeJS.ErrnoException).code : null,
      },
      { status: 503 }
    );
  }
}
