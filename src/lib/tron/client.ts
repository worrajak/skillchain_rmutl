// TronWeb client — ใช้เชื่อมต่อ TRON Blockchain
// Pilot Phase ใช้ Nile Testnet

export const TRON_CONFIG = {
  fullHost: process.env.NEXT_PUBLIC_TRON_FULL_HOST || "https://nile.trongrid.io",
  network: process.env.NEXT_PUBLIC_TRON_NETWORK || "nile",
} as const;

// Contract addresses (deploy แล้วจะเติมทีหลัง)
export const CONTRACTS = {
  JOB_ESCROW: process.env.NEXT_PUBLIC_JOB_ESCROW_ADDRESS || "",
  SKILL_CREDENTIAL: process.env.NEXT_PUBLIC_SKILL_CREDENTIAL_ADDRESS || "",
  STUDENT_REPUTATION: process.env.NEXT_PUBLIC_STUDENT_REPUTATION_ADDRESS || "",
  DONATION_FUND: process.env.NEXT_PUBLIC_DONATION_FUND_ADDRESS || "",
  MENTORSHIP_MANAGER: process.env.NEXT_PUBLIC_MENTORSHIP_MANAGER_ADDRESS || "",
  BEHAVIOR_LOG: process.env.NEXT_PUBLIC_BEHAVIOR_LOG_ADDRESS || "",
} as const;

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

  if (!address) {
    throw new Error("กรุณาเชื่อมต่อ TronLink Wallet");
  }

  return address;
}
