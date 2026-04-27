import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  lookupUserByQrToken,
  verifyUserPin,
  createQuickSession,
  QUICK_SESSION_COOKIE,
  SESSION_DURATION_DAYS,
} from "@/lib/quick-auth";

// POST /api/quick-auth/login
// Body: { qr_token: string, pin: string }
// Returns: { ok, user, session_token (also set as cookie) }
export async function POST(request: NextRequest) {
  const { qr_token, pin } = await request.json();

  if (!qr_token || !pin) {
    return NextResponse.json({ error: "ต้องระบุ qr_token และ pin" }, { status: 400 });
  }

  if (!/^\d{6}$/.test(pin)) {
    return NextResponse.json({ error: "PIN ต้องเป็นตัวเลข 6 หลัก" }, { status: 400 });
  }

  const supabase = await createClient();

  // 1. Lookup user by QR
  const user = await lookupUserByQrToken(supabase, qr_token);
  if (!user) {
    return NextResponse.json({ error: "QR Code ไม่ถูกต้อง" }, { status: 404 });
  }

  // 2. Verify PIN
  const verifyResult = await verifyUserPin(supabase, user.id, pin);
  if (!verifyResult.ok) {
    if (verifyResult.reason === "no_pin") {
      return NextResponse.json(
        { error: "บัญชีนี้ยังไม่ได้ตั้ง PIN กรุณาติดต่อเจ้าหน้าที่" },
        { status: 400 }
      );
    }
    if (verifyResult.reason === "locked") {
      const minsLeft = verifyResult.lockedUntil
        ? Math.ceil((verifyResult.lockedUntil.getTime() - Date.now()) / 60000)
        : 15;
      return NextResponse.json(
        { error: `บัญชีถูกล็อคชั่วคราว — กรุณาลองใหม่ใน ${minsLeft} นาที` },
        { status: 429 }
      );
    }
    return NextResponse.json(
      {
        error: "PIN ไม่ถูกต้อง",
        attempts_left: verifyResult.attemptsLeft,
      },
      { status: 401 }
    );
  }

  // 3. Create session
  const userAgent = request.headers.get("user-agent") ?? undefined;
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0] ?? request.headers.get("x-real-ip") ?? undefined;

  const { token, expiresAt } = await createQuickSession(supabase, user.id, {
    userAgent,
    ip,
  });

  // 4. Set cookie + return user
  const response = NextResponse.json({
    ok: true,
    user: {
      id: user.id,
      name: user.name,
      role: user.role,
    },
    session_expires_at: expiresAt.toISOString(),
  });

  response.cookies.set(QUICK_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_DURATION_DAYS * 24 * 60 * 60,
    path: "/",
  });

  return response;
}
