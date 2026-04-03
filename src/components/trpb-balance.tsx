"use client";

import { useEffect, useState } from "react";
import { Coins } from "lucide-react";
import { CONTRACTS, TRON_CONFIG, TRPB_TOKEN } from "@/lib/tron/client";

export function TrpbBalance() {
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
    async function fetchBalance() {
      try {
        const tokenAddr = CONTRACTS.TRPB_TOKEN;
        if (!tokenAddr) return;

        const host = TRON_CONFIG.fullHost;
        const treasuryAddr = "TU7VbEyrdZMmfMAqsNUmjmcG4CMBLtK7qj";
        const treasuryHex = "000000000000000000000000c703709d70258382fa33a872e1dd6cc303af84ac";

        const res = await fetch(`${host}/wallet/triggerconstantcontract`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            owner_address: treasuryAddr,
            contract_address: tokenAddr,
            function_selector: "balanceOf(address)",
            parameter: treasuryHex,
            visible: true,
          }),
        });
        const data = await res.json();
        const raw = data?.constant_result?.[0] || "0";
        setBalance(parseInt(raw, 16) / 10 ** TRPB_TOKEN.decimals);
      } catch {
        // silently fail
      }
    }

    fetchBalance();
    const interval = setInterval(fetchBalance, 60_000); // refresh every 60s
    return () => clearInterval(interval);
  }, []);

  if (balance === null) return null;

  return (
    <a
      href={`https://${TRON_CONFIG.network === "nile" ? "nile." : ""}tronscan.org/#/contract/${CONTRACTS.TRPB_TOKEN}`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 rounded-full bg-yellow-50 border border-yellow-200 px-3 py-1 text-xs font-semibold text-yellow-800 hover:bg-yellow-100 transition-colors"
    >
      <Coins className="size-3.5 text-yellow-600" />
      <span>{balance.toLocaleString()} TRPB</span>
    </a>
  );
}
