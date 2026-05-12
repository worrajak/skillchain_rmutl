/**
 * Batch Activity Approval — server-side helpers.
 *
 * Rolls up N candidate jobs into a single signed document so the approver
 * (อธิการบดี/รองอธิการ) only signs once instead of N times.
 *
 * See docs/BATCH_APPROVAL_PROPOSAL.md for the design.
 */

import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

const JOB_TYPE_LABEL: Record<string, string> = {
  PAID: "งานจ้าง",
  VOLUNTEER: "จิตอาสา",
  TRAINING: "ฝึกทักษะ",
  EXEMPTED: "ยกเว้นค่าบริการ",
};

const CATEGORY_LABEL: Record<string, string> = {
  electrical: "ไฟฟ้า",
  hvac: "แอร์/เครื่องเย็น",
  automotive: "ยานยนต์",
  general: "ทั่วไป",
};

const CAMPUS_LABEL: Record<string, string> = {
  huaykaew: "เชียงใหม่ (ห้วยแก้ว)",
  doi_saket: "เชียงใหม่ (ดอยสะเก็ด)",
  chiang_rai: "เชียงราย",
  lampang: "ลำปาง",
  nan: "น่าน",
  tak: "ตาก",
  phitsanulok: "พิษณุโลก",
};

const TH_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

function formatThaiDate(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return `${date.getDate()} ${TH_MONTHS[date.getMonth()]} ${date.getFullYear() + 543}`;
}

function formatThaiDateShort(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear() + 543}`;
}

// =============================================================
// Types
// =============================================================

export interface CandidateJob {
  id: string;
  title: string;
  type: string;
  job_category: string;
  pay_amount: number;
  deadline: string | null;
  required_workers: number;
  campus: string | null;
  location: string | null;
  description: string | null;
  gov_status: string | null;
  gov_batch_id: string | null;
  created_at: string;
  employer?: { name: string; organization?: string | null } | null;
}

export interface BatchRow {
  id: string;
  batch_no: string;
  title: string;
  period_start: string;
  period_end: string;
  status: string;
  document_md: string | null;
  document_pdf_url: string | null;
  approval_note: string | null;
  reject_reason: string | null;
  created_by: string;
  approved_by: string | null;
  rejected_by: string | null;
  total_jobs: number;
  total_students: number;
  total_amount: number;
  created_at: string;
  compiled_at: string | null;
  approved_at: string | null;
  rejected_at: string | null;
  closed_at: string | null;
}

// =============================================================
// Candidate selection
// =============================================================

/**
 * List jobs that are eligible to be batched for the given period.
 * Eligible = not already in a batch + gov_status null/PROJECT_DRAFT/IN_BATCH (rejected one re-eligible).
 */
export async function listCandidateJobs(
  supabase: SupabaseClient,
  periodStart: string,
  periodEnd: string,
): Promise<CandidateJob[]> {
  const { data, error } = await supabase
    .from("skc_jobs")
    .select(`
      id, title, type, job_category, pay_amount, deadline, required_workers,
      campus, location, description, gov_status, gov_batch_id, created_at,
      employer:skc_users!skc_jobs_employer_id_fkey(name, organization)
    `)
    .gte("created_at", `${periodStart}T00:00:00.000Z`)
    .lte("created_at", `${periodEnd}T23:59:59.999Z`)
    .is("gov_batch_id", null)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`Failed to list candidate jobs: ${error.message}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data as any) ?? [];
}

// =============================================================
// Markdown rendering
// =============================================================

export interface BatchMdInput {
  batchNo: string;
  periodStart: string;
  periodEnd: string;
  jobs: CandidateJob[];
}

