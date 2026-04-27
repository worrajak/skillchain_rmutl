/**
 * Government Workflow State Machine & Helpers
 * =============================================
 * จัดการ state transitions สำหรับ government document workflow
 * และการเตือน staff เมื่อถึงขั้นตอนที่ต้องดำเนินการ
 */

import { createNotification, notifyViaTelegram } from "@/lib/telegram";

// ===== State Machine =====

export const GOV_STATUSES = {
  DRAFT: "DRAFT",
  PROJECT_APPROVAL_PENDING: "PROJECT_APPROVAL_PENDING",
  PROJECT_APPROVED: "PROJECT_APPROVED",
  ACTIVITY_APPROVAL_PENDING: "ACTIVITY_APPROVAL_PENDING",
  ACTIVITY_APPROVED: "ACTIVITY_APPROVED",
  CONTRACT_PENDING: "CONTRACT_PENDING",
  CONTRACT_SIGNED: "CONTRACT_SIGNED",
  IN_PROGRESS: "IN_PROGRESS",
  WORK_CERTIFIED: "WORK_CERTIFIED",
  DISBURSEMENT_PENDING: "DISBURSEMENT_PENDING",
  DISBURSEMENT_APPROVED: "DISBURSEMENT_APPROVED",
  PAID: "PAID",
  COMPLETED: "COMPLETED",
  REJECTED: "REJECTED",
  CANCELLED: "CANCELLED",
} as const;

export type GovStatus = keyof typeof GOV_STATUSES;

// ===== Valid Transitions =====
// ป้องกันการข้าม state ผิด — ต้องเดินตามลำดับ

export const VALID_TRANSITIONS: Record<GovStatus, GovStatus[]> = {
  DRAFT: ["PROJECT_APPROVAL_PENDING", "ACTIVITY_APPROVAL_PENDING", "CANCELLED"],
  PROJECT_APPROVAL_PENDING: ["PROJECT_APPROVED", "REJECTED", "CANCELLED"],
  PROJECT_APPROVED: ["ACTIVITY_APPROVAL_PENDING", "CANCELLED"],
  ACTIVITY_APPROVAL_PENDING: ["ACTIVITY_APPROVED", "REJECTED", "CANCELLED"],
  ACTIVITY_APPROVED: ["CONTRACT_PENDING", "CANCELLED"],
  CONTRACT_PENDING: ["CONTRACT_SIGNED", "CANCELLED"],
  CONTRACT_SIGNED: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["WORK_CERTIFIED", "CANCELLED"],
  WORK_CERTIFIED: ["DISBURSEMENT_PENDING", "CANCELLED"],
  DISBURSEMENT_PENDING: ["DISBURSEMENT_APPROVED", "REJECTED"],
  DISBURSEMENT_APPROVED: ["PAID"],
  PAID: ["COMPLETED"],
  COMPLETED: [],
  REJECTED: [],
  CANCELLED: [],
};

