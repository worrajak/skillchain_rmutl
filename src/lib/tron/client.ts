// TronWeb client — ใช้เชื่อมต่อ TRON Blockchain
// Pilot Phase ใช้ Nile Testnet
// Token: TRPB Coin (ใต้ร่มพระบารมี)

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

// Contract addresses (deploy แล้วจะเติม)
export const CONTRACTS = {
  TRPB_TOKEN: process.env.NEXT_PUBLIC_TRPB_TOKEN_ADDRESS || "",
  JOB_ESCROW: process.env.NEXT_PUBLIC_JOB_ESCROW_ADDRESS || "",
  SKILL_CREDENTIAL: process.env.NEXT_PUBLIC_SKILL_CREDENTIAL_ADDRESS || "",
  STUDENT_REPUTATION: process.env.NEXT_PUBLIC_STUDENT_REPUTATION_ADDRESS || "",
  DONATION_FUND: process.env.NEXT_PUBLIC_DONATION_FUND_ADDRESS || "",
  MENTORSHIP_MANAGER: process.env.NEXT_PUBLIC_MENTORSHIP_MANAGER_ADDRESS || "",
  BEHAVIOR_LOG: process.env.NEXT_PUBLIC_BEHAVIOR_LOG_ADDRESS || "",
  AGREEMENT_REGISTRY: process.env.NEXT_PUBLIC_AGREEMENT_REGISTRY_ADDRESS || "",
  DISPUTE_REGISTRY: process.env.NEXT_PUBLIC_DISPUTE_REGISTRY_ADDRESS || "",
} as const;

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

// Helper: ตรวจว่า TronLink ติดตั้งแล้วหรือยัง
export function isTronLinkInstalled(): boolean {
  if (typeof window === "undefined") return false;
  return !!(window as unknown as { tronWeb?: unknown }).tronWeb;
}

// Helper: ขอ connect TronLink wallet
export async function connectTronLink(): Promise<string | null> {
  if (!isTronLinkInstalled()) {
    throw new Error("กรุณาติดตั้ง TronLink Extension ก่อนใช้งาน");
  }
  const tronWeb = (window as unknown as { tronWeb: { defaultAddress: { base58: string } } }).tronWeb;
  const address = tronWeb.defaultAddress.base58;
  if (!address) throw new Error("กรุณาเชื่อมต่อ TronLink Wallet");
  return address;
}
