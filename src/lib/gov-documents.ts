/**
 * Government Document Generator — Phase 1
 * =========================================
 * สร้างเอกสารราชการ 3 ประเภทสำคัญ:
 * 1. บันทึกขออนุมัติกิจกรรม (Activity Approval Request)
 * 2. ใบรับรองการปฏิบัติงาน (Work Certification)
 * 3. แบบขอเบิกค่าตอบแทน (Disbursement Request)
 *
 * ใช้ library: docx (https://docx.js.org)
 */

import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, HeadingLevel, BorderStyle, WidthType,
  ShadingType, PageNumber, PageBreak, LevelFormat, TabStopType, TabStopPosition,
} from "docx";

// ===== Shared Style Constants =====
const FONT = "TH Sarabun New";
const border = { style: BorderStyle.SINGLE, size: 1, color: "000000" };
const borders = { top: border, bottom: border, left: border, right: border };
const cellMargins = { top: 80, bottom: 80, left: 120, right: 120 };

// ===== Helpers =====

function p(text: string, opts: { bold?: boolean; center?: boolean; size?: number; indent?: number } = {}) {
  return new Paragraph({
    spacing: { after: 120 },
    alignment: opts.center ? AlignmentType.CENTER : AlignmentType.JUSTIFIED,
    indent: opts.indent ? { firstLine: opts.indent } : undefined,
    children: [new TextRun({
      text,
      font: FONT,
      size: opts.size ?? 32, // 16pt
      ...(opts.bold ? { bold: true } : {}),
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
    spacing: { before: 160, after: 120 },
    children: [new TextRun({ text, font: FONT, size: 36, bold: true })],
  });
}

function emptyLine() {
  return new Paragraph({ spacing: { after: 120 }, children: [] });
}

function signatureLine(role: string, name?: string, position?: string) {
  return [
    emptyLine(), emptyLine(),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({
        text: `ลงชื่อ ................................................ ${role}`,
        font: FONT, size: 32,
      })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({
        text: `(${name ? name : "                                              "})`,
        font: FONT, size: 32,
      })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({
        text: `ตำแหน่ง ${position ?? "........................................."}`,
        font: FONT, size: 32,
      })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({
        text: "วันที่ ............../.................../.............",
        font: FONT, size: 32,
      })],
    }),
  ];
}

function infoRow(label: string, value: string, labelWidth: number = 3000, valueWidth: number = 6000) {
  return new TableRow({
    children: [
      new TableCell({
        borders: { top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" } },
        width: { size: labelWidth, type: WidthType.DXA },
        margins: { top: 40, bottom: 40, left: 0, right: 0 },
        children: [new Paragraph({ children: [new TextRun({ text: label, font: FONT, size: 32, bold: true })] })],
      }),
      new TableCell({
        borders: { top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, bottom: { style: BorderStyle.SINGLE, size: 6, color: "888888" }, left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" } },
        width: { size: valueWidth, type: WidthType.DXA },
        margins: { top: 40, bottom: 40, left: 60, right: 0 },
        children: [new Paragraph({ children: [new TextRun({ text: value || " ", font: FONT, size: 32 })] })],
      }),
    ],
  });
}

function makeInfoTable(rows: Array<{ label: string; value: string }>) {
  return new Table({
    width: { size: 9000, type: WidthType.DXA },
    columnWidths: [3000, 6000],
    rows: rows.map(r => infoRow(r.label, r.value)),
  });
}

function makeDataTable(headers: string[], rows: string[][], widths: number[]) {
  const headerShading = { fill: "E0E0E0", type: ShadingType.CLEAR };
  return new Table({
    width: { size: widths.reduce((a, b) => a + b, 0), type: WidthType.DXA },
    columnWidths: widths,
    rows: [
      new TableRow({
        children: headers.map((h, i) => new TableCell({
          borders, width: { size: widths[i], type: WidthType.DXA },
          shading: headerShading, margins: cellMargins,
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: h, font: FONT, size: 30, bold: true })],
          })],
        })),
      }),
      ...rows.map(row => new TableRow({
        children: row.map((c, ci) => new TableCell({
          borders, width: { size: widths[ci], type: WidthType.DXA },
          margins: cellMargins,
          children: [new Paragraph({
            alignment: ci === 0 ? AlignmentType.CENTER : AlignmentType.LEFT,
            children: [new TextRun({ text: c, font: FONT, size: 30 })],
          })],
        })),
      })),
    ],
  });
}

