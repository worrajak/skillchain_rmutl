/**
 * PromptPay helpers — generate QR + verify slip via easyslip
 *
 * Architecture: Phase 1 (Donation flow)
 *   user → gen QR + reference → จ่ายผ่าน bank app → upload slip → easyslip verify
 *   → admin confirm → mint TRPB เข้า donor wallet / กองทุน
 */

import generatePayload from "promptpay-qr";

const RECIPIENT_ID = process.env.PROMPTPAY_RECIPIENT_ID ?? "";
const RECIPIENT_NAME = process.env.PROMPTPAY_RECIPIENT_NAME ?? "SkillChain RMUTL";
const EXPIRES_HOURS = Number(process.env.PROMPTPAY_QR_EXPIRES_HOURS ?? "24");
const EASYSLIP_KEY = process.env.EASYSLIP_API_KEY ?? "";
const EASYSLIP_URL = process.env.EASYSLIP_API_URL ?? "https://developer.easyslip.com/api/v1/verify";

/**
 * Generate EMV-QR payload string for PromptPay.
 * Embed amount so user doesn't have to type — reduces error.
 */
export function generateQrPayload(amountTHB: number): string {
  if (!RECIPIENT_ID) {
    throw new Error("PROMPTPAY_RECIPIENT_ID not configured");
  }
  return generatePayload(RECIPIENT_ID, { amount: amountTHB });
}

/**
 * Generate a unique reference code for matching slip to payment record.
 * Format: SKC-<base36 timestamp>-<random 4 chars>
 *
 * Note: PromptPay doesn't carry merchant reference in transfer metadata,
 * so we use this for our internal matching only. Admin verifies amount + slip + ref.
 */
export function generateReference(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `SKC-${ts}-${rand}`;
}

export function getExpiresAt(): Date {
  return new Date(Date.now() + EXPIRES_HOURS * 3600 * 1000);
}

export function getRecipientInfo() {
  return {
    id: RECIPIENT_ID,
    name: RECIPIENT_NAME,
    masked: RECIPIENT_ID.length === 10
      ? `${RECIPIENT_ID.slice(0, 3)}-XXX-${RECIPIENT_ID.slice(-4)}`
      : RECIPIENT_ID,
  };
}

// =============================================================
// easyslip — slip verification API
// =============================================================

export interface EasySlipResult {
  ok: boolean;
  status: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  raw: any;
  amount?: number;
  ref?: string;
  receiver?: string;
  date?: string;
  error?: string;
}

/**
 * Verify slip image with easyslip.com API.
 *
 * Input: base64 image (data URL) or raw base64 string
 * Returns: parsed amount + receiver + date + status
 *
 * Pricing: free tier ~50/mo · Lite ~500-1,000 baht/mo for 3,000 calls
 */
export async function verifySlipImage(imageBase64: string): Promise<EasySlipResult> {
  if (!EASYSLIP_KEY) {
    return { ok: false, status: 500, raw: null, error: "EASYSLIP_API_KEY not configured" };
  }

  // Strip data URL prefix if present
  const base64 = imageBase64.includes(",")
    ? imageBase64.split(",")[1]
    : imageBase64;

  try {
    const res = await fetch(EASYSLIP_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${EASYSLIP_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ image: base64 }),
    });

    const raw = await res.json();

    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        raw,
        error: raw.message ?? `easyslip ${res.status}`,
      };
    }

    // Parse easyslip response (may vary; capture common fields)
    // Typical: { status: 200, data: { amount, receiver, ref1, ref2, date, ... } }
    const data = raw.data ?? raw;
    return {
      ok: true,
      status: 200,
      raw,
      amount: Number(data?.amount?.amount ?? data?.amount ?? 0) || undefined,
      ref: data?.ref1 ?? data?.ref ?? undefined,
      receiver: data?.receiver?.account?.name ?? data?.receiver?.name ?? data?.receiver ?? undefined,
      date: data?.date ?? data?.transDate ?? undefined,
    };
  } catch (e) {
    return {
      ok: false,
      status: 0,
      raw: null,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
