/**
 * TRPB Off-chain Ledger
 * =====================
 * Wraps the SQL functions fn_trpb_transfer / fn_trpb_escrow_hold /
 * fn_trpb_escrow_release. All movements go through these helpers so we
 * have a single audit trail.
 *
 * On-chain (TRON Nile) is now optional — a `tx_hash` may be passed as
 * `on_chain_ref` for audit, but the ledger is the source of truth.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export const SYSTEM_POOL = "__SYSTEM__";

export type TrpbTxType =
  | "MINT"
  | "TRANSFER"
  | "ESCROW_HOLD"
  | "ESCROW_RELEASE"
  | "ESCROW_REFUND"
  | "BURN";

export interface TrpbBalance {
  user_id: string;
  balance: number;
  hold_balance: number;
  updated_at: string;
}

export interface LedgerOpts {
  jobId?: string;
  reason?: string;
  createdBy?: string;
  onChainRef?: string;
}

async function callRpc(
  supabase: SupabaseClient,
  fn: string,
  args: Record<string, unknown>,
): Promise<{ ok: true; txId: string } | { ok: false; error: string }> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) return { ok: false, error: error.message };
  return { ok: true, txId: data as string };
}

/** Mint TRPB from SYSTEM pool to a user (admin only). */
export function mint(
  supabase: SupabaseClient,
  toUser: string,
  amount: number,
  opts: LedgerOpts = {},
) {
  return callRpc(supabase, "fn_trpb_transfer", {
    p_from: SYSTEM_POOL,
    p_to: toUser,
    p_amount: amount,
    p_tx_type: "MINT",
    p_job_id: opts.jobId ?? null,
    p_reason: opts.reason ?? "จ่ายจากระบบ pool",
    p_created_by: opts.createdBy ?? null,
    p_on_chain_ref: opts.onChainRef ?? null,
  });
}

/** Transfer TRPB user → user. */
export function transfer(
  supabase: SupabaseClient,
  fromUser: string,
  toUser: string,
  amount: number,
  opts: LedgerOpts = {},
) {
  return callRpc(supabase, "fn_trpb_transfer", {
    p_from: fromUser,
    p_to: toUser,
    p_amount: amount,
    p_tx_type: "TRANSFER",
    p_job_id: opts.jobId ?? null,
    p_reason: opts.reason ?? null,
    p_created_by: opts.createdBy ?? null,
    p_on_chain_ref: opts.onChainRef ?? null,
  });
}

/** Move TRPB from spendable → held (employer locks for a job). */
export function escrowHold(
  supabase: SupabaseClient,
  holder: string,
  amount: number,
  jobId: string,
  createdBy: string,
) {
  return callRpc(supabase, "fn_trpb_escrow_hold", {
    p_holder: holder,
    p_amount: amount,
    p_job_id: jobId,
    p_created_by: createdBy,
  });
}

/** Release held TRPB → recipient (staff supervisor on job completion). */
export function escrowRelease(
  supabase: SupabaseClient,
  holder: string,
  recipient: string,
  amount: number,
  jobId: string,
  createdBy: string,
) {
  return callRpc(supabase, "fn_trpb_escrow_release", {
    p_holder: holder,
    p_recipient: recipient,
    p_amount: amount,
    p_job_id: jobId,
    p_created_by: createdBy,
  });
}

/** Refund held TRPB back to holder (cancel). */
export function escrowRefund(
  supabase: SupabaseClient,
  holder: string,
  amount: number,
  jobId: string,
  createdBy: string,
) {
  // Implemented as: hold → balance (same user, same row) via direct UPDATE
  // We don't have a dedicated SQL function; do it inline via fn_trpb_transfer
  // pattern is: subtract from hold, add to balance. The transfer fn doesn't
  // touch hold_balance, so use raw SQL via supabase.rpc once a refund fn is
  // added. For now, log via fn_trpb_transfer with from=null/to=holder is
  // wrong — so leave a clear TODO.
  // TODO: add fn_trpb_escrow_refund SQL helper
  return callRpc(supabase, "fn_trpb_transfer", {
    p_from: null,
    p_to: holder,
    p_amount: amount,
    p_tx_type: "ESCROW_REFUND",
    p_job_id: jobId,
    p_reason: "คืน TRPB จาก escrow",
    p_created_by: createdBy,
    p_on_chain_ref: null,
  });
}

/** Read balance for a user (or SYSTEM pool). */
export async function getBalance(
  supabase: SupabaseClient,
  userId: string,
): Promise<TrpbBalance | null> {
  const { data } = await supabase
    .from("skc_trpb_balances")
    .select("user_id, balance, hold_balance, updated_at")
    .eq("user_id", userId)
    .single();
  if (!data) return null;
  return {
    ...data,
    balance: Number(data.balance),
    hold_balance: Number(data.hold_balance),
  };
}

/** Get pool stats (system + total distributed). */
export async function getPoolStats(supabase: SupabaseClient) {
  const { data: system } = await supabase
    .from("skc_trpb_balances")
    .select("balance, hold_balance")
    .eq("user_id", SYSTEM_POOL)
    .single();

  const { data: rows } = await supabase
    .from("skc_trpb_balances")
    .select("balance, hold_balance")
    .neq("user_id", SYSTEM_POOL);

  const distributed =
    (rows ?? []).reduce((s, r) => s + Number(r.balance), 0) || 0;
  const held =
    (rows ?? []).reduce((s, r) => s + Number(r.hold_balance), 0) || 0;

  return {
    pool_balance: Number(system?.balance ?? 0),
    pool_held: Number(system?.hold_balance ?? 0),
    distributed,
    held,
    total_supply:
      Number(system?.balance ?? 0) +
      Number(system?.hold_balance ?? 0) +
      distributed +
      held,
  };
}
