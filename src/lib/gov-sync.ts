/**
 * Government Workflow Sync Layer
 * ================================
 * Hooks ที่เชื่อม Blockchain track (jobs.status) ↔ Gov track (jobs.gov_status)
 *
 * เรียกจาก API routes ที่เปลี่ยนสถานะงาน เพื่อให้ 2 tracks เดินคู่กันอัตโนมัติ:
 *
 *   onJobCreated()         — Employer โพสต์งาน → ส่ง notification ให้ staff
 *   checkCanAssign()       — Staff อนุมัติ นศ. → ตรวจว่า gov_status ผ่าน ACTIVITY_APPROVED
 *   onWorkCompleted()      — Both staff + employer confirm → trigger auto work_cert
 *   checkCanReleaseEscrow() — ก่อนปล่อย escrow → ต้องมี DISBURSEMENT_APPROVED
 *
 * หมายเหตุ: DB triggers จัดการ core state แล้ว
 * Layer นี้เพิ่ม notification + business logic ที่ trigger ทำไม่ได้
 */

import { createNotification, notifyViaTelegram } from "@/lib/telegram";
import { logWorkflowTransition, notifyNextAction } from "@/lib/gov-workflow";

// ============================================================================
// HOOK 1: เมื่อสร้างงานใหม่ — แจ้ง staff ให้จัดทำบันทึกขออนุมัติ
// ============================================================================

export async function onJobCreated(supabase: any, jobId: string) {
  // รอ DB trigger สร้าง activity_approval เสร็จก่อน
  const { data: job } = await supabase
    .from("skc_jobs")
    .select("id, title, employer_id, pay_amount, gov_activity_id, gov_status")
    .eq("id", jobId)
    .single();

  if (!job) return { ok: false, error: "job not found" };

  // ถ้า trigger ยังไม่สร้าง activity_approval ให้สร้าง fallback
  if (!job.gov_activity_id) {
    const { data: activity } = await supabase
      .from("skc_activity_approvals")
      .insert({
        job_id: jobId,
        activity_title: job.title,
        num_students: 1,
        total_hours: Math.max(job.pay_amount / 300, 1),
        rate_per_hour: 300,
        total_compensation: job.pay_amount,
        requested_at: new Date().toISOString(),
        status: "DRAFT",
      })
      .select()
      .single();

    if (activity) {
      await supabase
        .from("skc_jobs")
        .update({ gov_activity_id: activity.id, gov_status: "DRAFT" })
        .eq("id", jobId);
    }
  }

  // แจ้ง staff ว่ามีงานใหม่รอจัดทำบันทึกขออนุมัติ
  await notifyNextAction({
    supabase,
    toStatus: "ACTIVITY_APPROVAL_PENDING",
    jobId,
    jobTitle: job.title,
  });

  await logWorkflowTransition(supabase, {
    jobId,
    toStatus: "DRAFT",
    actorId: job.employer_id,
    note: `สร้างงานใหม่: ${job.title}`,
  });

  return { ok: true };
}

// ============================================================================
// HOOK 2: Gate Check — สามารถมอบหมายงานให้ นศ. ได้หรือยัง?
// ============================================================================

export interface GateCheckResult {
  allowed: boolean;
  reason?: string;
  suggestedAction?: string;
  currentGovStatus?: string;
}

