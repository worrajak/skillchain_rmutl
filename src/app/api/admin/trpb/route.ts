import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPoolStats } from "@/lib/trpb-ledger";

// GET /api/admin/trpb — pool stats + all balances + recent transactions (admin only)
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

  const stats = await getPoolStats(supabase);

  // Top balances (excluding system)
  const { data: balances } = await supabase
    .from("skc_trpb_balances")
    .select("user_id, balance, hold_balance, updated_at")
    .neq("user_id", "__SYSTEM__")
    .gt("balance", 0)
    .order("balance", { ascending: false })
    .limit(20);

  // Resolve user names
  const userIds = (balances ?? []).map((b) => b.user_id);
  let userMap: Record<string, { name: string; role: string; email: string }> = {};
  if (userIds.length > 0) {
    const { data: users } = await supabase
      .from("skc_users")
      .select("id, name, role, email")
      .in("id", userIds);
    userMap = Object.fromEntries(
      (users ?? []).map((u) => [u.id, { name: u.name, role: u.role, email: u.email }]),
    );
  }

  const enriched = (balances ?? []).map((b) => ({
    ...b,
    balance: Number(b.balance),
    hold_balance: Number(b.hold_balance),
    user: userMap[b.user_id] ?? null,
  }));

  // Recent transactions (last 30)
  const { data: txs } = await supabase
    .from("skc_trpb_transactions")
    .select("id, from_user, to_user, amount, tx_type, job_id, reason, created_at")
    .order("created_at", { ascending: false })
    .limit(30);

  // Resolve names for tx
  const txUserIds = [
    ...new Set(
      (txs ?? [])
        .flatMap((t) => [t.from_user, t.to_user])
        .filter((id) => id && id !== "__SYSTEM__"),
    ),
  ] as string[];
  let txUserMap: Record<string, string> = {};
  if (txUserIds.length > 0) {
    const { data: users } = await supabase
      .from("skc_users")
      .select("id, name")
      .in("id", txUserIds);
    txUserMap = Object.fromEntries((users ?? []).map((u) => [u.id, u.name]));
  }

  const enrichedTxs = (txs ?? []).map((t) => ({
    ...t,
    amount: Number(t.amount),
    from_name: t.from_user === "__SYSTEM__" ? "ระบบ Pool" : (t.from_user ? txUserMap[t.from_user] : null),
    to_name: t.to_user === "__SYSTEM__" ? "ระบบ Pool" : (t.to_user ? txUserMap[t.to_user] : null),
  }));

  return NextResponse.json({
    pool: stats,
    balances: enriched,
    recent_transactions: enrichedTxs,
  });
}
