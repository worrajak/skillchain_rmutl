// TronWeb client — ใช้เชื่อมต่อ TRON Blockchain
// Pilot Phase ใช้ Nile Testnet
// Token: TRPB Coin (ใต้ร่มพระบารมี)

import TRPBTokenABI from "./abi/TRPBToken.json";
import JobEscrowABI from "./abi/JobEscrow.json";

export const TRON_CONFIG = {
  fullHost: process.env.NEXT_PUBLIC_TRON_FULL_HOST || "https://nile.trongrid.io",
  network: process.env.NEXT_PUBLIC_TRON_NETWORK || "nile",
} as const;

// TRPB Token Info
export const TRPB_TOKEN = {
  name: "TRPB Coin",
  symbol: "TRPB",
  decimals: 6,
  // 1 TRPB = 1 THB (กำหนดโดยคณะทำงาน)
  rateToTHB: 1,
} as const;

// Contract addresses (deployed on Nile Testnet)
export const CONTRACTS = {
  TRPB_TOKEN: process.env.NEXT_PUBLIC_TRPB_TOKEN_ADDRESS || "",
  JOB_ESCROW: process.env.NEXT_PUBLIC_JOB_ESCROW_ADDRESS || "",
} as const;

// ABIs
export { TRPBTokenABI, JobEscrowABI };

// Fee structure (basis points, 1 bp = 0.01%)
export const DEFAULT_FEES = {
  studentBps: 8500,  // 85% → นักศึกษา
  fundBps: 500,      // 5%  → กองทุนกลาง
  mentorBps: 500,    // 5%  → Mentor (ถ้ามี)
  staffBps: 500,     // 5%  → คณะทำงาน
} as const;

// คำนวณส่วนแบ่ง
export function calculateFeeBreakdown(amount: number, hasMentor: boolean) {
  const fees = DEFAULT_FEES;
  if (hasMentor) {
    return {
      student: (amount * fees.studentBps) / 10000,
      fund: (amount * fees.fundBps) / 10000,
      mentor: (amount * fees.mentorBps) / 10000,
      staff: amount - (amount * fees.studentBps) / 10000 - (amount * fees.fundBps) / 10000 - (amount * fees.mentorBps) / 10000,
      total: amount,
    };
  }
  // ไม่มี Mentor → ส่วน mentor กลับเข้า student
  return {
    student: (amount * (fees.studentBps + fees.mentorBps)) / 10000,
    fund: (amount * fees.fundBps) / 10000,
    mentor: 0,
    staff: amount - (amount * (fees.studentBps + fees.mentorBps)) / 10000 - (amount * fees.fundBps) / 10000,
    total: amount,
  };
}

// Format TRPB amount
export function formatTRPB(amount: number): string {
  return `${amount.toLocaleString()} TRPB`;
}

// แปลง TRPB จำนวนเต็ม → หน่วย on-chain (6 decimals)
export function toOnChainAmount(amount: number): number {
  return Math.round(amount * 10 ** TRPB_TOKEN.decimals);
}

// แปลงจาก on-chain → จำนวนเต็ม
export function fromOnChainAmount(raw: number | string): number {
  return Number(raw) / 10 ** TRPB_TOKEN.decimals;
}

// TronScan link helper
export function getTronScanUrl(addressOrTx: string, type: "address" | "transaction" | "contract" = "address"): string {
  const base = TRON_CONFIG.network === "nile"
    ? "https://nile.tronscan.org/#"
    : "https://tronscan.org/#";
  return `${base}/${type}/${addressOrTx}`;
}

// ===== TronLink Wallet Helpers =====

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getTronWeb(): any {
  if (typeof window === "undefined") return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (window as any).tronWeb ?? null;
}

export function isTronLinkInstalled(): boolean {
  return !!getTronWeb();
}

