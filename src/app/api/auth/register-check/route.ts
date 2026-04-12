import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIP, RATE_LIMITS } from "@/lib/rate-limit";

// POST /api/auth/register-check — rate limit for registration
export async function POST(request: NextRequest) {
  const ip = getClientIP(request);
  const check = checkRateLimit(ip, RATE_LIMITS.register);

  if (!check.allowed) {
    const retryAfter = Math.ceil((check.resetAt - Date.now()) / 1000);
    return NextResponse.json(
      { error: `ลงทะเบียนบ่อยเกินไป กรุณารอ ${Math.ceil(retryAfter / 60)} นาที` },
      {
        status: 429,
        headers: { "Retry-After": String(retryAfter) },
      }
    );
  }

  return NextResponse.json({ allowed: true, remaining: check.remaining });
}