export function renderBatchMd(input: BatchMdInput): string {
  const { batchNo, periodStart, periodEnd, jobs } = input;
  const totalAmount = jobs.reduce((s, j) => s + Number(j.pay_amount ?? 0), 0);
  const totalStudents = jobs.reduce((s, j) => s + (j.required_workers ?? 1), 0);
  const totalPaid = jobs.reduce((s, j) => (j.type === "PAID" ? s + Number(j.pay_amount ?? 0) : s), 0);

  // Distinct campuses
  const campuses = Array.from(new Set(jobs.map((j) => CAMPUS_LABEL[j.campus ?? ""] ?? j.campus).filter(Boolean)));

  // Date range for title (Thai year)
  const periodEndDate = new Date(periodEnd);
  const monthName = TH_MONTHS[periodEndDate.getMonth()];
  const thaiYear = periodEndDate.getFullYear() + 543;
  const letter = batchNo.split("-").pop() ?? "?";

  // Job rows
  const rows = jobs.map((j, i) => {
    const employer = j.employer?.name ?? "-";
    const type = JOB_TYPE_LABEL[j.type] ?? j.type;
    const category = CATEGORY_LABEL[j.job_category] ?? j.job_category;
    const pay = j.type === "PAID"
      ? Number(j.pay_amount ?? 0).toLocaleString()
      : "0 (จิตอาสา)";
    const deadline = j.deadline ? formatThaiDateShort(j.deadline) : "-";
    return `| ${i + 1} | ${j.title} | ${category} | ${employer} | ${j.required_workers ?? 1} | ${pay} | ${deadline} |`;
  }).join("\n");

  return `# บันทึกข้อความ

**ส่วนราชการ** มหาวิทยาลัยเทคโนโลยีราชมงคลล้านนา · โครงการใต้ร่มพระบารมี
**ที่** มทร.ลน. ใต้ร่มฯ / ${thaiYear} / รอบ ${letter}
**วันที่** ${formatThaiDate(new Date())}

**เรื่อง** ขออนุมัติดำเนินกิจกรรมจ้างงานนักศึกษาช่าง ภายใต้โครงการใต้ร่มพระบารมี
รอบที่ ${letter} ประจำเดือน${monthName} ${thaiYear}

**เรียน** อธิการบดี (ผ่าน รองอธิการบดีฝ่ายกิจการนักศึกษา)

---

## 1. หลักการและเหตุผล

ตามที่มหาวิทยาลัยเทคโนโลยีราชมงคลล้านนา ได้จัดทำโครงการ "ใต้ร่มพระบารมี"
เพื่อส่งเสริมให้นักศึกษาช่างได้ฝึกประสบการณ์ทำงานจริงพร้อมกับรับค่าตอบแทน
ผ่านระบบ SkillChain ในการบริหารจัดการ จ่ายเงิน และเก็บผลงาน

ในช่วงระหว่างวันที่ **${formatThaiDate(periodStart)} ถึง ${formatThaiDate(periodEnd)}**
มีผู้ว่าจ้างประสงค์จะจ้างงานนักศึกษาช่าง รวมจำนวน **${jobs.length} งาน**
ใช้กำลังนักศึกษา **${totalStudents} คน** รวมงบประมาณค่าจ้าง **${totalAmount.toLocaleString()} TRPB
(เทียบเท่า ${totalAmount.toLocaleString()} บาท)**

จึงเรียนเสนอเพื่อขออนุมัติดำเนินกิจกรรมตามรายละเอียดในข้อ 2

## 2. รายการงานที่ขออนุมัติ

| ลำดับ | ชื่องาน | ประเภท | ผู้ว่าจ้าง | จำนวน นศ. | ค่าจ้าง (TRPB) | กำหนดส่ง |
|:---:|---|---|---|:---:|---:|:---:|
${rows}
| | **รวม** | | | **${totalStudents}** | **${totalAmount.toLocaleString()}** | |

## 3. รายละเอียดเพิ่มเติม

- **คณะ/วิทยาเขตที่เกี่ยวข้อง**: ${campuses.join(", ") || "ไม่ระบุ"}
- **ระยะเวลาดำเนินกิจกรรม**: ${formatThaiDate(periodStart)} ถึง ${formatThaiDate(periodEnd)}
- **ระบบบันทึก**: ข้อมูลทั้งหมดเก็บบน SkillChain Blockchain (TRON Nile testnet)
  ตรวจสอบได้ที่ https://skillchain-rmutl.vercel.app
- **Batch ID (สำหรับอ้างอิงในระบบ)**: \`${batchNo}\`

## 4. อัตราค่าตอบแทน

ค่าตอบแทนคำนวณตามอัตราของระบบ SkillChain โครงการใต้ร่มพระบารมี:
- **90%** เข้าโดยตรงนักศึกษา (แบ่งเท่ากันถ้างานเป็นทีม)
- **5%** เข้ากองทุนกลาง (สำหรับสนับสนุนกิจกรรมเพิ่มเติม)
- **5%** เข้าค่าดำเนินการคณะทำงาน

หากงานที่ใช้พี่เลี้ยง (mentor) อัตราจะเป็น 85/5/5/5 (นศ./กองทุน/คณะ/mentor)

## 5. งบประมาณ

- **แหล่งเงิน**: เงินรายได้โครงการใต้ร่มพระบารมี
- **งบประมาณค่าจ้าง (PAID jobs)**: ${totalPaid.toLocaleString()} TRPB (เทียบเท่า ${totalPaid.toLocaleString()} บาท)
- **งานจิตอาสา/ฝึกทักษะ**: ${jobs.length - jobs.filter((j) => j.type === "PAID").length} งาน (ไม่มีค่าใช้จ่ายงบ)
- **อ้างอิงงบประมาณปี**: ${thaiYear}

---

## 6. ลายมือชื่อ

|  |  |
|---|---|
| ผู้เสนอ | _________________________________ |
|  | (....................................................) |
|  | หัวหน้าคณะทำงานใต้ร่มพระบารมี |
|  | วันที่ ........... / ........... / ${thaiYear} |
|  |  |
| ผู้พิจารณา | _________________________________ |
|  | (....................................................) |
|  | รองอธิการบดีฝ่ายกิจการนักศึกษา |
|  | วันที่ ........... / ........... / ${thaiYear} |
|  |  |
| ผู้อนุมัติ | _________________________________ |
|  | (....................................................) |
|  | อธิการบดี |
|  | วันที่ ........... / ........... / ${thaiYear} |

---

*เอกสารฉบับนี้สร้างจากระบบ SkillChain RMUTL — Batch ID: \`${batchNo}\`*
*Generated: ${formatThaiDate(new Date())} ${new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })} น.*
`;
}

