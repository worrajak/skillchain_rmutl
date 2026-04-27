import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { lookupUserByQrToken } from "@/lib/quick-auth";

// POST /api/quick-auth/lookup
// Step 1 of login: scan QR → return user info (without exposing email/role to public)
export async function POST(request: NextRequest) {
  const { qr_token } = await request.json();
  if (!qr_token) {
    return NextResponse.json({ error: "ต้องระบุ qr_token" }, { status: 400 });
  }

  const supabase = await createClient();
  const user = await lookupUserByQrToken(supabase, qr_token);
  if (!user) {
    return NextResponse.json({ error: "QR Code ไม่ถูกต้องหรือถูกยกเลิกแล้ว" }, { status: 404 });
  }

  return NextResponse.json({
    user_id: user.id,
    name: user.name,
    role: user.role,
    // ไม่ส่ง email กลับเพราะ public scan
  });
}
