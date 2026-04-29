import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { transfer, getBalance } from "@/lib/trpb-ledger";
import { createNotification } from "@/lib/telegram";

// POST /api/trpb/transfer
// User-to-user TRPB transfer.
//
// Allowed roles:
//   - project_staff / rmutl_staff: can transfer to anyone (intended use:
//     staff distributes their allocation to employers / mentors)
//   - admin / superadmin: can transfer between any two users
//   - employer / student: can only transfer to themselves (no-op) or be
//     blocked entirely
//
// Body: { to_user_id: string, amount: number, reason?: string }
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("skc_users")
    .select("role, name")
    .eq("id", user.id)
    .single();

  const allowedRoles = ["project_staff", "rmutl_staff", "admin", "superadmin"];
  if (!profile || !allowedRoles.includes(profile.role)) {
    return NextResponse.json(
      { error: "เฉพาะคณะทำงาน/แอดมินเท่านั้นที่โอน TRPB ได้" },
      { status: 403 },
    );
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
  if (to_user_id === user.id) {
    return NextResponse.json({ error: "โอนให้ตัวเองไม่ได้" }, { status: 400 });
  }
  if (amount > 100_000) {
    return NextResponse.json({ error: "จำนวนเกิน 100,000 TRPB ต่อครั้ง" }, { status: 400 });
  }

  // Verify recipient exists
  const { data: recipient } = await supabase
    .from("skc_users")
    .select("id, name, role")
    .eq("id", to_user_id)
    .single();

  if (!recipient) {
    return NextResponse.json({ error: "ไม่พบผู้รับ" }, { status: 404 });
  }

  // Verify sender has enough balance (defensive — SQL function enforces too)
  const senderBal = await getBalance(supabase, user.id);
  if (!senderBal || senderBal.balance < amount) {
    return NextResponse.json({
      error: `ยอด TRPB ไม่พอ (มี ${(senderBal?.balance ?? 0).toLocaleString()}, ต้องการ ${amount.toLocaleString()})`,
      hint: "ขอ admin จ่ายให้คุณก่อนผ่าน /admin/trpb",
    }, { status: 400 });
  }

  const result = await transfer(supabase, user.id, to_user_id, amount, {
    reason: reason || `โอนจาก ${profile.name}`,
    createdBy: user.id,
  });

  if (!result.ok) {
    return NextResponse.json({ error: "โอนไม่สำเร็จ: " + result.error }, { status: 500 });
  }

  // Notify recipient
  await createNotification(supabase, {
    user_id: to_user_id,
    type: "trpb_received",
    title: "ได้รับ TRPB",
    body: `คุณได้รับ ${amount.toLocaleString()} TRPB จาก ${profile.name}${reason ? ` — ${reason}` : ""}`,
    link: "/wallet",
  });

  return NextResponse.json({
    message: `โอน ${amount.toLocaleString()} TRPB ให้ ${recipient.name} (${recipient.role}) สำเร็จ`,
    tx_id: result.txId,
  });
}
