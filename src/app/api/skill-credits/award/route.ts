import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { awardCredits, revokeCredits, type AwardReason } from "@/lib/skill-credits";

// POST /api/skill-credits/award — admin manually awards credits
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("skc_users").select("role").eq("id", user.id).single();
  if (!profile || !["admin", "superadmin", "rmutl_staff", "project_staff"].includes(profile.role)) {
    return NextResponse.json({ error: "เฉพาะ staff/admin" }, { status: 403 });
  }

  const body = await request.json();
  const { action, userId, amount, reason, note } = body;

  if (!userId || !amount || amount <= 0) {
    return NextResponse.json({ error: "ต้องระบุ userId และ amount > 0" }, { status: 400 });
  }

  if (action === "REVOKE") {
    // Only superadmin can revoke
    if (!["admin", "superadmin"].includes(profile.role)) {
      return NextResponse.json({ error: "เฉพาะ admin เท่านั้น" }, { status: 403 });
    }
    const result = await revokeCredits(supabase, {
      userId,
      amount,
      reason: note ?? "Manual correction",
      revokedBy: user.id,
    });
    return NextResponse.json(result);
  }

  // Default: AWARD
  const result = await awardCredits(supabase, {
    userId,
    amount,
    reason: (reason ?? "BONUS") as AwardReason,
    note,
    awardedBy: user.id,
  });

  return NextResponse.json(result);
}
