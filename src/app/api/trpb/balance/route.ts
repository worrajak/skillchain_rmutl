import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getBalance } from "@/lib/trpb-ledger";

// GET /api/trpb/balance — own balance + recent transactions
export async function GET(_request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const balance = await getBalance(supabase, user.id);

  const { data: txs } = await supabase
    .from("skc_trpb_transactions")
    .select("id, from_user, to_user, amount, tx_type, job_id, reason, on_chain_ref, created_at")
    .or(`from_user.eq.${user.id},to_user.eq.${user.id}`)
    .order("created_at", { ascending: false })
    .limit(20);

  return NextResponse.json({
    balance: balance ?? { user_id: user.id, balance: 0, hold_balance: 0 },
    recent_transactions: txs ?? [],
  });
}
