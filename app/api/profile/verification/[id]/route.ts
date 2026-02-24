import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getProfileByEmail } from "@/lib/profile";
import { supabase } from "@/lib/supabase/server";

const BUCKET = "verification-docs";

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
    return NextResponse.json({ error: "Invalid document id" }, { status: 400 });
  }

  const { data: doc, error: fetchError } = await supabase
    .from("verification_documents")
    .select("id, file_path, client_id")
    .eq("id", id)
    .eq("client_id", profile.id)
    .maybeSingle();

  if (fetchError || !doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  await supabase.storage.from(BUCKET).remove([doc.file_path]);

  const { error: deleteError } = await supabase
    .from("verification_documents")
    .delete()
    .eq("id", id)
    .eq("client_id", profile.id);

  if (deleteError) {
    return NextResponse.json(
      { error: deleteError.message || "Failed to remove document" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