function makeDocumentSkeleton(children: any[], orgHeader: string = "มหาวิทยาลัยเทคโนโลยีราชมงคลล้านนา") {
  return new Document({
    styles: {
      default: { document: { run: { font: FONT, size: 32 } } },
    },
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838 }, // A4
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1800 }, // ซ้ายกว้างกว่าตามระเบียบสำนักนายกฯ
        },
      },
      headers: {
        default: new Header({
          children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: orgHeader, font: FONT, size: 24, color: "555555" })],
          })],
        }),
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: "หน้า ", font: FONT, size: 20, color: "888888" }),
              new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 20, color: "888888" }),
            ],
          })],
        }),
      },
      children,
    }],
  });
}

// ===== Common Date Helper =====

function toThaiDate(d: Date | string | null | undefined): string {
  if (!d) return "............./.................../.............";
  const date = typeof d === "string" ? new Date(d) : d;
  const months = [
    "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
    "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
  ];
  const day = date.getDate();
  const month = months[date.getMonth()];
  const year = date.getFullYear() + 543;
  return `${day} ${month} ${year}`;
}

function toThaiCurrency(amount: number): string {
  if (!amount) return "0.00";
  return amount.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ============================================================================
// DOCUMENT 1: บันทึกขออนุมัติกิจกรรม (Activity Approval Request)
// ============================================================================

export interface ActivityApprovalData {
  docRef?: string;               // เลขที่บันทึก
  docDate?: Date | string;       // วันที่
  projectTitle: string;          // ชื่อโครงการแม่
  activityTitle: string;         // ชื่อกิจกรรม
  requester: {
    name: string;
    position: string;
  };
  approver: {
    position: string;            // เช่น "คณบดีคณะวิศวกรรมศาสตร์"
    name?: string;
  };
  purpose: string;               // วัตถุประสงค์
  numStudents: number;
  totalHours: number;
  ratePerHour: number;
  totalCompensation: number;
  startDate?: Date | string;
  endDate?: Date | string;
  location: string;
  budgetSource: string;
  organization?: string;
}

export async function generateActivityApprovalDoc(data: ActivityApprovalData): Promise<Buffer> {
  const children: any[] = [];

  // ส่วนหัวบันทึกข้อความ
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: "บันทึกข้อความ", font: FONT, size: 44, bold: true })],
    }),
    emptyLine(),

    // ข้อมูลส่วนหัว
    new Paragraph({
      children: [
        new TextRun({ text: "ส่วนราชการ  ", font: FONT, size: 32, bold: true }),
        new TextRun({ text: data.organization || "มหาวิทยาลัยเทคโนโลยีราชมงคลล้านนา", font: FONT, size: 32 }),
      ],
    }),
    new Paragraph({
      children: [
        new TextRun({ text: "ที่  ", font: FONT, size: 32, bold: true }),
        new TextRun({ text: data.docRef || "......................................", font: FONT, size: 32 }),
        new TextRun({ text: "                                                    วันที่  ", font: FONT, size: 32, bold: true }),
        new TextRun({ text: toThaiDate(data.docDate), font: FONT, size: 32 }),
      ],
    }),
    new Paragraph({
      children: [
        new TextRun({ text: "เรื่อง  ", font: FONT, size: 32, bold: true }),
        new TextRun({ text: `ขออนุมัติดำเนินกิจกรรม "${data.activityTitle}"`, font: FONT, size: 32 }),
      ],
    }),
    emptyLine(),

    new Paragraph({
      children: [
        new TextRun({ text: "เรียน  ", font: FONT, size: 32, bold: true }),
        new TextRun({ text: data.approver.position, font: FONT, size: 32 }),
      ],
    }),
    emptyLine(),
  );

  // เนื้อหา
  children.push(
    p(`ด้วย ${data.requester.name} ตำแหน่ง ${data.requester.position} มีความประสงค์จะขออนุมัติดำเนินกิจกรรม "${data.activityTitle}" ภายใต้โครงการ "${data.projectTitle}" โดยมีรายละเอียดดังนี้`, { indent: 720 }),
    emptyLine(),

    p("1. วัตถุประสงค์", { bold: true }),
    p(data.purpose, { indent: 720 }),
    emptyLine(),

    p("2. รายละเอียดการดำเนินงาน", { bold: true }),
    makeInfoTable([
      { label: "จำนวนนักศึกษา", value: `${data.numStudents} คน` },
      { label: "ชั่วโมงปฏิบัติงาน", value: `${data.totalHours} ชั่วโมง` },
      { label: "อัตราค่าตอบแทน", value: `${toThaiCurrency(data.ratePerHour)} บาท/ชั่วโมง` },
      { label: "รวมค่าตอบแทน", value: `${toThaiCurrency(data.totalCompensation)} บาท (${numberToThai(data.totalCompensation)})` },
      { label: "ระยะเวลาดำเนินการ", value: `${toThaiDate(data.startDate)} ถึง ${toThaiDate(data.endDate)}` },
      { label: "สถานที่", value: data.location },
      { label: "แหล่งงบประมาณ", value: data.budgetSource },
    ]),
    emptyLine(),

    p("3. ข้อเสนอ", { bold: true }),
    p(`จึงเรียนมาเพื่อโปรดพิจารณาอนุมัติดำเนินกิจกรรมดังกล่าว และอนุมัติการเบิกจ่ายค่าตอบแทนตามรายละเอียดข้างต้น`, { indent: 720 }),
    emptyLine(),
  );

  // ส่วนลงนาม ผู้เสนอ
  children.push(
    ...signatureLine("(ผู้เสนอ)", data.requester.name, data.requester.position),
    emptyLine(),
  );

  // ช่องลงนามผู้อนุมัติ
  children.push(
    new Paragraph({
      children: [new TextRun({ text: "ความเห็น/การอนุมัติ", font: FONT, size: 32, bold: true })],
    }),
    new Paragraph({
      children: [new TextRun({ text: "  ☐  อนุมัติ      ☐  ไม่อนุมัติ เนื่องจาก ...................................................", font: FONT, size: 32 })],
    }),
    ...signatureLine(`(${data.approver.position})`, data.approver.name),
  );

  const doc = makeDocumentSkeleton(children, data.organization);
  return Packer.toBuffer(doc) as unknown as Buffer;
}

