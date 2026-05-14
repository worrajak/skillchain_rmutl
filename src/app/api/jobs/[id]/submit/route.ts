import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createNotifications, notifyAdmin } from "@/lib/telegram";

// POST /api/jobs/[id]/submit — นศ. ส่งงาน
export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: job } = await supabase.from("skc_jobs").select("*").eq("id", id).single();
  if (!job) return NextResponse.json({ error: "ไม่พบงาน" }, { status: 404 });
  if (user.id !== job.student_id) return NextResponse.json({ error: "เฉพาะนักศึกษาที่รับงาน" }, { status: 403 });

  // อนุญาตส่งงานจาก CONFIRMED หรือ IN_PROGRESS (ข้าม start-work step ได้)
  if (!["CONFIRMED", "IN_PROGRESS"].includes(job.status)) {
    return NextResponse.json(
      { error: `ไม่สามารถส่งงานในสถานะ "${job.status}" — งานต้องอยู่ในสถานะ CONFIRMED หรือ IN_PROGRESS` },
      { status: 400 },
    );
  }

  // ตรวจรูปงานเสร็จ — บังคับมีอย่างน้อย 1 รูป
  const { count } = await supabase
    .from("skc_job_images")
    .select("id", { count: "exact", head: true })
    .eq("job_id", id)
    .eq("image_type", "completion");
  if (!count || count < 1) {
    return NextResponse.json(
      { error: "ต้องอัปโหลดรูปงานเสร็จอย่างน้อย 1 รูปก่อนส่งมอบงาน" },
      { status: 400 },
    );
  }

  // ส่งงาน
  await supabase.from("skc_jobs").update({
    status: "SUBMITTED",
    staff_confirmed_completion: false,
    employer_confirmed_completion: false,
  }).eq("id", id);

  // แจ้ง staff + employer
  const notifications = [
    { user_id: job.employer_id, type: "job_submitted", title: "นักศึกษาส่งงานแล้ว", body: `งาน "${job.title}" — กรุณาตรวจสอบและยืนยัน`, link: `/employer/jobs/${id}` },
  ];
  if (job.approved_by_staff) {
    notifications.push({ user_id: job.approved_by_staff, type: "job_submitted", title: "นักศึกษาส่งงานแล้ว", body: `งาน "${job.title}" — กรุณายืนยันงานเสร็จ`, link: "/project-staff/active-jobs" });
  }
  await createNotifications(supabase, notifications);

  notifyAdmin(supabase, {
    actorId: user.id,
    action: "ส่งงาน (รอ Staff + ผู้จ้างยืนยัน)",
    targetType: "job",
    targetId: id,
    targetTitle: job.title,
    link: `/admin/jobs?id=${id}`,
    severity: "info",
  }).catch(() => {});

  return NextResponse.json({ message: "ส่งงานแล้ว — รอ Staff และผู้ว่าจ้างยืนยัน" });
}
