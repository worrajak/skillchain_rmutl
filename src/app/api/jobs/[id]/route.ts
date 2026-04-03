import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/jobs/[id]
export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("jobs")
    .select("*, employer:users!jobs_employer_id_fkey(name, email), student:users!jobs_student_id_fkey(name, email), staff_supervisor:users!jobs_approved_by_staff_fkey(name)")
    .eq("id", id)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json(data);
}

// PATCH /api/jobs/[id] — update job
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { data, error } = await supabase.from("jobs").update(body).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}

// DELETE /api/jobs/[id] — delete with rules
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // ดึงข้อมูลงาน
  const { data: job } = await supabase.from("jobs").select("*").eq("id", id).single();
  if (!job) return NextResponse.json({ error: "ไม่พบงาน" }, { status: 404 });

  // ดึง role ของผู้ใช้
  const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single();
  const role = profile?.role ?? "student";
  const isStaff = ["admin", "superadmin", "project_staff"].includes(role);

  // Rule 1: Staff/admin ลบได้ทันทีพร้อมเหตุผล
  if (isStaff) {
    const body = await request.json().catch(() => ({}));
    // บันทึก log
    await supabase.from("behavior_logs").insert({
      user_id: user.id,
      job_id: id,
      event_type: "JOB_FORCE_DELETED",
      severity: "medium",
      description: `Admin/Staff ลบงาน: ${body.reason ?? "ไม่ระบุเหตุผล"}`,
    });
    // แจ้ง employer
    await supabase.from("notifications").insert({
      user_id: job.employer_id,
      type: "job_deleted",
      title: "งานถูกลบโดยผู้ดูแล",
      body: `งาน "${job.title}" ถูกลบ เหตุผล: ${body.reason ?? "-"}`,
      link: "/employer/jobs",
    });
    const { error } = await supabase.from("jobs").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ message: "ลบงานสำเร็จ" });
  }

  // Rule 2: เจ้าของงาน + สถานะ OPEN (ยังไม่มีคนรับ) → ลบได้เลย
  if (job.employer_id === user.id && job.status === "OPEN" && !job.student_id) {
    const { error } = await supabase.from("jobs").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ message: "ลบงานสำเร็จ" });
  }

  // Rule 3: มีคนรับแล้ว → ต้องส่งคำร้องขอยกเลิก
  if (job.employer_id === user.id && job.student_id) {
    return NextResponse.json({
      error: "งานนี้มีนักศึกษารับแล้ว กรุณาส่งคำร้องขอยกเลิกแทน",
      action: "use_cancellation_request",
    }, { status: 403 });
  }

  return NextResponse.json({ error: "ไม่มีสิทธิ์ลบงานนี้" }, { status: 403 });
}