export function connectTronLink(): string {
  const tronWeb = getTronWeb();
  if (!tronWeb) throw new Error("กรุณาติดตั้ง TronLink Extension ก่อนใช้งาน");
  const address = tronWeb.defaultAddress?.base58;
  if (!address) throw new Error("กรุณาเชื่อมต่อ TronLink Wallet");
  return address;
}

// ===== On-Chain Contract Calls =====

/** Get TRPB token contract instance (requires TronLink) */
function getTRPBContract() {
  const tronWeb = getTronWeb();
  if (!tronWeb) throw new Error("TronLink ไม่พร้อมใช้งาน");
  if (!CONTRACTS.TRPB_TOKEN) throw new Error("TRPB Token contract address ยังไม่ได้ตั้งค่า");
  return tronWeb.contract(TRPBTokenABI, CONTRACTS.TRPB_TOKEN);
}

/** Get JobEscrow contract instance (requires TronLink) */
function getEscrowContract() {
  const tronWeb = getTronWeb();
  if (!tronWeb) throw new Error("TronLink ไม่พร้อมใช้งาน");
  if (!CONTRACTS.JOB_ESCROW) throw new Error("JobEscrow contract address ยังไม่ได้ตั้งค่า");
  return tronWeb.contract(JobEscrowABI, CONTRACTS.JOB_ESCROW);
}

/** ดูยอด TRPB ของ address */
export async function getBalance(address: string): Promise<number> {
  const contract = getTRPBContract();
  const raw = await contract.balanceOf(address).call();
  return fromOnChainAmount(raw.toString());
}

/** ดู totalSupply ของ TRPB */
export async function getTotalSupply(): Promise<number> {
  const contract = getTRPBContract();
  const raw = await contract.totalSupply().call();
  return fromOnChainAmount(raw.toString());
}

/** โอน TRPB ไปยัง address อื่น */
export async function transferTRPB(to: string, amount: number): Promise<string> {
  const contract = getTRPBContract();
  const tx = await contract.transfer(to, toOnChainAmount(amount)).send();
  return tx; // txId
}

/** Approve ให้ Escrow contract หัก TRPB ได้ */
export async function approveEscrow(amount: number): Promise<string> {
  const contract = getTRPBContract();
  const tx = await contract.approve(CONTRACTS.JOB_ESCROW, toOnChainAmount(amount)).send();
  return tx;
}

/** ดู allowance ที่อนุมัติให้ Escrow */
export async function getEscrowAllowance(ownerAddress: string): Promise<number> {
  const contract = getTRPBContract();
  const raw = await contract.allowance(ownerAddress, CONTRACTS.JOB_ESCROW).call();
  return fromOnChainAmount(raw.toString());
}

/** สร้าง Escrow ฝากเงินค่าจ้าง (ต้อง approve ก่อน) */
export async function createEscrow(
  jobId: string,
  studentAddress: string,
  mentorAddress: string | null,
  amount: number,
): Promise<string> {
  const contract = getEscrowContract();
  const tronWeb = getTronWeb();

  // Convert UUID to bytes32
  const jobIdBytes32 = "0x" + jobId.replace(/-/g, "").padEnd(64, "0");
  const mentorAddr = mentorAddress || tronWeb.address.toHex("T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb").replace(/^41/, "0x000000000000000000000000");

  const tx = await contract.createEscrow(
    jobIdBytes32,
    studentAddress,
    mentorAddress || "T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb", // address(0) placeholder
    toOnChainAmount(amount),
  ).send();
  return tx;
}

/** ดูข้อมูล Escrow ของงาน */
export async function getEscrowInfo(jobId: string) {
  const contract = getEscrowContract();
  const jobIdBytes32 = "0x" + jobId.replace(/-/g, "").padEnd(64, "0");
  const result = await contract.getEscrow(jobIdBytes32).call();
  return {
    employer: result.employer,
    student: result.student,
    mentor: result.mentor,
    amount: fromOnChainAmount(result.amount.toString()),
    released: result.released,
    refunded: result.refunded,
  };
}