export function canTransition(from: GovStatus, to: GovStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

// ===== Workflow Step Labels (Thai) =====

export const STATUS_LABELS: Record<GovStatus, string> = {
  DRAFT: "ร่าง",
  PROJECT_APPROVAL_PENDING: "รออนุมัติโครงการ",
  PROJECT_APPROVED: "อนุมัติโครงการแล้ว",
  ACTIVITY_APPROVAL_PENDING: "รออนุมัติกิจกรรม",
  ACTIVITY_APPROVED: "อนุมัติกิจกรรมแล้ว",
  CONTRACT_PENDING: "รอจัดทำสัญญา",
  CONTRACT_SIGNED: "ลงนามสัญญาแล้ว",
  IN_PROGRESS: "อยู่ระหว่างปฏิบัติงาน",
  WORK_CERTIFIED: "รับรองงานแล้ว",
  DISBURSEMENT_PENDING: "รอเบิกจ่าย",
  DISBURSEMENT_APPROVED: "อนุมัติเบิกจ่ายแล้ว",
  PAID: "จ่ายเงินแล้ว",
  COMPLETED: "เสร็จสิ้น",
  REJECTED: "ปฏิเสธ",
  CANCELLED: "ยกเลิก",
};

// ===== Log & Notify =====

export async function logWorkflowTransition(
  supabase: any,
  params: {
    jobId?: string;
    activityId?: string;
    fromStatus?: GovStatus;
    toStatus: GovStatus;
    actorId: string;
    note?: string;
  }
) {
  const { error } = await supabase.from("skc_gov_workflow_log").insert({
    job_id: params.jobId,
    activity_id: params.activityId,
    from_status: params.fromStatus,
    to_status: params.toStatus,
    actor_id: params.actorId,
    note: params.note,
  });
  if (error) console.error("Failed to log workflow transition:", error);
}

// ===== Notify Staff for Next Action =====

interface NotifyParams {
  supabase: any;
  toStatus: GovStatus;
  jobId?: string;
  activityId?: string;
  jobTitle?: string;
  docRef?: string;
}

/**
 * เตือน staff/อาจารย์/การเงิน เมื่อถึงขั้นตอนที่ต้องดำเนินการ
 * ส่งผ่าน Telegram + In-app notification
 */
export async function notifyNextAction({ supabase, toStatus, jobId, activityId, jobTitle, docRef }: NotifyParams) {
  // ค้นหา staff/admin ที่ต้องรับแจ้งเตือน
  const getStaffIds = async (roles: string[]) => {
    const { data } = await supabase
      .from("skc_users")
      .select("id")
      .in("role", roles);
    return (data || []).map((u: any) => u.id);
  };

  const jobLabel = jobTitle ? `งาน "${jobTitle}"` : docRef ? `เอกสาร ${docRef}` : "รายการ";
  const linkBase = jobId ? `/staff/gov/jobs/${jobId}` : activityId ? `/staff/gov/activities/${activityId}` : "/staff/gov";

  const notifications: Array<{
    roles: string[];
    title: string;
    body: string;
    link?: string;
  }> = [];

  switch (toStatus) {
    case "ACTIVITY_APPROVAL_PENDING":
      notifications.push({
        roles: ["rmutl_staff", "project_staff"],
        title: "📋 มีงานใหม่รอจัดทำบันทึกขออนุมัติ",
        body: `กรุณาจัดทำบันทึกขออนุมัติกิจกรรมสำหรับ${jobLabel} และนำเสนอผู้มีอำนาจอนุมัติ`,
        link: linkBase,
      });
      break;

    case "ACTIVITY_APPROVED":
      notifications.push({
        roles: ["rmutl_staff", "project_staff"],
        title: "✅ อนุมัติกิจกรรมแล้ว — รอจัดทำสัญญาจ้าง",
        body: `${jobLabel} ได้รับอนุมัติแล้ว กรุณาจัดทำสัญญาจ้าง นศ.`,
        link: linkBase,
      });
      break;

    case "CONTRACT_SIGNED":
      notifications.push({
        roles: ["rmutl_staff", "project_staff"],
        title: "🤝 ลงนามสัญญาเสร็จ — งานพร้อมเริ่ม",
        body: `สัญญาจ้างสำหรับ${jobLabel} ลงนามครบแล้ว นศ. สามารถเริ่มงานได้`,
        link: linkBase,
      });
      break;

    case "WORK_CERTIFIED":
      notifications.push({
        roles: ["rmutl_staff", "project_staff"],
        title: "📝 งานเสร็จ — รอจัดทำใบเบิก",
        body: `${jobLabel} ได้รับการรับรองการปฏิบัติงานแล้ว กรุณารวบรวมใบเบิกค่าตอบแทน`,
        link: linkBase,
      });
      break;

    case "DISBURSEMENT_PENDING":
      notifications.push({
        roles: ["rmutl_staff", "project_staff"],
        title: "💰 มีใบเบิกค่าตอบแทนรอตรวจสอบ",
        body: `ใบเบิกสำหรับ${jobLabel} รอการตรวจสอบจากฝ่ายการเงิน`,
        link: linkBase,
      });
      break;

    case "DISBURSEMENT_APPROVED":
      notifications.push({
        roles: ["rmutl_staff", "project_staff"],
        title: "✅ ใบเบิกอนุมัติแล้ว — รอจ่ายเงิน",
        body: `ใบเบิกสำหรับ${jobLabel} ได้รับอนุมัติเรียบร้อย กรุณาดำเนินการจ่ายเงิน นศ.`,
        link: linkBase,
      });
      break;

    case "PAID":
      notifications.push({
        roles: ["rmutl_staff", "project_staff"],
        title: "💸 จ่ายเงินเรียบร้อย",
        body: `${jobLabel} — จ่ายค่าตอบแทน นศ. เรียบร้อยแล้ว`,
        link: linkBase,
      });
      break;

    case "REJECTED":
      notifications.push({
        roles: ["rmutl_staff", "project_staff"],
        title: "❌ คำขอถูกปฏิเสธ",
        body: `${jobLabel} — คำขออนุมัติถูกปฏิเสธ กรุณาตรวจสอบและแก้ไข`,
        link: linkBase,
      });
      break;
  }

  for (const notify of notifications) {
    const staffIds = await getStaffIds(notify.roles);
    for (const userId of staffIds) {
      await createNotification(supabase, {
        user_id: userId,
        type: "gov_workflow",
        title: notify.title,
        body: notify.body,
        link: notify.link,
      });
    }
  }
}

// ===== Overdue Detection =====
// ใช้กับ cron job: ตรวจสอบว่ามีขั้นตอนค้างเกินกำหนดไหม

export interface OverdueThresholds {
  activityApprovalDays: number;
  contractDays: number;
  workCertificationDays: number;
  disbursementDays: number;
}

export const DEFAULT_OVERDUE: OverdueThresholds = {
  activityApprovalDays: 3,      // ขออนุมัติกิจกรรม ค้างเกิน 3 วัน
  contractDays: 5,               // สัญญาจ้าง ค้างเกิน 5 วัน
  workCertificationDays: 7,      // ใบรับรอง ค้างเกิน 7 วัน
  disbursementDays: 14,          // ใบเบิก ค้างเกิน 14 วัน
};

export async function findOverdueItems(supabase: any, thresholds: OverdueThresholds = DEFAULT_OVERDUE) {
  const now = new Date();
  const subtractDays = (days: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() - days);
    return d.toISOString();
  };

  const { data: overdue } = await supabase
    .from("skc_jobs")
    .select("id, title, gov_status, updated_at")
    .in("gov_status", [
      "ACTIVITY_APPROVAL_PENDING",
      "CONTRACT_PENDING",
      "WORK_CERTIFIED",
      "DISBURSEMENT_PENDING",
    ]);

  const result: Array<{ job: any; daysOverdue: number; stage: string }> = [];

  for (const job of overdue || []) {
    const updatedAt = new Date(job.updated_at);
    const daysPassed = Math.floor((now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60 * 24));

    const thresholdDays =
      job.gov_status === "ACTIVITY_APPROVAL_PENDING" ? thresholds.activityApprovalDays :
      job.gov_status === "CONTRACT_PENDING" ? thresholds.contractDays :
      job.gov_status === "WORK_CERTIFIED" ? thresholds.workCertificationDays :
      job.gov_status === "DISBURSEMENT_PENDING" ? thresholds.disbursementDays :
      999;

    if (daysPassed >= thresholdDays) {
      result.push({
        job,
        daysOverdue: daysPassed,
        stage: STATUS_LABELS[job.gov_status as GovStatus],
      });
    }
  }

  return result;
}

