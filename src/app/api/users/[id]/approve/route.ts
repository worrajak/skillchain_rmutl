import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { TronWeb } from "tronweb";
import { encryptPrivateKey } from "@/lib/crypto";

// POST /api/users/[id]/approve
// Admin/staff กดอนุมัติผู้ใช้ → สร้าง TRON wallet อัตโนมัติ (ถ้ายังไม่มี)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: userId } = await params;
  const supabase = await createClient();
  const {
    data: { user: me },
  } = await supabase.auth.getUser();
  if (!me)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // ตรวจสอบ role ของผู้อนุมัติ
  const { data: myProfile } = await supabase
    .from("users")
    .select("role")
    .eq("id", me.id)
    .single();

  const approverRoles = [
    "admin",
    "superadmin",
    "teacher",
    "project_staff",
    "rmutl_staff",
  ];
  if (!myProfile || !approverRoles.includes(myProfile.role)) {
    return NextResponse.json(
      { error: "ไม่มีสิทธิ์อนุมัติ" },
      { status: 403 }
    );
  }

  // ดึงข้อมูลผู้ใช้ที่จะอนุมัติ
  const { data: targetUser } = await supabase
    .from("users")
    .select("id, role, wallet_address, approval_status")
    .eq("id", userId)
    .single();

  if (!targetUser) {
    return NextResponse.json({ error: "ไม่พบผู้ใช้" }, { status: 404 });
  }

  if (targetUser.approval_status === "APPROVED") {
    return NextResponse.json(
      { error: "ผู้ใช้ได้รับอนุมัติแล้ว" },
      { status: 400 }
    );
  }

  // สร้าง TRON wallet ถ้ายังไม่มี
  let walletAddress = targetUser.wallet_address;
  let walletGenerated = false;

  if (!walletAddress) {
    try {
      const tronWeb = new TronWeb({
        fullHost: process.env.NEXT_PUBLIC_TRON_FULL_HOST || "https://nile.trongrid.io",
      });
      const account = await tronWeb.createAccount();
      walletAddress = account.address.base58;
      const encryptedKey = encryptPrivateKey(account.privateKey);

      // บันทึก wallet
      const { error: walletErr } = await supabase
        .from("users")
        .update({
          wallet_address: walletAddress,
          wallet_private_key: encryptedKey,
        })
        .eq("id", userId);

      if (walletErr) {
        return NextResponse.json(
          { error: "สร้าง wallet ไม่สำเร็จ: " + walletErr.message },
          { status: 500 }
        );
      }
      walletGenerated = true;
    } catch (err) {
      return NextResponse.json(
        {
          error:
            "สร้าง wallet ไม่สำเร็จ: " +
            (err instanceof Error ? err.message : "Unknown error"),
        },
        { status: 500 }
      );
    }
  }

  // อนุมัติผู้ใช้
  const { error } = await supabase
    .from("users")
    .update({
      approval_status: "APPROVED",
      approved_by: me.id,
      approved_at: new Date().toISOString(),
    })
    .eq("id", userId);

  if (error) {
    return NextResponse.json(
      { error: "อนุมัติไม่สำเร็จ: " + error.message },
      { status: 500 }
    );
  }

  // บันทึก log
  await supabase.from("approval_logs").insert({
    user_id: userId,
    approved_by: me.id,
    action: "APPROVED",
  });

  // แจ้งเตือนผู้ใช้
  await supabase.from("notifications").insert({
    user_id: userId,
    type: "approval",
    title: "บัญชีได้รับอนุมัติแล้ว",
    body: walletGenerated
      ? `บัญชีของคุณได้รับอนุมัติ และสร้าง TRON Wallet เรียบร้อย: ${walletAddress}`
      : "บัญชีของคุณได้รับอนุมัติแล้ว",
    link: "/student/profile",
  });

  return NextResponse.json({
    message: "อนุมัติสำเร็จ",
    wallet_address: walletAddress,
    wallet_generated: walletGenerated,
  });
}
