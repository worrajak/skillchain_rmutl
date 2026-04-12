import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createNotification, createNotifications } from "@/lib/telegram";

// POST /api/jobs/[id]/confirm-completion — staff หรือ employer ยืนยันงานเสร็จ
export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: job } = await supabase.from("jobs").select("*").eq("id", id).single();
  if (!job) return NextResponse.json({ error: "ไม่พบงาน" }, { status: 404 });
  if (job.status !== "SUBMITTED") return NextResponse.json({ error: "งานต้องอยู่ในสถานะ SUBMITTED" }, { status: 400 });

  const isStaff = user.id === job.approved_by_staff;
  const isEmployer = user.id === job.employer_id;
  if (!isStaff && !isEmployer) return NextResponse.json({ error: "เฉพาะ Staff ผู้กำกับ หรือ ผู้ว่าจ้าง" }, { status: 403 });

  // อัปเดต confirmation
  const updates: Record<string, unknown> = {};
  if (isStaff) updates.staff_confirmed_completion = true;
  if (isEmployer) updates.employer_confirmed_completion = true;
  await supabase.from("jobs").update(updates).eq("id", id);

  // ดึงข้อมูลล่าสุด
  const { data: updated } = await supabase.from("jobs").select("*").eq("id", id).single();
  if (!updated) return NextResponse.json({ error: "Error" }, { status: 500 });

  // ถ้าทั้ง 2 ฝ่ายยืนยัน → COMPLETED
  if (updated.staff_confirmed_completion && updated.employer_confirmed_completion) {
    await supabase.from("jobs").update({
      status: "COMPLETED",
      // eval window จะถูกตั้งโดย DB trigger อัตโนมัติ
    }).eq("id", id);

    // แจ้งทุกฝ่าย
    const notifications = [
      { user_id: job.student_id, type: "job_completed", title: "งานเสร็จสมบูรณ์!", body: `งาน "${job.title}" เสร็จแล้ว — พร้อมเข้าสู่ระบบประเมิน`, link: "/student/dashboard" },
      { user_id: job.employer_id, type: "job_completed", title: "งานเสร็จสมบูรณ์!", body: `งาน "${job.title}" เสร็จแล้ว — กรุณาประเมินนักศึกษา`, link: `/employer/jobs/${id}` },
    ];
    if (job.approved_by_staff) {
      notifications.push({ user_id: job.approved_by_staff, type: "job_completed", title: "งานเสร็จสมบูรณ์", body: `งาน "${job.title}" — Staff + Employer ยืนยันแล้ว`, link: "/project-staff/active-jobs" });
    }
    await createNotifications(supabase, notifications);

    return NextResponse.json({ message: "ยืนยันครบแล้ว — งานเสร็จสมบูรณ์!", completed: true });
  }

  // แจ้งอีกฝ่ายที่ยังไม่ยืนยัน
  const pendingParty = !updated.staff_confirmed_completion ? job.approved_by_staff : job.employer_id;
  if (pendingParty) {
    await createNotification(supabase, {
      user_id: pendingParty,
      type: "completion_pending",
      title: "รอการยืนยันงานเสร็จ",
      body: `งาน "${job.title}" — อีกฝ่ายยืนยันแล้ว กรุณายืนยันด้วย`,
      link: isStaff ? `/employer/jobs/${id}` : "/project-staff/active-jobs",
    });
  }

  return NextResponse.json({
    message: "ยืนยันแล้ว — รออีกฝ่ายยืนยัน",
    completed: false,
    staff_confirmed: updated.staff_confirmed_completion,
    employer_confirmed: updated.employer_confirmed_completion,
  });
}
