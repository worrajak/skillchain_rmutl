import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/gov/batches/[id]/upload-pdf
 * Multipart form with field `file` — the signed PDF (or scan).
 * Stored in Supabase Storage bucket `official-documents` and recorded in batch.document_pdf_url.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("skc_users").select("role").eq("id", user.id).single();
  if (!profile || !["admin", "superadmin", "project_staff", "rmutl_staff"].includes(profile.role)) {
    return NextResponse.json({ error: "เฉพาะคณะทำงาน/แอดมิน" }, { status: 403 });
  }

  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "ไม่พบไฟล์" }, { status: 400 });
  }
  if (!file.type.includes("pdf") && !file.type.startsWith("image/")) {
    return NextResponse.json({ error: "รับเฉพาะไฟล์ PDF หรือรูปภาพ" }, { status: 400 });
  }

  // Upload to Supabase Storage
  const arrayBuffer = await file.arrayBuffer();
  const ext = file.name.split(".").pop() || "pdf";
  const path = `batches/${id}/signed-${Date.now()}.${ext}`;
  const { error: upErr } = await supabase.storage
    .from("official-documents")
    .upload(path, arrayBuffer, {
      contentType: file.type,
      upsert: false,
    });
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  const { data: urlData } = supabase.storage.from("official-documents").getPublicUrl(path);
  const publicUrl = urlData.publicUrl;

  // Update batch row
  await supabase
    .from("skc_gov_approval_batches")
    .update({ document_pdf_url: publicUrl })
    .eq("id", id);

  return NextResponse.json({ ok: true, url: publicUrl });
}