export async function checkCanAssign(supabase: any, jobId: string): Promise<GateCheckResult> {
  const { data: job } = await supabase
    .from("skc_jobs")
    .select("gov_status, gov_activity_id")
    .eq("id", jobId)
    .single();

  if (!job) {
    return { allowed: false, reason: "ไม่พบงาน" };
  }

  // ถ้าไม่มี gov workflow (งานที่ไม่ได้เข้าระบบราชการ) → อนุญาต
  if (!job.gov_activity_id) {
    return { allowed: true };
  }

  const allowedStatuses = [
    "ACTIVITY_APPROVED",
    "CONTRACT_PENDING",
    "CONTRACT_SIGNED",
    "IN_PROGRESS",
  ];

  if (!allowedStatuses.includes(job.gov_status)) {
    return {
      allowed: false,
      currentGovStatus: job.gov_status,
      reason: "บันทึกขออนุมัติกิจกรรมยังไม่ได้รับการอนุมัติ",
      suggestedAction: job.gov_status === "DRAFT"
        ? "กรุณาจัดทำบันทึกขออนุมัติและส่งให้ผู้มีอำนาจลงนาม"
        : "กรุณาติดตามการอนุมัติจากคณบดี/ผู้บริหาร",
    };
  }

  return { allowed: true, currentGovStatus: job.gov_status };
}

// ============================================================================
// HOOK 3: เมื่องานเสร็จ — ขอลายเซ็นใบรับรองจาก 3 ฝ่าย
// ============================================================================

export async function onWorkCompleted(supabase: any, jobId: string) {
  const { data: job } = await supabase
    .from("skc_jobs")
    .select("id, title, employer_id, student_id, mentor_id, gov_status, gov_activity_id")
    .eq("id", jobId)
    .single();

  if (!job) return { ok: false };

  // DB trigger สร้าง work_certification draft แล้ว → แจ้งให้ sign
  const { data: cert } = await supabase
    .from("skc_work_certifications")
    .select("id, status")
    .eq("job_id", jobId)
    .maybeSingle();

  if (!cert) {
    // Fallback: สร้างเอง
    await supabase.from("skc_work_certifications").insert({
      activity_id: job.gov_activity_id,
      job_id: jobId,
      student_id: job.student_id,
      cert_date: new Date().toISOString().slice(0, 10),
      work_quality: "ดี",
      status: "DRAFT",
    });
  }

  // แจ้งทุกฝ่ายให้ลงนาม
  const notifyUsers: Array<{ userId: string; role: string }> = [];
  if (job.employer_id) notifyUsers.push({ userId: job.employer_id, role: "ผู้ว่าจ้าง" });
  if (job.mentor_id) notifyUsers.push({ userId: job.mentor_id, role: "พี่เลี้ยง" });

  for (const u of notifyUsers) {
    await createNotification(supabase, {
      user_id: u.userId,
      type: "gov_work_cert_sign",
      title: `📝 กรุณาลงนามใบรับรองงาน — ${u.role}`,
      body: `งาน "${job.title}" เสร็จสมบูรณ์แล้ว โปรดลงนามรับรองผลการปฏิบัติงาน`,
      link: `/staff/gov/jobs/${jobId}`,
    });
  }

  // แจ้ง staff ให้ follow up
  await notifyNextAction({
    supabase,
    toStatus: "IN_PROGRESS",  // รอ sign ครบ ถึงจะเป็น WORK_CERTIFIED
    jobId,
    jobTitle: job.title,
  });

  return { ok: true };
}

// ============================================================================
// HOOK 4: Gate Check — สามารถปล่อย Escrow ได้หรือยัง?
// ============================================================================

export async function checkCanReleaseEscrow(supabase: any, jobId: string): Promise<GateCheckResult> {
  const { data: job } = await supabase
    .from("skc_jobs")
    .select("gov_status, gov_activity_id, employer_id")
    .eq("id", jobId)
    .single();

  if (!job) return { allowed: false, reason: "ไม่พบงาน" };

  // ถ้าไม่อยู่ใน gov workflow → อนุญาต (blockchain-only mode)
  if (!job.gov_activity_id) return { allowed: true };

  const allowedStatuses = ["DISBURSEMENT_APPROVED", "PAID", "COMPLETED"];

  if (!allowedStatuses.includes(job.gov_status)) {
    return {
      allowed: false,
      currentGovStatus: job.gov_status,
      reason: "ยังไม่ได้รับอนุมัติใบเบิกค่าตอบแทนจากฝ่ายการเงิน",
      suggestedAction: job.gov_status === "WORK_CERTIFIED"
        ? "กรุณาจัดทำใบเบิกค่าตอบแทนและส่งให้ฝ่ายการเงินอนุมัติก่อน"
        : job.gov_status === "DISBURSEMENT_PENDING"
        ? "ใบเบิกอยู่ระหว่างการพิจารณา — รอการอนุมัติจากหัวหน้าโครงการ / การเงิน / อธิการ"
        : "กรุณาตรวจสอบสถานะเอกสารราชการใน /staff/gov",
    };
  }

  return { allowed: true, currentGovStatus: job.gov_status };
}

