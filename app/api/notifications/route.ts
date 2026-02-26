import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getProfileByEmail } from "@/lib/profile";
import { supabase } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";

const LIST_LIMIT = 50;

function getRecipientFilter(isAdminUser: boolean, clientId: number | null) {
  if (isAdminUser) {
    return { recipient_type: "admin" };
  }
  return { recipient_type: "user", recipient_id: clientId };
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = await isAdmin(session.email);
  const profile = await getProfileByEmail(session.email);
  const clientId = profile?.id ?? session.clientId ?? null;

  if (!admin && clientId == null) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const filter = getRecipientFilter(admin, clientId);
  const { data: rows, error } = await supabase
    .from("notifications")
    .select("id, type, title, body, link, payload, read_at, created_at")
    .match(filter)
    .order("created_at", { ascending: false })
    .limit(LIST_LIMIT);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const list = (rows || []).map((r) => ({
    id: r.id,
    type: r.type,
    title: r.title,
    body: r.body ?? null,
    link: r.link,
    payload: r.payload ?? null,
    readAt: r.read_at,
    createdAt: r.created_at,
  }));

  const unread = list.filter((n) => n.readAt == null).length;
  return NextResponse.json({ notifications: list, unread });
}

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = await isAdmin(session.email);
  const profile = await getProfileByEmail(session.email);
  const clientId = profile?.id ?? session.clientId ?? null;

  if (!admin && clientId == null) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const id = body?.id != null ? parseInt(String(body.id), 10) : NaN;
  const readAll = body?.readAll === true;

  if (readAll) {
    const filter = getRecipientFilter(admin, clientId);
    const { error: updError } = await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .match(filter)
      .is("read_at", null);
    if (updError) {
      return NextResponse.json({ error: updError.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Valid id required" }, { status: 400 });
  }

  const filter = getRecipientFilter(admin, clientId);
  const { data: row, error: fetchError } = await supabase
    .from("notifications")
    .select("id")
    .eq("id", id)
    .match(filter)
    .single();

  if (fetchError || !row) {
    return NextResponse.json({ error: "Notification not found" }, { status: 404 });
  }

  const { error: updError } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id);
  if (updError) {
    return NextResponse.json({ error: updError.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
