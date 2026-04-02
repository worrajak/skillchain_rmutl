import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// POST /api/jobs/[id]/approve — staff approves student assignment
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single();
  if (!profile || !["admin", "superadmin", "project_staff", "teacher"].includes(profile.role)) {
    return NextResponse.json({ error: "เฉพาะ staff/admin/อาจารย์" }, { status: 403 });
  }

  const body = await request.json();
  const { request_id, action, review_note } = body; // action: 'APPROVED' | 'REJECTED'

  // อัปเดต assignment request
  const { data: req, error } = await supabase.from("job_assignment_requests")
    .update({ status: action, reviewed_by: user.id, review_note, reviewed_at: new Date().toISOString() })
    .eq("id", request_id)
    .select("*, student:users!job_assignment_requests_student_id_fkey(name)")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // ถ้า approve → assign student to job
  if (action === "APPROVED" && req) {
    await supabase.from("jobs").update({ student_id: req.student_id, status: "ASSIGNED" }).eq("id", id);

    // สร้าง chat room
    await supabase.from("job_chat_rooms").insert({ job_id: id }).select().single();

    // แจ้ง student
    await supabase.from("notifications").insert({
      user_id: req.student_id,
      type: "job_assigned",
      title: "ได้รับงานแล้ว!",
      body: `คุณได้รับมอบหมายงาน — เข้าดูรายละเอียดได้เลย`,
      link: `/student/jobs`,
    });
  }

  if (action === "REJECTED" && req) {
    await supabase.from("notifications").insert({
      user_id: req.student_id,
      type: "job_rejected",
      title: "คำขอรับงานถูกปฏิเสธ",
      body: review_note ?? "ไม่ผ่านการอนุมัติ",
      link: `/student/jobs`,
    });
  }

  return NextResponse.json(req);
}
