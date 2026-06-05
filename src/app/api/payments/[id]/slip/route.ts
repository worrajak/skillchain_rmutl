import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { verifySlipImage } from "@/lib/promptpay";
import { notifyAdmin } from "@/lib/telegram";

/**
 * POST /api/payments/[id]/slip — payer upload slip image + verify
 *
 * Body: { image_base64: "data:image/jpeg;base64,..." or raw base64 }
 *
 * Flow:
 *   1. ตรวจ payment exists + status = PENDING
 *   2. Upload base64 → Supabase Storage `payment-slips/<id>.jpg`
 *   3. เรียก easyslip verify
 *   4. ถ้า verify ผ่าน + ยอดตรง → status = VERIFIED
 *      ถ้าไม่ผ่านหรือยอดไม่ตรง → status = SLIP_UPLOADED (รอ admin check)
 *
 * Returns: { status, slip_url, verify_result }
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const body = await request.json();
  const { image_base64 } = body;
  if (!image_base64) {
    return NextResponse.json({ error: "ต้องส่ง image_base64" }, { status: 400 });
  }

  // Get payment
  const { data: payment, error: payErr } = await supabase
    .from("skc_payments")
    .select("id, amount, reference, status, expires_at, payer_id, payer_name")
    .eq("id", id)
    .single();

  if (payErr || !payment) return NextResponse.json({ error: "ไม่พบ payment" }, { status: 404 });
  if (payment.status !== "PENDING") {
    return NextResponse.json({ error: `payment สถานะ ${payment.status} แล้ว — upload slip ไม่ได้` }, { status: 400 });
  }
  if (new Date(payment.expires_at) < new Date()) {
    await supabase.from("skc_payments").update({ status: "EXPIRED" }).eq("id", id);
    return NextResponse.json({ error: "QR หมดอายุแล้ว — สร้างใหม่" }, { status: 400 });
  }

  // Upload base64 image to Storage
  const base64Data = image_base64.includes(",") ? image_base64.split(",")[1] : image_base64;
  let buffer: Buffer;
  try {
    buffer = Buffer.from(base64Data, "base64");
  } catch {
    return NextResponse.json({ error: "image_base64 ไม่ถูกต้อง" }, { status: 400 });
  }
  if (buffer.length > 5 * 1024 * 1024) {
    return NextResponse.json({ error: "ไฟล์เกิน 5 MB" }, { status: 400 });
  }

  const fileName = `${id}-${Date.now()}.jpg`;
  const { data: uploadData, error: uploadErr } = await supabase.storage
    .from("payment-slips")
    .upload(fileName, buffer, {
      contentType: "image/jpeg",
      upsert: false,
    });

  if (uploadErr) {
    return NextResponse.json({ error: `Upload failed: ${uploadErr.message}` }, { status: 500 });
  }
  const slipPath = uploadData?.path ?? fileName;

  // Verify with easyslip
  const verifyResult = await verifySlipImage(image_base64);

  // Match amount
  const amountMatches = verifyResult.ok && verifyResult.amount === Number(payment.amount);

  // Decide status
  let newStatus: string;
  if (verifyResult.ok && amountMatches) {
    newStatus = "VERIFIED";
  } else {
    newStatus = "SLIP_UPLOADED"; // wait for admin check
  }

  // Update payment
  await supabase
    .from("skc_payments")
    .update({
      slip_url: slipPath,
      slip_uploaded_at: new Date().toISOString(),
      verify_result: verifyResult.raw ?? { error: verifyResult.error },
      verify_at: new Date().toISOString(),
      status: newStatus,
    })
    .eq("id", id);

  // Notify admin
  const actorName = payment.payer_name ?? "ผู้บริจาค";
  notifyAdmin(supabase, {
    actorId: payment.payer_id ?? undefined,
    actorName,
    action: amountMatches
      ? `ส่ง slip + easyslip ยืนยันยอดตรง (${payment.amount} THB)`
      : verifyResult.ok
        ? `ส่ง slip · ยอดไม่ตรง (slip ${verifyResult.amount} vs ระบบ ${payment.amount})`
        : `ส่ง slip · easyslip ตรวจไม่ผ่าน (${verifyResult.error})`,
    targetType: "user",
    targetId: payment.id,
    targetTitle: `${payment.reference} · ${payment.amount} THB`,
    link: `/admin/payments`,
    severity: amountMatches ? "info" : "warn",
  }).catch(() => {});

  return NextResponse.json({
    ok: true,
    status: newStatus,
    slip_url: slipPath,
    verify_result: {
      ok: verifyResult.ok,
      amount: verifyResult.amount,
      amount_matches: amountMatches,
      receiver: verifyResult.receiver,
      date: verifyResult.date,
      error: verifyResult.error,
    },
  });
}
