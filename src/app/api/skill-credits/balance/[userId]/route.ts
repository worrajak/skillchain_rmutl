import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCreditInfo } from "@/lib/skill-credits";

// GET /api/skill-credits/balance/[userId]
// ดึงแต้มและระดับของ user
export async function GET(_request: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // User ดูของตัวเองได้เสมอ; staff ดูของคนอื่นได้
  if (user.id !== userId) {
    const { data: profile } = await supabase.from("skc_users").select("role").eq("id", user.id).single();
    if (!profile || !["admin", "superadmin", "rmutl_staff", "project_staff", "teacher"].includes(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const info = await getCreditInfo(supabase, userId);
  if (!info) return NextResponse.json({ error: "ไม่พบข้อมูล" }, { status: 404 });

  return NextResponse.json(info);
}
