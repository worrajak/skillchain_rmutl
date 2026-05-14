import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateInviteToken } from "@/lib/quick-auth";
import { notifyAdmin } from "@/lib/telegram";

// POST /api/invitations
// Staff creates invitation QR for employer/student
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("skc_users").select("role").eq("id", user.id).single();
  if (!profile || !["admin", "superadmin", "rmutl_staff", "project_staff"].includes(profile.role)) {
    return NextResponse.json({ error: "เฉพาะเจ้าหน้าที่" }, { status: 403 });
  }

  const body = await request.json();
  const {
    intended_role = "employer",
    notes,
    prefilled_name,
    prefilled_phone,
    prefilled_email,
    prefilled_org,
    expires_in_days = 30,
    max_uses = 1,
  } = body;

  if (!["employer", "student", "donor", "teacher"].includes(intended_role)) {
    return NextResponse.json({ error: "intended_role ไม่ถูกต้อง" }, { status: 400 });
  }

  const token = generateInviteToken();
  const expiresAt = new Date(Date.now() + expires_in_days * 24 * 60 * 60 * 1000);

  const { data, error } = await supabase
    .from("skc_invitations")
    .insert({
      invite_token: token,
      intended_role,
      created_by: user.id,
      notes,
      prefilled_name,
      prefilled_email,
      prefilled_phone,
      prefilled_org,
      expires_at: expiresAt.toISOString(),
      max_uses,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://skillchain-rmutl.vercel.app";

  notifyAdmin(supabase, {
    actorId: user.id,
    action: `สร้างคำเชิญ ${intended_role}`,
    targetType: "user",
    targetId: data?.id,
    targetTitle: prefilled_name ?? prefilled_email ?? token.slice(0, 8),
    link: `/admin/users`,
    severity: "info",
    extra: max_uses && max_uses > 1 ? `ใช้ได้ ${max_uses} ครั้ง` : undefined,
  }).catch(() => {});

  return NextResponse.json({
    ok: true,
    invite_token: token,
    url: `${baseUrl}/invite/${token}`,
    expires_at: expiresAt.toISOString(),
  });
}

// GET /api/invitations
export async function GET(_request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("skc_users").select("role").eq("id", user.id).single();
  if (!profile || !["admin", "superadmin", "rmutl_staff", "project_staff"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data } = await supabase
    .from("skc_invitations")
    .select("*, used:skc_users!skc_invitations_used_by_fkey(name, email)")
    .order("created_at", { ascending: false })
    .limit(50);

  return NextResponse.json({ invitations: data });
}