// ===== Get Next Action Suggestion =====

export function getNextAction(currentStatus: GovStatus): {
  actor: string;
  action: string;
  urgency: "low" | "normal" | "high";
} | null {
  const actions: Partial<Record<GovStatus, { actor: string; action: string; urgency: "low" | "normal" | "high" }>> = {
    DRAFT: { actor: "ผู้เสนอ", action: "ส่งคำขออนุมัติ", urgency: "normal" },
    PROJECT_APPROVAL_PENDING: { actor: "อธิการ/รองอธิการ", action: "พิจารณาอนุมัติโครงการ", urgency: "normal" },
    PROJECT_APPROVED: { actor: "Staff", action: "จัดทำบันทึกขออนุมัติกิจกรรม", urgency: "normal" },
    ACTIVITY_APPROVAL_PENDING: { actor: "คณบดี", action: "พิจารณาอนุมัติกิจกรรม", urgency: "high" },
    ACTIVITY_APPROVED: { actor: "Staff", action: "จัดทำสัญญาจ้าง นศ.", urgency: "high" },
    CONTRACT_PENDING: { actor: "นศ. + ผู้ว่าจ้าง", action: "ลงนามสัญญา", urgency: "high" },
    CONTRACT_SIGNED: { actor: "นศ.", action: "เริ่มปฏิบัติงาน", urgency: "low" },
    IN_PROGRESS: { actor: "พี่เลี้ยง", action: "บันทึก timesheet ทุกวัน", urgency: "low" },
    WORK_CERTIFIED: { actor: "Staff", action: "จัดทำใบเบิกค่าตอบแทน", urgency: "high" },
    DISBURSEMENT_PENDING: { actor: "ฝ่ายการเงิน", action: "ตรวจสอบและอนุมัติใบเบิก", urgency: "high" },
    DISBURSEMENT_APPROVED: { actor: "ฝ่ายการเงิน", action: "จ่ายเงิน นศ.", urgency: "high" },
    PAID: { actor: "Staff", action: "เก็บใบสำคัญรับเงินและปิดรายการ", urgency: "normal" },
  };

  return actions[currentStatus] ?? null;
}
