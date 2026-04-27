import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createNotification } from "@/lib/telegram";
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

  // ถ้า approve → assign student to job + บันทึก staff supervisor
  if (action === "APPROVED" && req) {
    // ดึงข้อมูลงานเพื่อหา employer_id
    const { data: job } = await supabase.from("skc_jobs").select("employer_id, title").eq("id", id).single();

    await supabase.from("skc_jobs").update({
      student_id: req.student_id,
      status: "ASSIGNED",
      approved_by_staff: user.id,
      staff_approval_at: new Date().toISOString(),
      gov_status: "CONTRACT_PENDING",  // ขั้นต่อไป: ลงนามสัญญา
    }).eq("id", id);

    // Log gov transition
    await supabase.from("skc_gov_workflow_log").insert({
      job_id: id,
      from_status: "ACTIVITY_APPROVED",
      to_status: "CONTRACT_PENDING",
      actor_id: user.id,
      note: `มอบหมายงานให้ นศ. — ${req.student?.name ?? req.student_id}`,
    });

    // สร้าง chat room
    await supabase.from("skc_job_chat_rooms").insert({ job_id: id }).select().single();

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
