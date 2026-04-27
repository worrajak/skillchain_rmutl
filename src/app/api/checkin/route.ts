import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createNotification } from "@/lib/telegram";
import { checkRateLimit, getClientIP, RATE_LIMITS } from "@/lib/rate-limit";

// POST /api/checkin — student checks in/out for a job
export async function POST(request: NextRequest) {
  const ip = getClientIP(request);
  const rl = checkRateLimit(ip, RATE_LIMITS.apiWrite);
  if (!rl.allowed) return NextResponse.json({ error: "ส่งคำขอบ่อยเกินไป" }, { status: 429 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { job_id, type, latitude, longitude, note } = body;

  if (!job_id || !type) {
    return NextResponse.json({ error: "ต้องระบุ job_id และ type" }, { status: 400 });
  }
  if (!["CHECK_IN", "CHECK_OUT"].includes(type)) {
    return NextResponse.json({ error: "type ต้องเป็น CHECK_IN หรือ CHECK_OUT" }, { status: 400 });
  }

  // ตรวจสอบว่าเป็น student ของงานนี้
  const { data: job } = await supabase.from("skc_jobs")
    .select("student_id, employer_id, title, status")
    .eq("id", job_id).single();

  if (!job) return NextResponse.json({ error: "ไม่พบงาน" }, { status: 404 });
  if (job.student_id !== user.id) {
    return NextResponse.json({ error: "เฉพาะนักศึกษาที่ได้รับมอบหมายเท่านั้น" }, { status: 403 });
  }
  if (!["ASSIGNED", "IN_PROGRESS"].includes(job.status)) {
    return NextResponse.json({ error: "งานไม่อยู่ในสถานะที่เช็คอินได้" }, { status: 400 });
  }

  const { data, error } = await supabase.from("skc_job_checkins").insert({
    job_id,
    user_id: user.id,
    type,
    latitude: latitude ?? null,
    longitude: longitude ?? null,
    note: note ?? null,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // แจ้งผู้จ้าง
  const label = type === "CHECK_IN" ? "เช็คอินเข้างาน" : "เช็คเอาท์ออกงาน";
  await createNotification(supabase, {
    user_id: job.employer_id,
    type: "job_checkin",
    title: `นศ. ${label}`,
    body: `งาน "${job.title}" — ${new Date().toLocaleString("th-TH")}`,
    link: `/employer/jobs/${job_id}`,
  });

  return NextResponse.json(data, { status: 201 });
}

// GET /api/checkin?job_id=xxx — get check-in history
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const jobId = new URL(request.url).searchParams.get("job_id");
  if (!jobId) return NextResponse.json({ error: "ต้องระบุ job_id" }, { status: 400 });

  const { data, error } = await supabase.from("skc_job_checkins")
    .select("*, user:skc_users!skc_job_checkins_user_id_fkey(name)")
    .eq("job_id", jobId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}
