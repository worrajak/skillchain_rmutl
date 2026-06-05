import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { mint } from "@/lib/trpb-ledger";
import { notifyAdmin } from "@/lib/telegram";

/**
 * POST /api/payments/[id]/confirm — admin ยืนยัน/ปฏิเสธ payment + mint TRPB
 *
 * Body: { action: "CONFIRM" | "REJECT", reason?, trpb_amount? }
 *   - CONFIRM → status = CONFIRMED + mint TRPB เข้า donor wallet (1:1 default)
 *   - REJECT → status = FAILED + rejection_reason
 *
 * เฉพาะ admin/staff
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("skc_users").select("role").eq("id", user.id).single();
  if (!profile || !["admin", "superadmin", "project_staff", "rmutl_staff"].includes(profile.role)) {
    return NextResponse.json({ error: "เฉพาะ staff/admin" }, { status: 403 });
  }

  const body = await request.json();
  const { action, reason, trpb_amount } = body;
  if (!["CONFIRM", "REJECT"].includes(action)) {
    return NextResponse.json({ error: "action ต้องเป็น CONFIRM หรือ REJECT" }, { status: 400 });
  }

  // Get payment
  const { data: payment } = await supabase
    .from("skc_payments")
    .select("*")
    .eq("id", id)
    .single();
  if (!payment) return NextResponse.json({ error: "ไม่พบ payment" }, { status: 404 });
  if (["CONFIRMED", "FAILED"].includes(payment.status)) {
    return NextResponse.json({ error: `payment สถานะ ${payment.status} แล้ว` }, { status: 400 });
  }

  if (action === "REJECT") {
    await supabase
      .from("skc_payments")
      .update({
        status: "FAILED",
        rejection_reason: reason ?? "Admin rejected",
        confirmed_by: user.id,
        confirmed_at: new Date().toISOString(),
      })
      .eq("id", id);

    notifyAdmin(supabase, {
      actorId: user.id,
      action: "ปฏิเสธ payment",
      targetType: "user",
      targetId: id,
      targetTitle: `${payment.reference} · ${payment.amount} THB`,
      link: `/admin/payments`,
      severity: "warn",
      extra: reason,
    }).catch(() => {});

    return NextResponse.json({ ok: true, status: "FAILED" });
  }

  // CONFIRM → mint TRPB
  // Default: 1 THB = 1 TRPB (configurable later)
  const trpbToMint = Number(trpb_amount ?? payment.amount);

  let mintResult: { ok: boolean; txId?: string; error?: string } = { ok: true };
  if (payment.payer_id && trpbToMint > 0) {
    mintResult = await mint(supabase, payment.payer_id, trpbToMint, {
      reason: `${payment.purpose === "donation" ? "บริจาคผ่าน PromptPay" : "Top-up ผ่าน PromptPay"} — ref ${payment.reference}`,
      createdBy: user.id,
    });

    if (!mintResult.ok) {
      return NextResponse.json({ error: `Mint TRPB failed: ${mintResult.error}` }, { status: 500 });
    }
  }

  // Update payment
  await supabase
    .from("skc_payments")
    .update({
      status: "CONFIRMED",
      confirmed_by: user.id,
      confirmed_at: new Date().toISOString(),
      trpb_minted: trpbToMint,
      trpb_tx_id: mintResult.txId ?? null,
    })
    .eq("id", id);

  notifyAdmin(supabase, {
    actorId: user.id,
    action: payment.purpose === "donation" ? "ยืนยันการบริจาค + Mint TRPB" : "ยืนยัน Top-up + Mint TRPB",
    targetType: "user",
    targetId: id,
    targetTitle: `${payment.reference} · ${payment.amount} THB`,
    link: `/admin/payments`,
    severity: "alert",
    extra: `Mint ${trpbToMint.toLocaleString()} TRPB ${mintResult.txId ? `· TX ${mintResult.txId.slice(0, 12)}…` : ""}`,
  }).catch(() => {});

  return NextResponse.json({ ok: true, status: "CONFIRMED", trpb_tx: mintResult.txId });
}
