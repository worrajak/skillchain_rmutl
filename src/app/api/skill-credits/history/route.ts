import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/skill-credits/history?user_id=xxx&limit=50
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("user_id") ?? user.id;
  const limit = parseInt(searchParams.get("limit") ?? "50", 10);

  // Permission check
  if (userId !== user.id) {
    const { data: profile } = await supabase.from("skc_users").select("role").eq("id", user.id).single();
    if (!profile || !["admin", "superadmin", "rmutl_staff", "project_staff", "teacher"].includes(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const { data, error } = await supabase
    .from("skc_credit_transactions")
    .select("id, tx_type, amount, reason, reason_note, job_id, course_id, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ transactions: data });
}
