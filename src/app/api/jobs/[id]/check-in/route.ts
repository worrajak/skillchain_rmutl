import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { notifyAdmin } from "@/lib/telegram";

/**
 * POST /api/jobs/[id]/check-in — student checks in to an ACTIVITY
 *
 * Triggered when a student scans the activity QR code at the event.
 * Flips attendance_status from REGISTERED → CHECKED_IN.
 *
 * Staff later confirm attendance (CHECKED_IN → ATTENDED) before release-escrow.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: job } = await supabase
    .from("skc_jobs")
    .select("id, title, engagement_mode, status, event_date")
    .eq("id", id)
    .single();
  if (!job) return NextResponse.json({ error: "ไม่พบงาน" }, { status: 404 });
  if (job.engagement_mode !== "ACTIVITY") {
    return NextResponse.json({ error: "ไม่ใช่กิจกรรม — ใช้ QR ของกิจกรรมเท่านั้น" }, { status: 400 });
  }
  if (!["ASSIGNED", "IN_PROGRESS"].includes(job.status)) {
    return NextResponse.json({ error: `กิจกรรมยังไม่เปิด check-in (สถานะ ${job.status})` }, { status: 400 });
  }

  // Find the participant row
  const { data: worker } = await supabase
    .from("skc_job_workers")
    .select("student_id, attendance_status")
    .eq("job_id", id)
    .eq("student_id", user.id)
    .maybeSingle();
  if (!worker) {
    return NextResponse.json({
      error: "คุณยังไม่ได้สมัครกิจกรรมนี้ — กรุณาสมัครก่อน check-in",
    }, { status: 403 });
  }

  if (worker.attendance_status === "CHECKED_IN" || worker.attendance_status === "ATTENDED") {
    return NextResponse.json({
      ok: true,
      already: true,
      status: worker.attendance_status,
      message: "คุณ check-in แล้ว",
    });
  }

  if (worker.attendance_status === "PAID") {
    return NextResponse.json({
      error: "กิจกรรมจบและจ่ายเงินแล้ว",
    }, { status: 400 });
  }

  // Flip to CHECKED_IN
  const { error: upErr } = await supabase
    .from("skc_job_workers")
    .update({
      attendance_status: "CHECKED_IN",
      checked_in_at: new Date().toISOString(),
    })
    .eq("job_id", id)
    .eq("student_id", user.id);
  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 500 });
  }

  // Also bump job to IN_PROGRESS if first check-in
  if (job.status === "ASSIGNED") {
    await supabase.from("skc_jobs").update({ status: "IN_PROGRESS" }).eq("id", id);
  }

  notifyAdmin(supabase, {
    actorId: user.id,
    action: "Check-in กิจกรรม",
    targetType: "activity",
    targetId: id,
    targetTitle: job.title,
    link: `/admin/jobs?id=${id}`,
    severity: "info",
  }).catch(() => {});

  return NextResponse.json({
    ok: true,
    status: "CHECKED_IN",
    message: `เช็คอินกิจกรรม "${job.title}" สำเร็จ — รอ staff confirm หลังจบกิจกรรม`,
  });
}