// =============================================================
// Create / approve / reject
// =============================================================

export interface CreateBatchOptions {
  periodStart: string;  // YYYY-MM-DD
  periodEnd: string;
  jobIds: string[];     // explicitly selected by staff
  createdBy: string;
}

export async function createBatch(
  supabase: SupabaseClient,
  opts: CreateBatchOptions,
): Promise<BatchRow> {
  if (opts.jobIds.length === 0) throw new Error("ต้องเลือกอย่างน้อย 1 งาน");

  // Fetch full job rows
  const { data: jobs, error: jobsErr } = await supabase
    .from("skc_jobs")
    .select(`
      id, title, type, job_category, pay_amount, deadline, required_workers,
      campus, location, description, gov_status, gov_batch_id, created_at,
      employer:skc_users!skc_jobs_employer_id_fkey(name, organization)
    `)
    .in("id", opts.jobIds);
  if (jobsErr) throw new Error(jobsErr.message);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const jobList = (jobs as any) as CandidateJob[];

  if (jobList.length !== opts.jobIds.length) {
    throw new Error("งานบางตัวไม่พบ");
  }
  const alreadyInBatch = jobList.find((j) => j.gov_batch_id);
  if (alreadyInBatch) {
    throw new Error(`งาน "${alreadyInBatch.title}" อยู่ใน batch อื่นแล้ว`);
  }

  // Get next batch number
  const endDate = new Date(opts.periodEnd);
  const yearMonth = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, "0")}`;
  const { data: batchNoRes, error: noErr } = await supabase.rpc("fn_next_batch_no", { p_year_month: yearMonth });
  if (noErr) throw new Error(noErr.message);
  const batchNo = batchNoRes as string;

  const letter = batchNo.split("-").pop() ?? "?";
  const monthName = TH_MONTHS[endDate.getMonth()];
  const thaiYear = endDate.getFullYear() + 543;
  const title = `บันทึกขออนุมัติงานช่างใต้ร่มฯ รอบ ${letter} ${monthName} ${thaiYear}`;

  // Generate markdown
  const md = renderBatchMd({
    batchNo,
    periodStart: opts.periodStart,
    periodEnd: opts.periodEnd,
    jobs: jobList,
  });

  // Summary
  const totalAmount = jobList.reduce((s, j) => s + Number(j.pay_amount ?? 0), 0);
  const totalStudents = jobList.reduce((s, j) => s + (j.required_workers ?? 1), 0);

  // Insert batch
  const { data: batch, error: insErr } = await supabase
    .from("skc_gov_approval_batches")
    .insert({
      batch_no: batchNo,
      title,
      period_start: opts.periodStart,
      period_end: opts.periodEnd,
      status: "COMPILED",
      document_md: md,
      created_by: opts.createdBy,
      compiled_at: new Date().toISOString(),
      total_jobs: jobList.length,
      total_students: totalStudents,
      total_amount: totalAmount,
    })
    .select()
    .single();
  if (insErr) throw new Error(insErr.message);

  // Link jobs to batch + lock them
  const { error: updErr } = await supabase
    .from("skc_jobs")
    .update({ gov_batch_id: batch.id, gov_status: "IN_BATCH" })
    .in("id", opts.jobIds);
  if (updErr) throw new Error(updErr.message);

  return batch as BatchRow;
}

export async function approveBatch(
  supabase: SupabaseClient,
  batchId: string,
  approverId: string,
  note?: string,
): Promise<BatchRow> {
  const { data: batch, error } = await supabase
    .from("skc_gov_approval_batches")
    .update({
      status: "APPROVED",
      approved_by: approverId,
      approved_at: new Date().toISOString(),
      approval_note: note ?? null,
    })
    .eq("id", batchId)
    .select()
    .single();
  if (error) throw new Error(error.message);

  // Unlock all jobs in batch
  await supabase
    .from("skc_jobs")
    .update({ gov_status: "ACTIVITY_APPROVED" })
    .eq("gov_batch_id", batchId);

  return batch as BatchRow;
}

export async function rejectBatch(
  supabase: SupabaseClient,
  batchId: string,
  rejecterId: string,
  reason: string,
): Promise<BatchRow> {
  const { data: batch, error } = await supabase
    .from("skc_gov_approval_batches")
    .update({
      status: "REJECTED",
      rejected_by: rejecterId,
      rejected_at: new Date().toISOString(),
      reject_reason: reason,
    })
    .eq("id", batchId)
    .select()
    .single();
  if (error) throw new Error(error.message);

  // Rollback jobs: remove batch link + restore gov_status to PROJECT_DRAFT so they're eligible again
  await supabase
    .from("skc_jobs")
    .update({ gov_batch_id: null, gov_status: "PROJECT_DRAFT" })
    .eq("gov_batch_id", batchId);

  return batch as BatchRow;
}
