/**
 * Generate a Word document (.docx) for a batch approval request.
 *
 * Uses the existing TH Sarabun New font + 16pt body style from
 * lib/gov-documents.ts to keep visual consistency.
 */

import "server-only";
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, BorderStyle, WidthType,
} from "docx";
import type { CandidateJob } from "./gov-batch";

const FONT = "TH Sarabun New";
const border = { style: BorderStyle.SINGLE, size: 1, color: "000000" };
const borders = { top: border, bottom: border, left: border, right: border };
const cellMargins = { top: 80, bottom: 80, left: 120, right: 120 };

const TH_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

const JOB_TYPE_LABEL: Record<string, string> = {
  PAID: "งานจ้าง", VOLUNTEER: "จิตอาสา", TRAINING: "ฝึกทักษะ", EXEMPTED: "ยกเว้น",
};
const CATEGORY_LABEL: Record<string, string> = {
  electrical: "ไฟฟ้า", hvac: "แอร์", automotive: "ยานยนต์", general: "ทั่วไป",
};
const CAMPUS_LABEL: Record<string, string> = {
  huaykaew: "เชียงใหม่ (ห้วยแก้ว)", doi_saket: "เชียงใหม่ (ดอยสะเก็ด)",
  chiang_rai: "เชียงราย", lampang: "ลำปาง", nan: "น่าน", tak: "ตาก", phitsanulok: "พิษณุโลก",
};

