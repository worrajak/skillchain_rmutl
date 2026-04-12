import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createNotification, createNotifications } from "@/lib/telegram";

// POST /api/jobs/[id]/schedule — เสนอวันทำงาน
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { start_date, end_date } = await request.json();
  if (!start_date || !end_date) return NextResponse.json({ error: "ต้องระบุวันเริ่มและวันจบ" }, { status: 400 });

  const { data: job } = await supabase.from("jobs").select("*").eq("id", id).single();
  if (!job) return NextResponse.json({ error: "ไม่พบงาน" }, { status: 404 });
  if (job.status !== "ASSIGNED") return NextResponse.json({ error: "งานต้องอยู่ในสถานะ ASSIGNED" }, { status: 400 });

  // ตรวจว่าเป็น student หรือ employer ของงาน
  const isStudent = user.id === job.student_id;
  const isEmployer = user.id === job.employer_id;
  if (!isStudent && !isEmployer) return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 });

  // บันทึกวันทำงาน + ใครเสนอ
  await supabase.from("jobs").update({
    work_start_date: start_date,
    work_end_date: end_date,
    schedule_proposed_by: user.id,
    schedule_confirmed: false,
  }).eq("id", id);

  // แจ้งอีกฝ่าย
  const notifyUserId = isStudent ? job.employer_id : job.student_id;
  await createNotification(supabase, {
    user_id: notifyUserId,
    type: "schedule_proposed",
    title: "เสนอวันทำงาน",
    body: `เสนอวันทำงาน ${start_date} ถึง ${end_date} — กรุณายืนยัน`,
    link: isStudent ? `/employer/jobs/${id}` : `/student/dashboard`,
  });

  return NextResponse.json({ message: "เสนอวันทำงานแล้ว" });
}

// PATCH /api/jobs/[id]/schedule — ยืนยันวันทำงาน → IN_PROGRESS
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: job } = await supabase.from("jobs").select("*").eq("id", id).single();
  if (!job) return NextResponse.json({ error: "ไม่พบงาน" }, { status: 404 });
  if (job.status !== "ASSIGNED") return NextResponse.json({ error: "งานต้องอยู่ในสถานะ ASSIGNED" }, { status: 400 });
  if (!job.work_start_date) return NextResponse.json({ error: "ยังไม่มีการเสนอวัน" }, { status: 400 });

  // ต้องเป็นคนที่ไม่ได้เสนอ (อีกฝ่าย)
  if (user.id === job.schedule_proposed_by) {
    return NextResponse.json({ error: "คุณเป็นผู้เสนอ — ต้องให้อีกฝ่ายยืนยัน" }, { status: 400 });
  }

  const isStudent = user.id === job.student_id;
  const isEmployer = user.id === job.employer_id;
  if (!isStudent && !isEmployer) return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 });

  // ยืนยัน → IN_PROGRESS
  await supabase.from("jobs").update({
    schedule_confirmed: true,
    status: "IN_PROGRESS",
  }).eq("id", id);

  // แจ้งทุกฝ่าย
  const notifications = [
    { user_id: job.student_id, type: "job_started", title: "เริ่มงานแล้ว!", body: `วันทำงาน ${job.work_start_date} ถึง ${job.work_end_date}`, link: "/student/dashboard" },
    { user_id: job.employer_id, type: "job_started", title: "งานเริ่มแล้ว!", body: `นักศึกษาเริ่มทำงาน ${job.work_start_date} ถึง ${job.work_end_date}`, link: `/employer/jobs/${id}` },
  ];
  if (job.approved_by_staff) {
    notifications.push({ user_id: job.approved_by_staff, type: "job_started", title: "งานเริ่มแล้ว", body: `งาน "${job.title}" เข้าสู่สถานะ IN_PROGRESS`, link: "/project-staff/active-jobs" });
  }
  await createNotifications(supabase, notifications);

  return NextResponse.json({ message: "ยืนยันวันทำงานแล้ว — เริ่มงาน!" });
}
