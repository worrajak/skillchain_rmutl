import { NextRequest, NextResponse } from "next/server";
import { resolveAIConfig, callAI } from "@/lib/ai/server";

/**
 * POST /api/ai/photo-caption
 *
 * Generate a Thai caption for a job photo using vision AI.
 *
 * Body:
 *   {
 *     image: "data:image/jpeg;base64,..." | "https://..."   (one image only)
 *     phase?: "before" | "progress" | "after"  (context for caption)
 *     job_title?: string                       (extra context)
 *   }
 *
 * Returns:
 *   { ok: true, caption: "...", suggested_quality?: 1-5, detected?: {...} }
 *
 * Cost (rough): ~0.001-0.005 USD per image depending on model + image size
 * Privacy: image is sent to OpenRouter → upstream provider. Don't include faces
 *          unless user consented (PDPA).
 */
export async function POST(req: NextRequest) {
  const config = resolveAIConfig(req);
  if (!config) {
    return NextResponse.json(
      { ok: false, error: "ยังไม่ได้ตั้งค่า AI — กรุณาไปที่ /settings/ai" },
      { status: 400 },
    );
  }

  const body = await req.json() as {
    image?: string;
    phase?: "before" | "progress" | "after";
    job_title?: string;
  };
  if (!body.image) {
    return NextResponse.json({ ok: false, error: "ขาดข้อมูลรูปภาพ" }, { status: 400 });
  }

  const phaseLabel = body.phase === "before" ? "ก่อนเริ่มงาน" :
                     body.phase === "progress" ? "ระหว่างทำงาน" :
                     body.phase === "after" ? "งานเสร็จ" : "";

  // Compact prompt — keep cost low, output Thai only
  const system = [
    "คุณเป็นผู้ช่วยที่อธิบายภาพงานช่างเป็นภาษาไทย กระชับและตรงประเด็น",
    "ห้ามแต่งเสริม ห้ามคาดเดาเกินภาพ ใช้คำที่ช่างเข้าใจ",
  ].join(" ");

  const userText = [
    body.job_title ? `บริบทงาน: "${body.job_title}"` : "",
    phaseLabel ? `รูปนี้เป็นรูป${phaseLabel}` : "",
    "",
    "ขอข้อมูลใน JSON object ตามนี้:",
    "{",
    '  "caption": "<ประโยคเดียวสั้นกระชับ ≤ 25 คำ ภาษาไทย>",',
    '  "detected": "<สิ่งของ/อุปกรณ์/บริเวณที่เห็นชัดๆ คั่นด้วย comma — เช่น พัดลมเพดาน, สายไฟใหม่>",',
    '  "quality": <1-5 ความสมบูรณ์ของงานในภาพ (1=ยังไม่เริ่ม / 3=กำลังทำ / 5=เสร็จเรียบร้อย)>,',
    '  "concerns": "<หากเห็นจุดที่ต้องระวัง เช่น สายเปลือย กระแสไฟไม่ได้ตัด ใส่ที่นี่ ไม่มีก็เว้นว่าง>"',
    "}",
    "",
    "ตอบ JSON เท่านั้น ไม่มี markdown fences ไม่มีคำอธิบายเพิ่ม",
  ].filter(Boolean).join("\n");

  const ai = await callAI(config, {
    system,
    user: userText,
    images: [body.image],
    temperature: 0.2,
    maxTokens: 300,
  });

  if (!ai.ok) {
    return NextResponse.json({ ok: false, error: ai.error }, { status: 500 });
  }

  // Try parse JSON from model output
  const text = ai.text?.trim() ?? "";
  let parsed: { caption?: string; detected?: string; quality?: number; concerns?: string } = {};
  try {
    // Strip possible code fences
    const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
    parsed = JSON.parse(cleaned);
  } catch {
    // Model didn't follow format — wrap raw text as caption
    parsed = { caption: text.slice(0, 200) };
  }

  return NextResponse.json({
    ok: true,
    caption: parsed.caption ?? "",
    detected: parsed.detected ?? "",
    quality: typeof parsed.quality === "number" ? parsed.quality : null,
    concerns: parsed.concerns ?? "",
    model: ai.model,
    source: config.source,
    usage: ai.usage,
  });
}
