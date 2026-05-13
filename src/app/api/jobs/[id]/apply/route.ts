import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createNotification } from "@/lib/telegram";

/**
 * POST /api/jobs/[id]/apply — student applies to a job.
 *
 * Routing:
 *   - engagement_mode = ACTIVITY + registration_mode = FCFS
 *       → insert directly into skc_job_workers (PARTICIPANT, REGISTERED)
 *       → enforce capacity atomically (count + 1 ≤ required_workers)
 *   - else (SOLO/TEAM)
 *       → insert into skc_job_assignment_requests (legacy curated flow)
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Only students can apply
  const { data: profile } = await supabase
    .from("skc_users").select("role, name").eq("id", user.id).single();
  if (!profile || profile.role !== "student") {
    return NextResponse.json({ error: "เฉพาะนักศึกษา" }, { status: 403 });
  }

  const { data: job } = await supabase
    .from("skc_jobs")
    .select("id, title, engagement_mode, registration_mode, required_workers, status, employer_id")
    .eq("id", id)
    .single();
  if (!job) return NextResponse.json({ error: "ไม่พบงาน" }, { status: 404 });
  if (job.status !== "OPEN") {
    return NextResponse.json({ error: "งานไม่ได้เปิดรับ" }, { status: 400 });
  }

  // ─── ACTIVITY + FCFS auto-approve ───
  if (job.engagement_mode === "ACTIVITY" && job.registration_mode === "FCFS") {
    // Check current count atomically
    const { count: currentCount } = await supabase
      .from("skc_job_workers")
      .select("*", { count: "exact", head: true })
      .eq("job_id", id);
    if ((currentCount ?? 0) >= job.required_workers) {
      return NextResponse.json({ error: "กิจกรรมเต็มแล้ว" }, { status: 409 });
    }

    // Already registered?
    const { data: existing } = await supabase
      .from("skc_job_workers")
      .select("student_id")
      .eq("job_id", id)
      .eq("student_id", user.id)
      .maybeSingle();
    if (existing) {
      return NextResponse.json({ error: "คุณสมัครกิจกรรมนี้ไปแล้ว" }, { status: 409 });
    }

    // Insert as PARTICIPANT
    const { error: insErr } = await supabase.from("skc_job_workers").insert({
      job_id: id,
      student_id: user.id,
      role: "PARTICIPANT",
      attendance_status: "REGISTERED",
      added_by: user.id,
    });
    if (insErr) {
      return NextResponse.json({ error: insErr.message }, { status: 500 });
    }

    // If activity is now full → flip to ASSIGNED
    const newCount = (currentCount ?? 0) + 1;
    if (newCount >= job.required_workers) {
      await supabase
        .from("skc_jobs")
        .update({ status: "ASSIGNED" })
        .eq("id", id);
    }

    // Notify employer
    if (job.employer_id) {
      await createNotification(supabase, {
        user_id: job.employer_id,
        type: "activity_registration",
        title: `มีผู้สมัครกิจกรรม "${job.title}"`,
        body: `${profile.name ?? "นักศึกษา"} ลงทะเบียนเข้าร่วมกิจกรรม (${newCount}/${job.required_workers})`,
        link: `/employer/jobs/${id}`,
      });
    }

    return NextResponse.json({
      ok: true,
      mode: "ACTIVITY_FCFS",
      registered: newCount,
      capacity: job.required_workers,
      full: newCount >= job.required_workers,
    });
  }

  // ─── SOLO/TEAM — curated flow via assignment_request ───
  const { error: reqErr } = await supabase
    .from("skc_job_assignment_requests")
    .insert({ job_id: id, student_id: user.id });
  if (reqErr) {
    if (reqErr.code === "23505") {
      return NextResponse.json({ error: "คุณส่งคำขอรับงานนี้ไปแล้ว" }, { status: 409 });
    }
    return NextResponse.json({ error: reqErr.message }, { status: 500 });
  }

  // Notify staff
  const { data: staffUsers } = await supabase
    .from("skc_users")
    .select("id")
    .in("role", ["project_staff", "rmutl_staff", "admin", "superadmin"])
    .eq("approval_status", "APPROVED");
  if (staffUsers) {
    for (const s of staffUsers) {
      await createNotification(supabase, {
        user_id: s.id as string,
        type: "assignment_request",
        title: "คำขอรับงานใหม่",
        body: `${profile.name ?? "นักศึกษา"} ส่งคำขอรับงาน "${job.title}"`,
        link: "/project-staff/approvals",
      });
    }
  }

  return NextResponse.json({ ok: true, mode: "REQUEST_PENDING" });
}
