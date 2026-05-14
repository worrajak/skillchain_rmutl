import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { recordTrustEvent } from "@/lib/trust";
import { notifyAdmin } from "@/lib/telegram";

/**
 * GET   /api/jobs/[id]/attendance       — list participants + statuses
 * PATCH /api/jobs/[id]/attendance       — bulk update attendance
 *   Body:
 *     - { auto_attend_checked_in: true }  → mark all CHECKED_IN as ATTENDED
 *     - { updates: [{ student_id, status }] }
 */

async function requireStaff(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, profile: null };
  const { data: profile } = await supabase
    .from("skc_users").select("role").eq("id", user.id).single();
  if (!profile || !["admin", "superadmin", "project_staff", "rmutl_staff", "teacher"].includes(profile.role)) {
    return { user, profile: null };
  }
  return { user, profile };
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  // Allow students to view their own attendance, but full list = staff only
  const { user, profile } = await requireStaff(supabase);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: job } = await supabase
    .from("skc_jobs")
    .select("id, title, engagement_mode, required_workers, pay_per_person, event_date, status, employer_id")
    .eq("id", id)
    .single();
  if (!job) return NextResponse.json({ error: "ไม่พบงาน" }, { status: 404 });
  if (job.engagement_mode !== "ACTIVITY") {
    return NextResponse.json({ error: "ไม่ใช่กิจกรรม" }, { status: 400 });
  }

  // Anyone authenticated can read attendance for the activity they're in;
  // staff sees all. (For MVP we let staff/employer/teacher all read.)
  if (!profile && user.id !== job.employer_id) {
    return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 });
  }

  const { data: participants } = await supabase
    .from("skc_job_workers")
    .select("student_id, role, attendance_status, checked_in_at, attended_at, paid_amount, attendance_note, student:skc_users!skc_job_workers_student_id_fkey(name, email, avatar_url)")
    .eq("job_id", id)
    .order("checked_in_at", { ascending: true, nullsFirst: false });

  return NextResponse.json({ job, participants });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { user, profile } = await requireStaff(supabase);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!profile) return NextResponse.json({ error: "เฉพาะ staff/admin/อาจารย์" }, { status: 403 });

  const body = await req.json() as {
    auto_attend_checked_in?: boolean;
    updates?: Array<{ student_id: string; status: string }>;
  };

  if (body.auto_attend_checked_in) {
    const { data: updated, error } = await supabase
      .from("skc_job_workers")
      .update({
        attendance_status: "ATTENDED",
        attended_at: new Date().toISOString(),
      })
      .eq("job_id", id)
      .eq("attendance_status", "CHECKED_IN")
      .select("student_id");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    notifyAdmin(supabase, {
      actorId: user.id,
      action: `Auto-mark ATTENDED ทั้งกลุ่ม`,
      targetType: "activity",
      targetId: id,
      link: `/admin/jobs?id=${id}`,
      severity: "info",
      extra: `${updated?.length ?? 0} คน`,
    }).catch(() => {});

    return NextResponse.json({ ok: true, updated: updated?.length ?? 0 });
  }

  if (body.updates && Array.isArray(body.updates)) {
    let updated = 0;
    for (const u of body.updates) {
      const patch: Record<string, unknown> = { attendance_status: u.status };
      if (u.status === "ATTENDED") patch.attended_at = new Date().toISOString();
      if (u.status === "CHECKED_IN") patch.checked_in_at = new Date().toISOString();
      const { error } = await supabase
        .from("skc_job_workers")
        .update(patch)
        .eq("job_id", id)
        .eq("student_id", u.student_id);
      if (!error) {
        updated++;
        // Trust events
        if (u.status === "NO_SHOW") {
          await recordTrustEvent(supabase, {
            userId: u.student_id,
            type: "NO_SHOW",
            jobId: id,
            triggeredBy: user.id,
          }).catch(() => {});
        }
      }
    }
    // Surface NO_SHOW count as alert (potential trust hit)
    const noShowCount = body.updates.filter((u) => u.status === "NO_SHOW").length;
    notifyAdmin(supabase, {
      actorId: user.id,
      action: `อัปเดต attendance (${updated} คน)`,
      targetType: "activity",
      targetId: id,
      link: `/admin/jobs?id=${id}`,
      severity: noShowCount > 0 ? "warn" : "info",
      extra: noShowCount > 0 ? `NO_SHOW: ${noShowCount} คน` : undefined,
    }).catch(() => {});

    return NextResponse.json({ ok: true, updated });
  }

  return NextResponse.json({ error: "ไม่มี action" }, { status: 400 });
}