function fmtThaiDate(d: string | Date): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return `${date.getDate()} ${TH_MONTHS[date.getMonth()]} ${date.getFullYear() + 543}`;
}
function fmtThaiDateShort(d: string | Date): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear() + 543}`;
}

// ─── DOCX helpers ───

function p(text: string, opts: { bold?: boolean; center?: boolean; size?: number; indent?: number } = {}) {
  return new Paragraph({
    spacing: { after: 120 },
    alignment: opts.center ? AlignmentType.CENTER : AlignmentType.JUSTIFIED,
    indent: opts.indent ? { firstLine: opts.indent } : undefined,
    children: [new TextRun({
      text, font: FONT, size: opts.size ?? 32, ...(opts.bold ? { bold: true } : {}),
    })],
  });
}

function h1(text: string) {
  return new Paragraph({
    spacing: { before: 200, after: 200 },
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text, font: FONT, size: 40, bold: true })],
  });
}

function h2(text: string) {
  return new Paragraph({
    spacing: { before: 200, after: 120 },
    children: [new TextRun({ text, font: FONT, size: 36, bold: true })],
  });
}

function blankLine() {
  return new Paragraph({ spacing: { after: 120 }, children: [] });
}

function metaRow(label: string, value: string): Paragraph {
  return new Paragraph({
    spacing: { after: 60 },
    children: [
      new TextRun({ text: `${label}  `, font: FONT, size: 32, bold: true }),
      new TextRun({ text: value, font: FONT, size: 32 }),
    ],
  });
}

function signatureBlock(role: string) {
  return [
    blankLine(),
    p("ลงชื่อ ................................................", { center: true }),
    p("(....................................................)", { center: true }),
    p(role, { center: true, bold: true }),
    p("วันที่ ............../.................../............", { center: true }),
    blankLine(),
  ];
}

function jobsTable(jobs: CandidateJob[]) {
  // Headers
  const headerRow = new TableRow({
    tableHeader: true,
    children: [
      { text: "ลำดับ", width: 6 },
      { text: "ชื่องาน", width: 30 },
      { text: "ประเภท", width: 12 },
      { text: "ผู้ว่าจ้าง", width: 16 },
      { text: "นศ.", width: 6 },
      { text: "ค่าจ้าง (TRPB)", width: 14 },
      { text: "กำหนดส่ง", width: 16 },
    ].map((h) => new TableCell({
      width: { size: h.width, type: WidthType.PERCENTAGE },
      borders,
      margins: cellMargins,
      children: [new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: h.text, font: FONT, size: 28, bold: true })],
      })],
    })),
  });

  // Body rows
  const bodyRows = jobs.map((j, i) => {
    const pay = j.type === "PAID" ? Number(j.pay_amount ?? 0).toLocaleString() : "—";
    const cells = [
      { text: String(i + 1), align: AlignmentType.CENTER },
      { text: j.title, align: AlignmentType.LEFT },
      { text: CATEGORY_LABEL[j.job_category] ?? j.job_category, align: AlignmentType.CENTER },
      { text: j.employer?.name ?? "-", align: AlignmentType.LEFT },
      { text: String(j.required_workers ?? 1), align: AlignmentType.CENTER },
      { text: pay, align: AlignmentType.RIGHT },
      { text: j.deadline ? fmtThaiDateShort(j.deadline) : "-", align: AlignmentType.CENTER },
    ];
    return new TableRow({
      children: cells.map((c) => new TableCell({
        borders, margins: cellMargins,
        children: [new Paragraph({
          alignment: c.align,
          children: [new TextRun({ text: c.text, font: FONT, size: 28 })],
        })],
      })),
    });
  });

  // Total row
  const totalStudents = jobs.reduce((s, j) => s + (j.required_workers ?? 1), 0);
  const totalAmount = jobs.reduce((s, j) => s + Number(j.pay_amount ?? 0), 0);

  const totalRow = new TableRow({
    children: [
      // Merged "รวม" label spanning 4 columns
      ...[
        { text: "", width: 6 },
        { text: "รวม", width: 30, bold: true },
        { text: "", width: 12 },
        { text: "", width: 16 },
        { text: String(totalStudents), width: 6, bold: true, align: AlignmentType.CENTER },
        { text: totalAmount.toLocaleString(), width: 14, bold: true, align: AlignmentType.RIGHT },
        { text: "", width: 16 },
      ].map((c) => new TableCell({
        borders, margins: cellMargins,
        children: [new Paragraph({
          alignment: c.align ?? AlignmentType.LEFT,
          children: [new TextRun({ text: c.text, font: FONT, size: 28, bold: !!c.bold })],
        })],
      })),
    ],
  });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [headerRow, ...bodyRows, totalRow],
  });
}

// ─── Main export ───

export interface BatchDocxInput {
  batchNo: string;
  periodStart: string;
  periodEnd: string;
  jobs: CandidateJob[];
}

export async function generateBatchDocx(input: BatchDocxInput): Promise<Buffer> {
  const { batchNo, periodStart, periodEnd, jobs } = input;
  const totalAmount = jobs.reduce((s, j) => s + Number(j.pay_amount ?? 0), 0);
  const totalStudents = jobs.reduce((s, j) => s + (j.required_workers ?? 1), 0);
  const totalPaid = jobs.reduce((s, j) => (j.type === "PAID" ? s + Number(j.pay_amount ?? 0) : s), 0);
  const campuses = Array.from(new Set(jobs.map((j) => CAMPUS_LABEL[j.campus ?? ""] ?? j.campus).filter(Boolean)));

  const endDate = new Date(periodEnd);
  const monthName = TH_MONTHS[endDate.getMonth()];
  const thaiYear = endDate.getFullYear() + 543;
  const letter = batchNo.split("-").pop() ?? "?";

  const children: (Paragraph | Table)[] = [
    h1("บันทึกข้อความ"),
    blankLine(),

    metaRow("ส่วนราชการ", "มหาวิทยาลัยเทคโนโลยีราชมงคลล้านนา · โครงการใต้ร่มพระบารมี"),
    metaRow("ที่", `มทร.ลน. ใต้ร่มฯ / ${thaiYear} / รอบ ${letter}`),
    metaRow("วันที่", fmtThaiDate(new Date())),
    blankLine(),

    metaRow("เรื่อง", `ขออนุมัติดำเนินกิจกรรมจ้างงานนักศึกษาช่าง ภายใต้โครงการใต้ร่มพระบารมี รอบที่ ${letter} ประจำเดือน${monthName} ${thaiYear}`),
    metaRow("เรียน", "อธิการบดี (ผ่าน รองอธิการบดีฝ่ายกิจการนักศึกษา)"),
    blankLine(),

    h2("1. หลักการและเหตุผล"),
    p(
      `ตามที่มหาวิทยาลัยเทคโนโลยีราชมงคลล้านนา ได้จัดทำโครงการ "ใต้ร่มพระบารมี" เพื่อส่งเสริมให้นักศึกษาช่างได้ฝึกประสบการณ์ทำงานจริงพร้อมกับรับค่าตอบแทน ผ่านระบบ SkillChain ในการบริหารจัดการ จ่ายเงิน และเก็บผลงาน`,
      { indent: 720 },
    ),
    p(
      `ในช่วงระหว่างวันที่ ${fmtThaiDate(periodStart)} ถึง ${fmtThaiDate(periodEnd)} มีผู้ว่าจ้างประสงค์จะจ้างงานนักศึกษาช่าง รวมจำนวน ${jobs.length} งาน ใช้กำลังนักศึกษา ${totalStudents} คน รวมงบประมาณค่าจ้าง ${totalAmount.toLocaleString()} TRPB (เทียบเท่า ${totalAmount.toLocaleString()} บาท)`,
      { indent: 720 },
    ),
    p("จึงเรียนเสนอเพื่อขออนุมัติดำเนินกิจกรรมตามรายละเอียดในข้อ 2", { indent: 720 }),
    blankLine(),

    h2("2. รายการงานที่ขออนุมัติ"),
    jobsTable(jobs),
    blankLine(),

    h2("3. รายละเอียดเพิ่มเติม"),
    p(`• คณะ/วิทยาเขตที่เกี่ยวข้อง: ${campuses.join(", ") || "ไม่ระบุ"}`),
    p(`• ระยะเวลาดำเนินกิจกรรม: ${fmtThaiDate(periodStart)} ถึง ${fmtThaiDate(periodEnd)}`),
    p("• ระบบบันทึก: ข้อมูลทั้งหมดเก็บบน SkillChain Blockchain (TRON Nile testnet) ตรวจสอบได้ที่ https://skillchain-rmutl.vercel.app"),
    p(`• Batch ID (สำหรับอ้างอิงในระบบ): ${batchNo}`),
    blankLine(),

    h2("4. อัตราค่าตอบแทน"),
    p("ค่าตอบแทนคำนวณตามอัตราของระบบ SkillChain โครงการใต้ร่มพระบารมี:"),
    p("• 90% เข้าโดยตรงนักศึกษา (แบ่งเท่ากันถ้างานเป็นทีม)"),
    p("• 5% เข้ากองทุนกลาง (สำหรับสนับสนุนกิจกรรมเพิ่มเติม)"),
    p("• 5% เข้าค่าดำเนินการคณะทำงาน"),
    p("หากงานที่ใช้พี่เลี้ยง (mentor) อัตราจะเป็น 85/5/5/5"),
    blankLine(),

    h2("5. งบประมาณ"),
    p("• แหล่งเงิน: เงินรายได้โครงการใต้ร่มพระบารมี"),
    p(`• งบประมาณค่าจ้าง (PAID jobs): ${totalPaid.toLocaleString()} TRPB`),
    p(`• งานจิตอาสา/ฝึกทักษะ: ${jobs.length - jobs.filter((j) => j.type === "PAID").length} งาน (ไม่มีค่าใช้จ่ายงบ)`),
    p(`• อ้างอิงงบประมาณปี: ${thaiYear}`),
    blankLine(),
    blankLine(),

    h2("ลายมือชื่อ"),
    ...signatureBlock("ผู้เสนอ — หัวหน้าคณะทำงานใต้ร่มพระบารมี"),
    ...signatureBlock("ผู้พิจารณา — รองอธิการบดีฝ่ายกิจการนักศึกษา"),
    ...signatureBlock("ผู้อนุมัติ — อธิการบดี"),
  ];

  const doc = new Document({
    creator: "SkillChain RMUTL",
    title: `Batch Approval ${batchNo}`,
    description: "Generated by SkillChain RMUTL",
    sections: [{
      properties: {
        page: {
          margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 }, // 1 inch
        },
      },
      children,
    }],
  });

  return await Packer.toBuffer(doc);
}
