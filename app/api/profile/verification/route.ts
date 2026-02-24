import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getProfileByEmail } from "@/lib/profile";
import { supabase } from "@/lib/supabase/server";

const BUCKET = "verification-docs";
const MAX_TOTAL_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIMES = ["image/png", "image/jpeg", "image/jpg", "application/pdf"];

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const profile = await getProfileByEmail(session.email);
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { data, error } = await supabase
      .from("verification_documents")
      .select("id, description, file_path, file_size_bytes, mime_type, created_at")
      .eq("client_id", profile.id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    const totalBytes = (data || []).reduce((sum, row) => sum + Number(row.file_size_bytes || 0), 0);

    return NextResponse.json({
      documents: data || [],
      totalBytes,
      maxBytes: MAX_TOTAL_BYTES,
    });
  } catch (e) {
    console.error("Verification list error", e);
    return NextResponse.json(
      { error: "Failed to load documents" },
      { status: 500 }
    );
  }
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100) || "file";
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const profile = await getProfileByEmail(session.email);
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  const descriptionRaw = formData.get("description");
  const description =
    typeof descriptionRaw === "string" ? descriptionRaw.trim() : "";

  if (!file || file.size === 0) {
    return NextResponse.json({ error: "File is required" }, { status: 400 });
  }
  if (!description) {
    return NextResponse.json({ error: "Description is required" }, { status: 400 });
  }

  const mimeType = file.type || "";
  if (!ALLOWED_MIMES.includes(mimeType)) {
    return NextResponse.json(
      { error: "Only PNG, JPG, and PDF files are allowed" },
      { status: 400 }
    );
  }

  const fileSize = file.size;
  if (fileSize > MAX_TOTAL_BYTES) {
    return NextResponse.json(
      { error: "File size exceeds 10MB limit" },
      { status: 400 }
    );
  }

  const { data: existing } = await supabase
    .from("verification_documents")
    .select("file_size_bytes")
    .eq("client_id", profile.id);
  const currentTotal = (existing || []).reduce(
    (sum, row) => sum + Number(row.file_size_bytes || 0),
    0
  );
  if (currentTotal + fileSize > MAX_TOTAL_BYTES) {
    return NextResponse.json(
      {
        error: `Total storage limit is 10MB. You have ${(currentTotal / 1024 / 1024).toFixed(2)}MB used. This file would exceed the limit.`,
      },
      { status: 400 }
    );
  }

  const { data: dup } = await supabase
    .from("verification_documents")
    .select("id")
    .eq("client_id", profile.id)
    .eq("description", description)
    .maybeSingle();
  if (dup) {
    return NextResponse.json(
      { error: "A document with this description already exists" },
      { status: 400 }
    );
  }

  const safeName = sanitizeFilename(file.name || "document");
  const path = `${profile.id}/${Date.now()}_${safeName}`;

  const arrayBuffer = await file.arrayBuffer();
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, arrayBuffer, {
      contentType: mimeType,
      upsert: false,
    });

  if (uploadError) {
    console.error("Storage upload error", uploadError);
    return NextResponse.json(
      { error: uploadError.message || "Upload failed" },
      { status: 500 }
    );
  }

  const { data: inserted, error: insertError } = await supabase
    .from("verification_documents")
    .insert({
      client_id: profile.id,
      description,
      file_path: path,
      file_size_bytes: fileSize,
      mime_type: mimeType,
    })
    .select("id, description, file_path, file_size_bytes, mime_type, created_at")
    .single();

  if (insertError) {
    await supabase.storage.from(BUCKET).remove([path]);
    return NextResponse.json(
      { error: insertError.message || "Failed to save document record" },
      { status: 500 }
    );
  }

  return NextResponse.json(inserted);
}