// ============================================================================
// DOCUMENT 2: ใบรับรองการปฏิบัติงาน (Work Certification)
// ============================================================================

export interface WorkCertificationData {
  docRef?: string;
  docDate?: Date | string;
  student: {
    name: string;
    studentId: string;
    faculty?: string;
    program?: string;
  };
  job: {
    title: string;
    location: string;
    startDate: Date | string;
    endDate: Date | string;
    totalHours: number;
  };
  workQuality: string;           // "ดีมาก" / "ดี" / "พอใช้"
  workSummary: string;
  compensation: number;
  employer: {
    name: string;
    position: string;
    organization: string;
  };
  mentor?: {
    name: string;
    position: string;
  };
  staff: {
    name: string;
    position: string;
  };
  organization?: string;
}

export async function generateWorkCertificationDoc(data: WorkCertificationData): Promise<Buffer> {
  const children: any[] = [];

  children.push(
    h1("ใบรับรองการปฏิบัติงาน"),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: `เลขที่ ${data.docRef || "................................"}`, font: FONT, size: 32 })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: `วันที่ออก ${toThaiDate(data.docDate)}`, font: FONT, size: 32 })],
    }),
    emptyLine(), emptyLine(),

    p(`ขอรับรองว่า ${data.student.name} รหัสนักศึกษา ${data.student.studentId}${data.student.faculty ? ` คณะ${data.student.faculty}` : ""}${data.student.program ? ` หลักสูตร${data.student.program}` : ""} ได้ปฏิบัติงานในกิจกรรม "${data.job.title}" ตามรายละเอียดดังนี้`, { indent: 720 }),
    emptyLine(),

    h2("รายละเอียดการปฏิบัติงาน"),
    makeInfoTable([
      { label: "ชื่องาน", value: data.job.title },
      { label: "สถานที่", value: data.job.location },
      { label: "ช่วงเวลา", value: `${toThaiDate(data.job.startDate)} ถึง ${toThaiDate(data.job.endDate)}` },
      { label: "จำนวนชั่วโมงรวม", value: `${data.job.totalHours} ชั่วโมง` },
      { label: "ผลการปฏิบัติงาน", value: data.workQuality },
      { label: "ค่าตอบแทน", value: `${toThaiCurrency(data.compensation)} บาท` },
    ]),
    emptyLine(),

    h2("สรุปผลการปฏิบัติงาน"),
    p(data.workSummary, { indent: 720 }),
    emptyLine(), emptyLine(),

    p("จึงออกใบรับรองนี้เพื่อเป็นหลักฐานประกอบการเบิกจ่ายค่าตอบแทนและการประเมินผลการเรียนรู้ต่อไป", { indent: 720 }),
    emptyLine(), emptyLine(),
  );

  // 3 signature blocks side-by-side
  children.push(
    ...signatureLine("ผู้ว่าจ้าง/ผู้รับรอง", data.employer.name, `${data.employer.position}\n${data.employer.organization}`),
    emptyLine(),
  );

  if (data.mentor) {
    children.push(
      ...signatureLine("พี่เลี้ยง/ผู้ดูแล", data.mentor.name, data.mentor.position),
      emptyLine(),
    );
  }

  children.push(
    ...signatureLine("เจ้าหน้าที่โครงการ", data.staff.name, data.staff.position),
  );

  const doc = makeDocumentSkeleton(children, data.organization);
  return Packer.toBuffer(doc) as unknown as Buffer;
}

