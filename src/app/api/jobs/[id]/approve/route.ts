import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createNotification } from "@/lib/telegram";

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

  // ถ้า approve → assign student to job + บันทึก staff supervisor
  if (action === "APPROVED" && req) {
    // ดึงข้อมูลงานเพื่อหา employer_id
    const { data: job } = await supabase.from("jobs").select("employer_id, title").eq("id", id).single();

    await supabase.from("jobs").update({
      student_id: req.student_id,
      status: "ASSIGNED",
      approved_by_staff: user.id,
      staff_approval_at: new Date().toISOString(),
    }).eq("id", id);

    // สร้าง chat room
    await supabase.from("job_chat_rooms").insert({ job_id: id }).select().single();

    // แจ้ง student
    await createNotification(supabase, {
      user_id: req.student_id,
      type: "job_assigned",
      title: "ได้รับงานแล้ว!",
      body: `คุณได้รับมอบหมายงาน "${job?.title}" — กรุณาประสานวันทำงานกับผู้ว่าจ้าง`,
      link: `/student/dashboard`,
    });

    // แจ้ง employer ว่ามี นศ. แล้ว
    if (job?.employer_id) {
      await createNotification(supabase, {
        user_id: job.employer_id,
        type: "job_assigned",
        title: "นักศึกษาได้รับมอบหมายแล้ว",
        body: `งาน "${job.title}" มีนักศึกษารับแล้ว — กรุณากำหนดวันทำงาน`,
        link: `/employer/jobs/${id}`,
      });
    }
  }

  if (action === "REJECTED" && req) {
    await createNotification(supabase, {
      user_id: req.student_id,
      type: "job_rejected",
      title: "คำขอรับงานถูกปฏิเสธ",
      body: review_note ?? "ไม่ผ่านการอนุมัติ",
      link: `/student/jobs`,
    });
  }

  return NextResponse.json(req);
}
