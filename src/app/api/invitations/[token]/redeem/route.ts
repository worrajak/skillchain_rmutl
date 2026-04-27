import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  setPinForUser,
  ensureUserQrToken,
  createQuickSession,
  QUICK_SESSION_COOKIE,
  SESSION_DURATION_DAYS,
} from "@/lib/quick-auth";

// POST /api/invitations/[token]/redeem
// Body: { name, email?, phone?, org? }
// Creates user account + auto-login (Tier 1 quick session)
export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const body = await request.json();
  const { name, email, phone, org } = body;

  if (!name) return NextResponse.json({ error: "ต้องระบุชื่อ" }, { status: 400 });

  const supabase = await createClient();

  // 1. Lookup invitation
  const { data: invite } = await supabase
    .from("skc_invitations")
    .select("*")
    .eq("invite_token", token)
    .maybeSingle();

  if (!invite) {
    return NextResponse.json({ error: "คำเชิญไม่ถูกต้อง" }, { status: 404 });
  }
  if (invite.revoked_at) {
    return NextResponse.json({ error: "คำเชิญถูกยกเลิก" }, { status: 410 });
  }
  if (new Date(invite.expires_at) < new Date()) {
    return NextResponse.json({ error: "คำเชิญหมดอายุแล้ว" }, { status: 410 });
  }
  if (invite.use_count >= invite.max_uses) {
    return NextResponse.json({ error: "คำเชิญถูกใช้ครบจำนวนแล้ว" }, { status: 410 });
  }

  // 2. Create user (manually, not through Supabase Auth — they don't need email/password)
  const userId = crypto.randomUUID();

  const { error: userErr } = await supabase.from("skc_users").insert({
    id: userId,
    email: email ?? `${userId.slice(0, 8)}@invited.skillchain.local`, // placeholder if no email
    name,
    phone,
    organization: org,
    role: invite.intended_role,
    approval_status: "APPROVED",         // pre-approved by staff invite
    is_active: true,
    email_verified: false,
    quick_auth_enabled: true,
  });

  if (userErr) {
    return NextResponse.json({ error: `สร้างบัญชีไม่สำเร็จ: ${userErr.message}` }, { status: 500 });
  }

  // 3. Generate PIN + QR
  const pinResult = await setPinForUser(supabase, userId);
  if (!pinResult.ok) {
    return NextResponse.json({ error: pinResult.error }, { status: 500 });
  }
  const qrToken = await ensureUserQrToken(supabase, userId);

  // 4. Mark invitation as used
  await supabase
    .from("skc_invitations")
    .update({
      used_by: userId,
      used_at: new Date().toISOString(),
      use_count: invite.use_count + 1,
    })
    .eq("invite_token", token);

  // 5. Auto-login
  const userAgent = request.headers.get("user-agent") ?? undefined;
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0] ?? undefined;
  const session = await createQuickSession(supabase, userId, { userAgent, ip });

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const response = NextResponse.json({
    ok: true,
    user: { id: userId, name, role: invite.intended_role },
    pin: pinResult.pin,                  // Show ONCE — user must save
    qr_token: qrToken,
    qr_url: `${baseUrl}/quick-login?qr=${qrToken}`,
    session_expires_at: session.expiresAt.toISOString(),
  });

  response.cookies.set(QUICK_SESSION_COOKIE, session.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_DURATION_DAYS * 24 * 60 * 60,
    path: "/",
  });

  return response;
}

// GET /api/invitations/[token]/redeem
// Check if invitation is still valid (for landing page)
export async function GET(_request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createClient();

  const { data: invite } = await supabase
    .from("skc_invitations")
    .select("intended_role, prefilled_name, prefilled_email, prefilled_phone, prefilled_org, expires_at, use_count, max_uses, revoked_at")
    .eq("invite_token", token)
    .maybeSingle();

  if (!invite) return NextResponse.json({ error: "ไม่พบคำเชิญ" }, { status: 404 });
  if (invite.revoked_at) return NextResponse.json({ error: "คำเชิญถูกยกเลิก", expired: true }, { status: 410 });
  if (new Date(invite.expires_at) < new Date()) {
    return NextResponse.json({ error: "หมดอายุแล้ว", expired: true }, { status: 410 });
  }
  if (invite.use_count >= invite.max_uses) {
    return NextResponse.json({ error: "ใช้ครบจำนวนแล้ว", expired: true }, { status: 410 });
  }

  return NextResponse.json({
    valid: true,
    intended_role: invite.intended_role,
    prefilled: {
      name: invite.prefilled_name,
      email: invite.prefilled_email,
      phone: invite.prefilled_phone,
      org: invite.prefilled_org,
    },
  });
}
