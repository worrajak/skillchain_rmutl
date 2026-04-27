import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { setPinForUser, ensureUserQrToken } from "@/lib/quick-auth";

// POST /api/quick-auth/pin
// Body: { user_id, regenerate?, custom_pin? }
// Staff only. Returns plaintext PIN + QR token.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("skc_users").select("role").eq("id", user.id).single();
  if (!profile || !["admin", "superadmin", "rmutl_staff", "project_staff"].includes(profile.role)) {
    return NextResponse.json({ error: "เฉพาะเจ้าหน้าที่" }, { status: 403 });
  }

  const { user_id, custom_pin } = await request.json();
  if (!user_id) return NextResponse.json({ error: "ต้องระบุ user_id" }, { status: 400 });

  // Generate / reset PIN
  const result = await setPinForUser(supabase, user_id, { customPin: custom_pin });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 });

  // Ensure user has QR
  const qrToken = await ensureUserQrToken(supabase, user_id);

  return NextResponse.json({
    ok: true,
    pin: result.pin,         // plaintext (only this once!)
    qr_token: qrToken,
    qr_url: `${process.env.NEXT_PUBLIC_APP_URL || ""}/quick-login?qr=${qrToken}`,
  });
}

// GET /api/quick-auth/pin?user_id=xxx
// Get user's PIN status (not the PIN itself)
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("user_id") ?? user.id;

  // Self or staff
  if (userId !== user.id) {
    const { data: profile } = await supabase.from("skc_users").select("role").eq("id", user.id).single();
    if (!profile || !["admin", "superadmin", "rmutl_staff", "project_staff"].includes(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const { data } = await supabase
    .from("skc_user_pins")
    .select("pin_set_at, last_used_at, failed_attempts, locked_until, must_change")
    .eq("user_id", userId)
    .maybeSingle();

  return NextResponse.json({
    has_pin: !!data,
    ...data,
  });
}
