// Server-only TRON helpers: TRC-20 transfer from deployer treasury → recipient
// IMPORTANT: This file uses TRON_DEPLOYER_PRIVATE_KEY — never import in client code.

import "server-only";
import { CONTRACTS, TRON_CONFIG, toOnChainAmount } from "./client";

const FULL_HOST = TRON_CONFIG.fullHost;
const PK = process.env.TRON_DEPLOYER_PRIVATE_KEY;

// Lazily resolve TronWeb (it's a default export shaped weirdly across versions)
async function getTronWeb() {
  if (!PK) throw new Error("TRON_DEPLOYER_PRIVATE_KEY not configured");
  const mod = await import("tronweb");
  // Different shapes across versions
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const TronWeb = (mod as any).TronWeb || (mod as any).default || (mod as any);
  return new TronWeb({ fullHost: FULL_HOST, privateKey: PK });
}

export type OnChainTransferResult =
  | { ok: true; txId: string; from: string; to: string; amount: number }
  | { ok: false; error: string };

/**
 * Transfer TRPB tokens (TRC-20) from the deployer treasury to a recipient wallet
 * on TRON Nile testnet.
 *
 * Used as a "mirror" payment after the off-chain ledger has already credited the
 * student. If the on-chain transfer fails, we keep the off-chain record intact
 * and return the error — the staff can retry via /admin/trpb/retry-onchain (TBD).
 *
 * @param toAddress  Base58 TRON address (T...)
 * @param amount     Whole-unit amount (e.g. 800 → 800 TRPB)
 * @returns          { ok, txId } on success
 */
export async function transferTRPBOnChain(
  toAddress: string,
  amount: number,
): Promise<OnChainTransferResult> {
  try {
    if (!CONTRACTS.TRPB_TOKEN) return { ok: false, error: "TRPB_TOKEN_ADDRESS not configured" };
    if (!toAddress?.match(/^T[A-Za-z0-9]{33}$/)) {
      return { ok: false, error: `Invalid TRON address: ${toAddress}` };
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      return { ok: false, error: `Invalid amount: ${amount}` };
    }

    const tronWeb = await getTronWeb();
    const fromAddress = tronWeb.address.fromPrivateKey(PK!);
    const onChainAmount = toOnChainAmount(amount);

    const contract = await tronWeb.contract().at(CONTRACTS.TRPB_TOKEN);
    const txId: string = await contract
      .transfer(toAddress, onChainAmount)
      .send({ feeLimit: 100_000_000 }); // up to 100 TRX gas

    return {
      ok: true,
      txId,
      from: fromAddress,
      to: toAddress,
      amount,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}

/**
 * Read on-chain TRPB balance of an address (whole units).
 * Used for verification + admin views.
 */
export async function getTRPBBalanceOnChain(address: string): Promise<number | null> {
  try {
    if (!CONTRACTS.TRPB_TOKEN || !address) return null;
    const tronWeb = await getTronWeb();
    const contract = await tronWeb.contract().at(CONTRACTS.TRPB_TOKEN);
    const raw = await contract.balanceOf(address).call();
    const decimals = await contract.decimals().call();
    const decimalsNum = Number(decimals.toString());
    const divisor = BigInt(10) ** BigInt(decimalsNum);
    return Number(BigInt(raw.toString()) / divisor);
  } catch {
    return null;
  }
}
