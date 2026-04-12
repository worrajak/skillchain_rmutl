import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createNotifications } from "@/lib/telegram";
import { checkRateLimit, getClientIP, RATE_LIMITS } from "@/lib/rate-limit";

// GET /api/disputes — list disputes (ต้อง login)
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get("job_id");
  const status = searchParams.get("status");

  let query = supabase.from("disputes")
    .select("*, job:jobs(title), raised_by_user:users!disputes_raised_by_fkey(name), raised_against_user:users!disputes_raised_against_fkey(name), arbitrator:users!disputes_arbitrator_id_fkey(name)")
    .order("created_at", { ascending: false });

  if (jobId) query = query.eq("job_id", jobId);
  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}

// POST /api/disputes — raise a dispute
export async function POST(request: NextRequest) {
  const ip = getClientIP(request);
  const rl = checkRateLimit(ip, RATE_LIMITS.apiWrite);
  if (!rl.allowed) return NextResponse.json({ error: "ส่งคำขอบ่อยเกินไป" }, { status: 429 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { job_id, raised_against, category, description, evidence_urls } = body;

  if (!job_id || !raised_against || !category || !description) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // สร้าง dispute
  const { data, error } = await supabase.from("disputes").insert({
    job_id,
    raised_by: user.id,
    raised_against,
    category,
    description,
    evidence_urls: evidence_urls ?? [],
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // เปลี่ยนสถานะงานเป็น DISPUTED
  await supabase.from("jobs").update({ status: "DISPUTED" }).eq("id", job_id);

  // แจ้ง staff/admin + ฝ่ายตรงข้าม
  const { data: staffUsers } = await supabase.from("users").select("id")
    .in("role", ["admin", "superadmin", "project_staff"]).eq("approval_status", "APPROVED");

  const notifs = [
    { user_id: raised_against, type: "dispute", title: "มีข้อพิพาทใหม่", body: `งาน: ${description.slice(0, 50)}...`, link: `/admin/disputes` },
    ...(staffUsers ?? []).map((s) => ({
      user_id: s.id, type: "dispute", title: "ข้อพิพาทใหม่รอตรวจสอบ", body: `หมวด: ${category}`, link: `/admin/disputes`,
    })),
  ];
  await createNotifications(supabase, notifs);

  return NextResponse.json(data, { status: 201 });
}
