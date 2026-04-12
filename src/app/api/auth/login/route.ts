import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIP, RATE_LIMITS } from "@/lib/rate-limit";

// POST /api/auth/login — rate limit check (actual login is client-side via Supabase)
// This endpoint is called BEFORE the Supabase signIn to enforce rate limiting
export async function POST(request: NextRequest) {
  const ip = getClientIP(request);
  const check = checkRateLimit(ip, RATE_LIMITS.login);

  if (!check.allowed) {
    const retryAfter = Math.ceil((check.resetAt - Date.now()) / 1000);
    return NextResponse.json(
      { error: `เข้าสู่ระบบบ่อยเกินไป กรุณารอ ${Math.ceil(retryAfter / 60)} นาที` },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfter),
          "X-RateLimit-Remaining": "0",
        },
      }
    );
  }

  return NextResponse.json(
    { allowed: true, remaining: check.remaining },
    { headers: { "X-RateLimit-Remaining": String(check.remaining) } }
  );
}
