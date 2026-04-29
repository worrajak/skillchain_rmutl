import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getBalance } from "@/lib/trpb-ledger";

// GET /api/trpb/staff-overview
// Returns logged-in staff's own balance + list of employers/students they
// can transfer to + recent outgoing transactions.
export async function GET(_request: NextRequest) {
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
      { error: "เฉพาะคณะทำงาน/แอดมินเท่านั้น" },
      { status: 403 },
    );
  }

  // My balance
  const myBalance = await getBalance(supabase, user.id);

  // Employers + their balances
  const { data: employers } = await supabase
    .from("skc_users")
    .select("id, name, email, organization")
    .eq("role", "employer")
    .order("name");

  const employerIds = (employers ?? []).map((e) => e.id);
  let balanceMap: Record<string, { balance: number; hold_balance: number }> = {};
  if (employerIds.length > 0) {
    const { data: bals } = await supabase
      .from("skc_trpb_balances")
      .select("user_id, balance, hold_balance")
      .in("user_id", employerIds);
    balanceMap = Object.fromEntries(
      (bals ?? []).map((b) => [
        b.user_id,
        { balance: Number(b.balance), hold_balance: Number(b.hold_balance) },
      ]),
    );
  }

  const employersWithBalance = (employers ?? []).map((e) => ({
    ...e,
    balance: balanceMap[e.id]?.balance ?? 0,
    hold_balance: balanceMap[e.id]?.hold_balance ?? 0,
  }));

  // My recent outgoing transactions
  const { data: txs } = await supabase
    .from("skc_trpb_transactions")
    .select("id, from_user, to_user, amount, tx_type, reason, created_at")
    .or(`from_user.eq.${user.id},to_user.eq.${user.id}`)
    .order("created_at", { ascending: false })
    .limit(20);

  // Resolve names for tx
  const txUserIds = [
    ...new Set(
      (txs ?? [])
        .flatMap((t) => [t.from_user, t.to_user])
        .filter((id) => id && id !== "__SYSTEM__"),
    ),
  ] as string[];
  let nameMap: Record<string, string> = {};
  if (txUserIds.length > 0) {
    const { data: users } = await supabase
      .from("skc_users")
      .select("id, name")
      .in("id", txUserIds);
    nameMap = Object.fromEntries((users ?? []).map((u) => [u.id, u.name]));
  }

  const enrichedTxs = (txs ?? []).map((t) => ({
    ...t,
    amount: Number(t.amount),
    from_name: t.from_user === "__SYSTEM__" ? "ระบบ Pool" : (t.from_user ? nameMap[t.from_user] : null),
    to_name: t.to_user === "__SYSTEM__" ? "ระบบ Pool" : (t.to_user ? nameMap[t.to_user] : null),
  }));

  return NextResponse.json({
    me: {
      name: profile.name,
      role: profile.role,
      balance: myBalance?.balance ?? 0,
      hold_balance: myBalance?.hold_balance ?? 0,
    },
    employers: employersWithBalance,
    recent_transactions: enrichedTxs,
  });
}
