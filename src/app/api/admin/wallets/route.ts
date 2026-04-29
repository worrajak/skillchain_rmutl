import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/admin/wallets — list all users + their TRON wallet + TRPB balance
export async function GET(_request: NextRequest) {
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

  const { data: users } = await supabase
    .from("skc_users")
    .select("id, name, email, role, wallet_address, organization, approval_status")
    .order("role")
    .order("name");

  // Fetch TRPB balances in one shot
  const userIds = (users ?? []).map((u) => u.id);
  let balanceMap: Record<string, { balance: number; hold_balance: number }> = {};
  if (userIds.length > 0) {
    const { data: bals } = await supabase
      .from("skc_trpb_balances")
      .select("user_id, balance, hold_balance")
      .in("user_id", userIds);
    balanceMap = Object.fromEntries(
      (bals ?? []).map((b) => [
        b.user_id,
        { balance: Number(b.balance), hold_balance: Number(b.hold_balance) },
      ]),
    );
  }

  const enriched = (users ?? []).map((u) => ({
    ...u,
    has_wallet: !!u.wallet_address,
    balance: balanceMap[u.id]?.balance ?? 0,
    hold_balance: balanceMap[u.id]?.hold_balance ?? 0,
  }));

  return NextResponse.json({
    users: enriched,
    summary: {
      total: enriched.length,
      with_wallet: enriched.filter((u) => u.has_wallet).length,
      without_wallet: enriched.filter((u) => !u.has_wallet).length,
    },
  });
}

// PATCH /api/admin/wallets — set/update/clear a user's TRON wallet address
// Body: { user_id: string, wallet_address: string | null }
export async function PATCH(request: NextRequest) {
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
  const { user_id, wallet_address } = body as {
    user_id?: string;
    wallet_address?: string | null;
  };

  if (!user_id) {
    return NextResponse.json({ error: "ต้องระบุ user_id" }, { status: 400 });
  }

  // Validate TRON address format (T + 33 alphanumeric)
  let walletToSet: string | null = null;
  if (wallet_address && wallet_address.trim() !== "") {
    const addr = wallet_address.trim();
    if (!/^T[A-Za-z0-9]{33}$/.test(addr)) {
      return NextResponse.json(
        { error: "รูปแบบ TRON address ไม่ถูกต้อง (ต้องขึ้นต้น T + 33 ตัว alphanumeric)" },
        { status: 400 },
      );
    }
    walletToSet = addr;
  }

  // Check uniqueness — wallet_address has @unique constraint in schema
  if (walletToSet) {
    const { data: existing } = await supabase
      .from("skc_users")
      .select("id, name")
      .eq("wallet_address", walletToSet)
      .neq("id", user_id)
      .maybeSingle();
    if (existing) {
      return NextResponse.json(
        { error: `wallet นี้ผูกกับ "${existing.name}" อยู่แล้ว` },
        { status: 409 },
      );
    }
  }

  const { error } = await supabase
    .from("skc_users")
    .update({ wallet_address: walletToSet })
    .eq("id", user_id);

  if (error) {
    return NextResponse.json({ error: "บันทึกไม่สำเร็จ: " + error.message }, { status: 500 });
  }

  return NextResponse.json({
    message: walletToSet ? `ผูก wallet สำเร็จ` : "ลบ wallet แล้ว",
    wallet_address: walletToSet,
  });
}
