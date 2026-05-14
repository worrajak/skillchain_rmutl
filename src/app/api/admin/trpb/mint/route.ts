import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { mint } from "@/lib/trpb-ledger";
import { createNotification, notifyAdmin } from "@/lib/telegram";

// POST /api/admin/trpb/mint
// Body: { to_user_id: string, amount: number, reason?: string }
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("skc_users")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !["admin", "superadmin"].includes(profile.role)) {
    return NextResponse.json({ error: "เฉพาะ admin/superadmin" }, { status: 403 });
  }

  const body = await request.json();
  const { to_user_id, amount, reason } = body as {
    to_user_id?: string;
    amount?: number;
    reason?: string;
  };

  if (!to_user_id || !amount || amount <= 0) {
    return NextResponse.json({ error: "ต้องระบุ to_user_id + amount > 0" }, { status: 400 });
  }
  if (amount > 1_000_000) {
    return NextResponse.json({ error: "จำนวนเกิน 1,000,000 TRPB ต่อครั้ง" }, { status: 400 });
  }

  // Verify recipient exists
  const { data: recipient } = await supabase
    .from("skc_users")
    .select("id, name")
    .eq("id", to_user_id)
    .single();

  if (!recipient) {
    return NextResponse.json({ error: "ไม่พบผู้รับ" }, { status: 404 });
  }

  const result = await mint(supabase, to_user_id, amount, {
    reason: reason || `จ่ายจากระบบ pool โดย ${user.email}`,
    createdBy: user.id,
  });

  if (!result.ok) {
    return NextResponse.json({ error: "จ่ายไม่สำเร็จ: " + result.error }, { status: 500 });
  }

  // Notify recipient
  await createNotification(supabase, {
    user_id: to_user_id,
    type: "trpb_received",
    title: "ได้รับ TRPB",
    body: `คุณได้รับ ${amount.toLocaleString()} TRPB${reason ? ` — ${reason}` : ""}`,
    link: "/wallet",
  });

  notifyAdmin(supabase, {
    actorId: user.id,
    action: "Mint TRPB จาก system pool",
    targetType: "user",
    targetId: to_user_id,
    targetTitle: recipient.name ?? undefined,
    link: `/admin/trpb`,
    severity: "alert",
    extra: `${amount.toLocaleString()} TRPB${reason ? ` · ${reason}` : ""}`,
  }).catch(() => {});

  return NextResponse.json({
    message: `จ่าย ${amount.toLocaleString()} TRPB ให้ ${recipient.name} สำเร็จ`,
    tx_id: result.txId,
  });
}