// ============================================================================
// DOCUMENT 3: แบบขอเบิกค่าตอบแทน (Disbursement Request)
// ============================================================================

export interface DisbursementItem {
  studentName: string;
  studentId: string;
  jobTitle: string;
  hours: number;
  ratePerHour: number;
  amount: number;
  bankAccount?: string;
}

export interface DisbursementRequestData {
  docRef?: string;
  docDate?: Date | string;
  projectTitle: string;
  activityTitle: string;
  fiscalPeriod: string;         // "2569 ไตรมาส 1"
  budgetSource: string;
  items: DisbursementItem[];
  totalAmount: number;
  requester: {
    name: string;
    position: string;
  };
  headApprover: {
    position: string;            // หัวหน้าโครงการ
    name?: string;
  };
  financeApprover: {
    position: string;            // ฝ่ายการเงิน
    name?: string;
  };
  finalApprover: {
    position: string;            // รองอธิการ/อธิการ
    name?: string;
  };
  organization?: string;
}

export async function generateDisbursementRequestDoc(data: DisbursementRequestData): Promise<Buffer> {
  const children: any[] = [];

  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: "บันทึกข้อความ", font: FONT, size: 44, bold: true })],
    }),
    emptyLine(),

    new Paragraph({
      children: [
        new TextRun({ text: "ส่วนราชการ  ", font: FONT, size: 32, bold: true }),
        new TextRun({ text: data.organization || "มหาวิทยาลัยเทคโนโลยีราชมงคลล้านนา", font: FONT, size: 32 }),
      ],
    }),
    new Paragraph({
      children: [
        new TextRun({ text: "ที่  ", font: FONT, size: 32, bold: true }),
        new TextRun({ text: data.docRef || "......................................", font: FONT, size: 32 }),
        new TextRun({ text: "                                                    วันที่  ", font: FONT, size: 32, bold: true }),
        new TextRun({ text: toThaiDate(data.docDate), font: FONT, size: 32 }),
      ],
    }),
    new Paragraph({
      children: [
        new TextRun({ text: "เรื่อง  ", font: FONT, size: 32, bold: true }),
        new TextRun({ text: `ขอเบิกจ่ายค่าตอบแทนนักศึกษา — ${data.activityTitle}`, font: FONT, size: 32 }),
      ],
    }),
    emptyLine(),

    new Paragraph({
      children: [
        new TextRun({ text: "เรียน  ", font: FONT, size: 32, bold: true }),
        new TextRun({ text: data.finalApprover.position, font: FONT, size: 32 }),
      ],
    }),
    emptyLine(),

    p(`ตามที่ได้รับอนุมัติให้ดำเนินกิจกรรม "${data.activityTitle}" ภายใต้โครงการ "${data.projectTitle}" นั้น บัดนี้การดำเนินงานได้เสร็จสิ้นแล้ว ขอเบิกจ่ายค่าตอบแทนนักศึกษาผู้ปฏิบัติงานในงวด ${data.fiscalPeriod} โดยเบิกจากแหล่งงบประมาณ ${data.budgetSource} ตามรายละเอียดดังนี้`, { indent: 720 }),
    emptyLine(),

    h2("รายการขอเบิก"),
    makeDataTable(
      ["ลำดับ", "ชื่อ-นามสกุล", "รหัส นศ.", "งาน", "ชม.", "อัตรา", "จำนวนเงิน"],
      data.items.map((item, i) => [
        String(i + 1),
        item.studentName,
        item.studentId,
        item.jobTitle,
        String(item.hours),
        toThaiCurrency(item.ratePerHour),
        toThaiCurrency(item.amount),
      ]),
      [800, 2200, 1400, 2200, 700, 900, 1100]
    ),
    emptyLine(),

    new Paragraph({
      alignment: AlignmentType.RIGHT,
      children: [
        new TextRun({ text: "รวมเป็นเงินทั้งสิ้น  ", font: FONT, size: 32, bold: true }),
        new TextRun({ text: `${toThaiCurrency(data.totalAmount)} บาท`, font: FONT, size: 32, bold: true }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      children: [new TextRun({ text: `(${numberToThai(data.totalAmount)})`, font: FONT, size: 32, italics: true })],
    }),
    emptyLine(),

    p("จึงเรียนมาเพื่อโปรดพิจารณาอนุมัติเบิกจ่ายต่อไป", { indent: 720 }),
    emptyLine(), emptyLine(),
  );

  // Approval chain — 4 signatures
  children.push(
    ...signatureLine("ผู้ขอเบิก", data.requester.name, data.requester.position),
    emptyLine(),

    new Paragraph({ children: [new TextRun({ text: "ความเห็น/การอนุมัติ — หัวหน้าโครงการ", font: FONT, size: 32, bold: true })] }),
    new Paragraph({ children: [new TextRun({ text: "  ☐  เห็นควรอนุมัติ      ☐  ไม่เห็นชอบ", font: FONT, size: 32 })] }),
    ...signatureLine(`(${data.headApprover.position})`, data.headApprover.name),
    emptyLine(),

    new Paragraph({ children: [new TextRun({ text: "ความเห็น — ฝ่ายการเงิน/การคลัง", font: FONT, size: 32, bold: true })] }),
    new Paragraph({ children: [new TextRun({ text: "  ☐  ตรวจสอบแล้วถูกต้อง      ☐  ต้องแก้ไข", font: FONT, size: 32 })] }),
    ...signatureLine(`(${data.financeApprover.position})`, data.financeApprover.name),
    emptyLine(),

    new Paragraph({ children: [new TextRun({ text: "การอนุมัติขั้นสุดท้าย", font: FONT, size: 32, bold: true })] }),
    new Paragraph({ children: [new TextRun({ text: "  ☐  อนุมัติ      ☐  ไม่อนุมัติ", font: FONT, size: 32 })] }),
    ...signatureLine(`(${data.finalApprover.position})`, data.finalApprover.name),
  );

  const doc = makeDocumentSkeleton(children, data.organization);
  return Packer.toBuffer(doc) as unknown as Buffer;
}

// ============================================================================
// Helper: แปลงตัวเลขเป็นตัวอักษรไทย
// ============================================================================

function numberToThai(num: number): string {
  if (!num && num !== 0) return "ศูนย์บาทถ้วน";

  const units = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน", "ล้าน"];
  const digits = ["ศูนย์", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"];

  const [baht, satang] = num.toFixed(2).split(".");

  function toThai(n: string): string {
    if (n === "0") return "";
    let result = "";
    const len = n.length;
    for (let i = 0; i < len; i++) {
      const d = parseInt(n[i]);
      const pos = len - i - 1;
      if (d === 0) continue;
      if (pos === 0 && d === 1 && len > 1) {
        result += "เอ็ด";
      } else if (pos === 1 && d === 1) {
        result += units[pos];
      } else if (pos === 1 && d === 2) {
        result += "ยี่" + units[pos];
      } else {
        result += digits[d] + units[pos];
      }
    }
    return result;
  }

  const bahtText = toThai(baht) || "ศูนย์";
  const satangText = satang === "00" ? "ถ้วน" : toThai(satang) + "สตางค์";
  return `${bahtText}บาท${satangText}`;
}
