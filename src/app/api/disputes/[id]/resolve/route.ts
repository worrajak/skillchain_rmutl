import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { hashReviewContent } from "@/lib/credential";

// POST /api/disputes/[id]/resolve — arbitrator resolves dispute
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // ตรวจสอบ role
  const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single();
  if (!profile || !["admin", "superadmin", "project_staff"].includes(profile.role)) {
    return NextResponse.json({ error: "เฉพาะ staff/admin เท่านั้น" }, { status: 403 });
  }

  const body = await request.json();
  const { status, resolution, resolution_terms } = body;

  // Validate status
  const validStatuses = ["RESOLVED_STUDENT_FAVOR", "RESOLVED_EMPLOYER_FAVOR", "RESOLVED_COMPROMISE", "ESCALATED", "CLOSED"];
  if (!status || !validStatuses.includes(status)) {
    return NextResponse.json({ error: `สถานะไม่ถูกต้อง ต้องเป็น: ${validStatuses.join(", ")}` }, { status: 400 });
  }
  if (!resolution) {
    return NextResponse.json({ error: "กรุณาระบุผลการตัดสิน" }, { status: 400 });
  }

  const contentHash = await hashReviewContent({ id, status, resolution, resolution_terms, resolved_by: user.id, resolved_at: new Date().toISOString() });

  const { data, error } = await supabase.from("disputes").update({
    status,
    resolution,
    resolution_terms: resolution_terms ?? null,
    arbitrator_id: user.id,
    content_hash: contentHash,
    resolved_at: new Date().toISOString(),
  }).eq("id", id).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // แจ้งทั้งสองฝ่าย
  if (data) {
    await supabase.from("notifications").insert([
      { user_id: data.raised_by, type: "dispute_resolved", title: "ข้อพิพาทได้รับการตัดสิน", body: resolution?.slice(0, 100) ?? "", link: `/admin/disputes` },
      { user_id: data.raised_against, type: "dispute_resolved", title: "ข้อพิพาทได้รับการตัดสิน", body: resolution?.slice(0, 100) ?? "", link: `/admin/disputes` },
    ]);
  }

  return NextResponse.json(data);
}
