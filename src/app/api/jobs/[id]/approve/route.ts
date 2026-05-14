import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createNotification, notifyAdmin } from "@/lib/telegram";
import { checkCanAssign } from "@/lib/gov-sync";
import { checkTierAccess } from "@/lib/skill-credits";
import { type JobTier } from "@/lib/terminology";

// POST /api/jobs/[id]/approve — staff approves student assignment
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("skc_users").select("role").eq("id", user.id).single();
  if (!profile || !["admin", "superadmin", "project_staff", "teacher"].includes(profile.role)) {
    return NextResponse.json({ error: "เฉพาะ staff/admin/อาจารย์" }, { status: 403 });
  }

  const body = await request.json();
  const { request_id, action, review_note } = body; // action: 'APPROVED' | 'REJECTED'

  // ===== GOV GATE CHECK =====
  // ถ้า approve → ต้องได้อนุมัติกิจกรรมจากคณบดี/ผู้มีอำนาจก่อน
  if (action === "APPROVED") {
    const gate = await checkCanAssign(supabase, id);
    if (!gate.allowed) {
      return NextResponse.json({
        error: gate.reason,
        suggestedAction: gate.suggestedAction,
        currentGovStatus: gate.currentGovStatus,
        hint: "ไปที่ /staff/gov เพื่อตรวจสอบสถานะเอกสารราชการ",
      }, { status: 403 });
    }

    // ===== TIER GATE CHECK =====
    // ตรวจว่า นศ. มีระดับทักษะถึงที่งานต้องการหรือไม่
    const { data: jobTier } = await supabase.from("skc_jobs").select("required_tier").eq("id", id).single();
    const { data: req } = await supabase.from("skc_job_assignment_requests").select("student_id").eq("id", request_id).single();
    if (jobTier?.required_tier && req?.student_id && jobTier.required_tier !== "TIER_1") {
      const tierGate = await checkTierAccess(supabase, req.student_id, jobTier.required_tier as JobTier);
      if (!tierGate.allowed) {
        return NextResponse.json({
          error: `นักศึกษาระดับ "${tierGate.userLevel}" ไม่สามารถรับงานระดับ "${tierGate.requiredLevel}" ได้`,
          suggestedAction: tierGate.reason,
          userLevel: tierGate.userLevel,
          requiredLevel: tierGate.requiredLevel,
          creditsNeeded: tierGate.creditsNeeded,
        }, { status: 403 });
      }
    }
  }

  // อัปเดต assignment request
  const { data: req, error } = await supabase.from("skc_job_assignment_requests")
    .update({ status: action, reviewed_by: user.id, review_note, reviewed_at: new Date().toISOString() })
    .eq("id", request_id)
    .select("*, student:skc_users!skc_job_assignment_requests_student_id_fkey(name)")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // ถ้า approve → add to team + (if full) set status ASSIGNED
  if (action === "APPROVED" && req) {
    // ดึงข้อมูลงาน + จำนวนคนที่ต้องการ + ทีมปัจจุบัน
    const { data: job } = await supabase
      .from("skc_jobs")
      .select("employer_id, title, required_workers, student_id, status")
      .eq("id", id)
      .single();
    const requiredWorkers = job?.required_workers ?? 1;

    // ตรวจ team ปัจจุบัน
    const { data: currentTeam } = await supabase
      .from("skc_job_workers")
      .select("student_id, role")
      .eq("job_id", id);
    const teamSize = currentTeam?.length ?? 0;

    // ตรวจซ้ำ — กันการ approve ซ้ำของ student เดียวกัน
    const alreadyOnTeam = currentTeam?.some((w) => w.student_id === req.student_id);
    if (alreadyOnTeam) {
      return NextResponse.json({
        error: "นักศึกษาคนนี้อยู่ในทีมแล้ว",
      }, { status: 400 });
    }

    // ตรวจทีมเต็มหรือยัง
    if (teamSize >= requiredWorkers) {
      return NextResponse.json({
        error: `ทีมเต็มแล้ว (${teamSize}/${requiredWorkers})`,
      }, { status: 400 });
    }

    const isFirstWorker = teamSize === 0;
    const role = isFirstWorker ? "LEAD" : "WORKER";

    // เพิ่มเข้าทีม
    await supabase.from("skc_job_workers").insert({
      job_id: id,
      student_id: req.student_id,
      role,
      added_by: user.id,
    });

    const newTeamSize = teamSize + 1;
    const isTeamFull = newTeamSize >= requiredWorkers;

    // อัปเดตงาน
    const jobUpdate: Record<string, unknown> = {
      approved_by_staff: user.id,
      staff_approval_at: new Date().toISOString(),
    };
    if (isFirstWorker) {
      // LEAD = team lead pointer (backward compat: student_id ยังถูกใช้ใน UI อื่นๆ)
      jobUpdate.student_id = req.student_id;
    }
    if (isTeamFull) {
      jobUpdate.status = "ASSIGNED";
      jobUpdate.gov_status = "CONTRACT_PENDING";
    }
    // ถ้ายังไม่เต็ม — status คงเป็น OPEN (รับสมัครต่อ)
    await supabase.from("skc_jobs").update(jobUpdate).eq("id", id);

    // Log gov transition (เฉพาะตอนทีมเต็ม)
    if (isTeamFull) {
      await supabase.from("skc_gov_workflow_log").insert({
        job_id: id,
        from_status: "ACTIVITY_APPROVED",
        to_status: "CONTRACT_PENDING",
        actor_id: user.id,
        note: `ทีมครบ ${newTeamSize}/${requiredWorkers} — มอบหมายงาน`,
      });

      // สร้าง chat room (ครั้งเดียวเมื่อทีมครบ)
      await supabase.from("skc_job_chat_rooms").insert({ job_id: id });
    }

    // แจ้ง student คนนี้
    await createNotification(supabase, {
      user_id: req.student_id,
      type: "job_assigned",
      title: isFirstWorker ? "ได้รับงาน (Team Lead)!" : "ได้รับงานเป็นสมาชิกทีม!",
      body: requiredWorkers > 1
        ? `คุณเป็น${role === "LEAD" ? "หัวหน้าทีม" : "สมาชิกทีม"} งาน "${job?.title}" (${newTeamSize}/${requiredWorkers} คน)`
        : `คุณได้รับมอบหมายงาน "${job?.title}" — กรุณาประสานวันทำงานกับผู้ว่าจ้าง`,
      link: `/student/dashboard`,
    });

    // Admin observability
    notifyAdmin(supabase, {
      actorId: user.id,
      action: `อนุมัติ นศ. รับงาน${isTeamFull ? " (ทีมครบ)" : ""}`,
      targetType: "job",
      targetId: id,
      targetTitle: job?.title ?? id,
      link: `/admin/jobs?id=${id}`,
      severity: "info",
      extra: `นศ.: ${req.student?.name ?? req.student_id.slice(0, 8)} · ${newTeamSize}/${requiredWorkers} คน`,
    }).catch(() => {});

    // แจ้ง employer ว่ามี นศ. แล้ว (ครั้งแรกหรือทีมเต็ม)
    if (job?.employer_id && (isFirstWorker || isTeamFull)) {
      await createNotification(supabase, {
        user_id: job.employer_id,
        type: "job_assigned",
        title: isTeamFull ? "ทีมงานครบแล้ว" : "นักศึกษาเริ่มเข้าทีม",
        body: isTeamFull
          ? `งาน "${job.title}" ทีมครบ ${newTeamSize}/${requiredWorkers} — กรุณากำหนดวันทำงาน`
          : `งาน "${job.title}" มีนักศึกษาแล้ว ${newTeamSize}/${requiredWorkers} — กำลังหาเพิ่ม`,
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

    notifyAdmin(supabase, {
      actorId: user.id,
      action: "ปฏิเสธคำขอรับงาน",
      targetType: "job",
      targetId: id,
      link: `/admin/jobs?id=${id}`,
      severity: "warn",
      extra: `นศ.: ${req.student?.name ?? req.student_id.slice(0, 8)}${review_note ? ` · ${review_note}` : ""}`,
    }).catch(() => {});
  }

  return NextResponse.json(req);
}
