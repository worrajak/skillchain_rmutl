"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Coins } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

/**
 * TRPB Balance — off-chain ledger version.
 * Reads from skc_trpb_balances for the logged-in user.
 * Falls back to 0 if user has no row yet.
 */
export function TrpbBalance() {
  const [balance, setBalance] = useState<number | null>(null);
  const [held, setHeld] = useState<number>(0);
  const supabase = createClient();

  useEffect(() => {
    async function fetchBalance() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("skc_trpb_balances")
        .select("balance, hold_balance")
        .eq("user_id", user.id)
        .maybeSingle();

      setBalance(Number(data?.balance ?? 0));
      setHeld(Number(data?.hold_balance ?? 0));
    }

    fetchBalance();
    const interval = setInterval(fetchBalance, 30_000);
    return () => clearInterval(interval);
  }, [supabase]);

  if (balance === null) return null;

  return (
    <Link
      href="/wallet"
      className="inline-flex items-center gap-1.5 rounded-full bg-yellow-50 border border-yellow-200 px-3 py-1 text-xs font-semibold text-yellow-800 hover:bg-yellow-100 transition-colors"
      title={held > 0 ? `รวม held: ${held.toLocaleString()} TRPB` : undefined}
    >
      <Coins className="size-3.5 text-yellow-600" />
      <span>{balance.toLocaleString()} TRPB</span>
      {held > 0 && (
        <span className="text-[10px] text-yellow-600">(+{held.toLocaleString()})</span>
      )}
    </Link>
  );
}
