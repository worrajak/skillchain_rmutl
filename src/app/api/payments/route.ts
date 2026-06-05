import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateQrPayload, generateReference, getExpiresAt, getRecipientInfo } from "@/lib/promptpay";
import { notifyAdmin } from "@/lib/telegram";

/**
 * POST /api/payments — สร้าง payment record + QR code
 *
 * Body: { amount, purpose?, payer_name?, payer_note?, related_id? }
 *   - amount required (THB > 0)
 *   - purpose default 'donation' · อื่นๆ: 'employer_topup'
 *   - payer_name สำหรับ anonymous donor (ไม่ login)
 *
 * Returns: { id, reference, qr_payload, expires_at, recipient }
 *
 * Public — ไม่ต้อง login (anonymous donation)
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const body = await request.json();
  const { amount, purpose = "donation", payer_name, payer_note, related_id } = body;

  // Validate
  const amt = Number(amount);
  if (!Number.isFinite(amt) || amt <= 0) {
    return NextResponse.json({ error: "amount ต้องเป็นจำนวนเงินมากกว่า 0" }, { status: 400 });
  }
  if (amt > 100000) {
    return NextResponse.json({ error: "จำนวนเงินสูงสุด 100,000 บาทต่อรายการ" }, { status: 400 });
  }
  if (!["donation", "employer_topup", "job_payment"].includes(purpose)) {
    return NextResponse.json({ error: "purpose ไม่ถูกต้อง" }, { status: 400 });
  }

  // Generate QR + reference
  let qrPayload: string;
  try {
    qrPayload = generateQrPayload(amt);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "QR gen failed" }, { status: 500 });
  }
  const reference = generateReference();
  const recipient = getRecipientInfo();
  const expiresAt = getExpiresAt();

  // Insert
  const { data: payment, error } = await supabase
    .from("skc_payments")
    .insert({
      amount: amt,
      reference,
      payer_id: user?.id ?? null,
      payer_name: payer_name ?? null,
      payer_note: payer_note ?? null,
      purpose,
      related_id: related_id ?? null,
      qr_payload: qrPayload,
      recipient_id: recipient.id,
      expires_at: expiresAt.toISOString(),
    })
    .select("id, reference, amount, qr_payload, expires_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!payment) return NextResponse.json({ error: "Insert failed" }, { status: 500 });

  // Admin notification (fire-and-forget)
  notifyAdmin(supabase, {
    actorId: user?.id ?? undefined,
    actorName: payer_name ?? undefined,
    action: `สร้าง QR ${purpose === "donation" ? "บริจาค" : purpose === "employer_topup" ? "Top-up" : "จ่ายค่าจ้าง"}`,
    targetType: "user",
    targetId: payment.id,
    targetTitle: `${amt.toLocaleString()} THB · ${reference}`,
    link: `/admin/payments`,
    severity: "info",
  }).catch(() => {});

  return NextResponse.json({
    id: payment.id,
    reference: payment.reference,
    amount: payment.amount,
    qr_payload: payment.qr_payload,
    expires_at: payment.expires_at,
    recipient: {
      name: recipient.name,
      masked: recipient.masked,
    },
  });
}

/**
 * GET /api/payments?status=xxx — admin queue
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("skc_users").select("role").eq("id", user.id).single();
  if (!profile || !["admin", "superadmin", "project_staff", "rmutl_staff"].includes(profile.role)) {
    return NextResponse.json({ error: "เฉพาะ staff/admin" }, { status: 403 });
  }

  const status = request.nextUrl.searchParams.get("status");
  let query = supabase
    .from("skc_payments")
    .select("*, payer:skc_users!skc_payments_payer_id_fkey(name, email)")
    .order("created_at", { ascending: false })
    .limit(100);
  if (status) query = query.eq("status", status);

  const { data } = await query;
  return NextResponse.json({ payments: data ?? [] });
}
