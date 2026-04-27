import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createNotification } from "@/lib/telegram";

// GET /api/jobs/[id]
export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  // Try with staff_supervisor join first, fallback without it
  let { data, error } = await supabase
    .from("skc_jobs")
    .select("*, employer:skc_users!skc_jobs_employer_id_fkey(name, email), student:skc_users!skc_jobs_student_id_fkey(name, email, avatar_url), staff_supervisor:skc_users!skc_jobs_approved_by_staff_fkey(name)")
    .eq("id", id)
    .single();

  if (error) {
    // Fallback: query without staff_supervisor join (FK may not exist yet)
    const result = await supabase
      .from("skc_jobs")
      .select("*, employer:skc_users!skc_jobs_employer_id_fkey(name, email), student:skc_users!skc_jobs_student_id_fkey(name, email, avatar_url)")
      .eq("id", id)
      .single();
    data = result.data;
    error = result.error;

    // If still error, it's a real 404
    if (error) return NextResponse.json({ error: error.message }, { status: 404 });

    // Try to get staff name separately
    if (data?.approved_by_staff) {
      const { data: staff } = await supabase.from("skc_users").select("name").eq("id", data.approved_by_staff).single();
      (data as Record<string, unknown>).staff_supervisor = staff;
    }
  }

  return NextResponse.json(data);
}

// PATCH /api/jobs/[id] — update job (restricted fields + ownership check)
const ALLOWED_PATCH_FIELDS = [
  "title", "description", "type", "job_category", "location", "campus",
  "pay_amount", "deadline", "hiring_mode", "is_mentorship",
];

const VALID_JOB_TRANSITIONS: Record<string, string[]> = {
  PENDING_REVIEW: ["CANCELLED"],
  OPEN: ["ASSIGNED", "CANCELLED"],
  ASSIGNED: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["SUBMITTED", "DISPUTED", "CANCELLED"],
  SUBMITTED: ["COMPLETED", "DISPUTED"],
};

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("skc_users").select("role").eq("id", user.id).single();
  const role = profile?.role ?? "student";
  const isStaff = ["admin", "superadmin", "project_staff", "rmutl_staff", "teacher"].includes(role);

  // Get current job
  const { data: job } = await supabase.from("skc_jobs").select("employer_id, status").eq("id", id).single();
  if (!job) return NextResponse.json({ error: "ไม่พบงาน" }, { status: 404 });

  // Only owner or staff can update
  if (job.employer_id !== user.id && !isStaff) {
    return NextResponse.json({ error: "ไม่มีสิทธิ์แก้ไขงานนี้" }, { status: 403 });
  }

  const body = await request.json();

  // Validate status transition if status is being changed
  if (body.status && body.status !== job.status) {
    const allowed = VALID_JOB_TRANSITIONS[job.status];
    if (!isStaff && (!allowed || !allowed.includes(body.status))) {
      return NextResponse.json({ error: `ไม่สามารถเปลี่ยนสถานะจาก ${job.status} เป็น ${body.status}` }, { status: 400 });
    }
  }

  // Whitelist fields (staff can also set status)
  const allowedKeys = isStaff ? [...ALLOWED_PATCH_FIELDS, "status"] : ALLOWED_PATCH_FIELDS;
  const safeBody: Record<string, unknown> = {};
  for (const key of allowedKeys) {
    if (key in body) safeBody[key] = body[key];
  }

  // Validate pay_amount
  if (safeBody.pay_amount !== undefined) {
    const pay = Number(safeBody.pay_amount);
    if (!Number.isFinite(pay) || pay < 0 || pay > 1000000) {
      return NextResponse.json({ error: "ค่าตอบแทนต้องอยู่ระหว่าง 0-1,000,000" }, { status: 400 });
    }
  }

  if (Object.keys(safeBody).length === 0) {
    return NextResponse.json({ error: "ไม่มีฟิลด์ที่อนุญาตให้แก้ไข" }, { status: 400 });
  }

  const { data, error } = await supabase.from("skc_jobs").update(safeBody).eq("id", id).select().single();
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
  const { data: job } = await supabase.from("skc_jobs").select("*").eq("id", id).single();
  if (!job) return NextResponse.json({ error: "ไม่พบงาน" }, { status: 404 });

  // ดึง role ของผู้ใช้
  const { data: profile } = await supabase.from("skc_users").select("role").eq("id", user.id).single();
  const role = profile?.role ?? "student";
  const isStaff = ["admin", "superadmin", "project_staff"].includes(role);

  // Rule 1: Staff/admin ลบได้ทันทีพร้อมเหตุผล
  if (isStaff) {
    const body = await request.json().catch(() => ({}));
    // บันทึก log
    await supabase.from("skc_behavior_logs").insert({
      user_id: user.id,
      job_id: id,
      event_type: "JOB_FORCE_DELETED",
      severity: "medium",
      description: `Admin/Staff ลบงาน: ${body.reason ?? "ไม่ระบุเหตุผล"}`,
    });
    // แจ้ง employer
    await createNotification(supabase, {
      user_id: job.employer_id,
      type: "job_deleted",
      title: "งานถูกลบโดยผู้ดูแล",
      body: `งาน "${job.title}" ถูกลบ เหตุผล: ${body.reason ?? "-"}`,
      link: "/employer/jobs",
    });
    const { error } = await supabase.from("skc_jobs").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ message: "ลบงานสำเร็จ" });
  }

  // Rule 2: เจ้าของงาน + สถานะ OPEN (ยังไม่มีคนรับ) → ลบได้เลย
  if (job.employer_id === user.id && job.status === "OPEN" && !job.student_id) {
    const { error } = await supabase.from("skc_jobs").delete().eq("id", id);
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