// ============================================================================
// HOOK 5: เมื่อ Disbursement FINAL approved → unlock escrow + แจ้ง
// ============================================================================

export async function onDisbursementApproved(supabase: any, disbursementId: string) {
  const { data: disb } = await supabase
    .from("skc_disbursements")
    .select("*, activity:skc_activity_approvals(activity_title)")
    .eq("id", disbursementId)
    .single();

  if (!disb) return { ok: false };

  const items = (disb.items as any[]) || [];
  const jobIds = [...new Set(items.map(i => i.job_id).filter(Boolean))];

  // อัพเดท jobs ทั้งหมดให้ gov_status = DISBURSEMENT_APPROVED
  // (DB trigger จะอนุญาตให้ escrow release แล้ว)
  for (const jobId of jobIds) {
    await supabase.from("skc_jobs")
      .update({ gov_status: "DISBURSEMENT_APPROVED" })
      .eq("id", jobId);

    // แจ้ง นศ. ว่าเงินใกล้มาแล้ว
    const { data: job } = await supabase
      .from("skc_jobs").select("title, student_id").eq("id", jobId).single();

    if (job?.student_id) {
      await createNotification(supabase, {
        user_id: job.student_id,
        type: "gov_disbursement_approved",
        title: "💰 ค่าตอบแทนของคุณได้รับการอนุมัติแล้ว",
        body: `งาน "${job.title}" — เงินจะโอนเข้าบัญชีในไม่ช้า ติดตามที่ฝ่ายการเงิน`,
        link: `/jobs/${jobId}`,
      });
    }
  }

  return { ok: true, jobIds };
}

// ============================================================================
// HOOK 6: เมื่อจ่ายเงินจริง → trigger blockchain escrow release (optional)
// ============================================================================

export async function onDisbursementPaid(supabase: any, disbursementId: string) {
  const { data: disb } = await supabase
    .from("skc_disbursements").select("*").eq("id", disbursementId).single();

  if (!disb) return { ok: false };

  const items = (disb.items as any[]) || [];
  const jobIds = [...new Set(items.map(i => i.job_id).filter(Boolean))];

  for (const jobId of jobIds) {
    // อัพเดท gov_status = PAID
    await supabase.from("skc_jobs").update({ gov_status: "PAID" }).eq("id", jobId);

    // แจ้ง นศ.
    const { data: job } = await supabase.from("skc_jobs")
      .select("title, student_id").eq("id", jobId).single();

    if (job?.student_id) {
      await createNotification(supabase, {
        user_id: job.student_id,
        type: "gov_paid",
        title: "✅ ได้รับค่าตอบแทนแล้ว",
        body: `งาน "${job.title}" — การจ่ายเงินเสร็จสมบูรณ์ กรุณาตรวจสอบในบัญชี`,
      });
    }
  }

  return { ok: true };
}

// ============================================================================
// HELPER: แสดง error message ให้ user เข้าใจ
// ============================================================================

export function gateCheckErrorResponse(result: GateCheckResult) {
  return {
    error: result.reason || "ไม่สามารถดำเนินการได้",
    suggestedAction: result.suggestedAction,
    currentGovStatus: result.currentGovStatus,
    statusCode: 403,
  };
}
