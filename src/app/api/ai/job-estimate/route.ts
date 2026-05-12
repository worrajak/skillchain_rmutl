import { NextRequest, NextResponse } from "next/server";
import { resolveAIConfig, callAI } from "@/lib/ai/server";

/**
 * POST /api/ai/job-estimate
 *
 * Employer ถ่ายรูปอุปกรณ์/พื้นที่ที่ต้องการให้ช่างมาดู → AI:
 *   - ระบุประเภทงาน (electrical / hvac / automotive / general)
 *   - สร้าง title + description template
 *   - ประมาณค่าจ้าง (TRPB) จาก scope
 *   - ระบุระยะเวลา (ชั่วโมง/วัน)
 *
 * Body:
 *   { images: string[]  ≤ 3 รูป (data URL หรือ HTTPS URL) }
 *
 * Returns:
 *   {
 *     ok, title, description, category, estimated_pay_min, estimated_pay_max,
 *     estimated_hours, scope_items: string[], cautions: string[]
 *   }
 */
export async function POST(req: NextRequest) {
  const config = resolveAIConfig(req);
  if (!config) {
    return NextResponse.json(
      { ok: false, error: "ยังไม่ได้ตั้งค่า AI — กรุณาไปที่ /settings/ai" },
      { status: 400 },
    );
  }

  const body = await req.json() as { images?: string[] };
  const images = (body.images ?? []).filter(Boolean).slice(0, 3);
  if (images.length === 0) {
    return NextResponse.json({ ok: false, error: "ขาดรูปภาพ — กรุณาส่งอย่างน้อย 1 รูป" }, { status: 400 });
  }

  const system = [
    "คุณเป็นช่างประจำมหาวิทยาลัยเทคโนโลยีราชมงคลล้านนา ช่วยประเมินงานช่างจากรูป",
    "ใช้ความรู้เรื่องค่าจ้างช่างนักศึกษา ปวส.: ทั่วไป 300-500 TRPB/วัน, เฉพาะทาง 600-1200 TRPB/วัน",
    "ตอบเป็นภาษาไทยเสมอ ตรงประเด็น ไม่แต่งเสริม",
  ].join(" ");

  const userText = [
    "ดูรูปอุปกรณ์/พื้นที่ที่ผู้ว่าจ้างต้องการให้ช่างมาดูแล แล้วประเมินงาน",
    "",
    "ส่งกลับเป็น JSON object ตามนี้:",
    "{",
    '  "title": "<หัวข้อสั้น ≤ 30 ตัวอักษร>",',
    '  "description": "<อธิบายงาน 1-2 บรรทัด ระบุขอบเขตชัดเจน>",',
    '  "category": "electrical" | "hvac" | "automotive" | "general",',
    '  "estimated_pay_min": <จำนวน TRPB ขั้นต่ำ>,',
    '  "estimated_pay_max": <จำนวน TRPB ขั้นสูง>,',
    '  "estimated_hours": <ชั่วโมงรวมประเมิน>,',
    '  "scope_items": ["<งานย่อย 1>", "<งานย่อย 2>", ...],',
    '  "cautions": ["<จุดที่ต้องระวัง เช่น ตัดไฟก่อน>", ...]',
    "}",
    "",
    "ตอบ JSON เท่านั้น ไม่มี markdown fences",
  ].join("\n");

  // Use vision model (forced) since we always have images
  const ai = await callAI(config, {
    system,
    user: userText,
    images,
    model: config.visionModel,
    temperature: 0.3,
    maxTokens: 600,
  });

  if (!ai.ok) {
    return NextResponse.json({ ok: false, error: ai.error }, { status: 500 });
  }

  const text = ai.text?.trim() ?? "";
  let parsed: {
    title?: string;
    description?: string;
    category?: string;
    estimated_pay_min?: number;
    estimated_pay_max?: number;
    estimated_hours?: number;
    scope_items?: string[];
    cautions?: string[];
  } = {};
  try {
    const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
    parsed = JSON.parse(cleaned);
  } catch {
    return NextResponse.json({
      ok: false,
      error: "AI ตอบเป็นข้อความ ไม่ใช่ JSON — ลองถ่ายรูปใหม่หรือเปลี่ยน model",
      raw: text.slice(0, 300),
    }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    ...parsed,
    model: ai.model,
    source: config.source,
    usage: ai.usage,
  });
}
