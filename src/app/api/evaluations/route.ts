import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// POST /api/evaluations — Teacher/staff evaluates student
export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ตรวจ role: เฉพาะอาจารย์และ staff เท่านั้น
  const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single();
  const evaluatorRoles = ["teacher", "project_staff", "rmutl_staff", "admin", "superadmin"];
  if (!profile || !evaluatorRoles.includes(profile.role)) {
    return NextResponse.json({ error: "เฉพาะอาจารย์/คณะทำงานเท่านั้นที่ประเมินได้" }, { status: 403 });
  }

  const body = await request.json();
  const {
    job_id,
    student_id,
    score_quality,
    score_skill,
    score_time,
    score_tool,
    comment,
  } = body;

  if (!job_id || !student_id || !score_quality || !score_skill || !score_time || !score_tool) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Validate score ranges (1-5)
  for (const [name, val] of [["คุณภาพ", score_quality], ["ทักษะ", score_skill], ["ตรงเวลา", score_time], ["การใช้เครื่องมือ", score_tool]] as const) {
    const n = Number(val);
    if (!Number.isFinite(n) || n < 1 || n > 5) {
      return NextResponse.json({ error: `คะแนน${name}ต้องอยู่ระหว่าง 1-5` }, { status: 400 });
    }
  }

  // Verify job exists and is in evaluatable state
  const { data: job } = await supabase.from("jobs").select("status, student_id").eq("id", job_id).single();
  if (!job) return NextResponse.json({ error: "ไม่พบงาน" }, { status: 404 });
  if (!["SUBMITTED", "COMPLETED"].includes(job.status)) {
    return NextResponse.json({ error: "งานยังไม่อยู่ในสถานะที่ประเมินได้" }, { status: 400 });
  }
  if (job.student_id !== student_id) {
    return NextResponse.json({ error: "นักศึกษาไม่ตรงกับงานนี้" }, { status: 400 });
  }

  const weighted_score =
    Number(score_quality) * 0.4 + Number(score_skill) * 0.3 + Number(score_time) * 0.2 + Number(score_tool) * 0.1;

  const { data, error } = await supabase.from("evaluations").insert({
    job_id,
    student_id,
    teacher_id: user.id,
    score_quality: Number(score_quality),
    score_skill: Number(score_skill),
    score_time: Number(score_time),
    score_tool: Number(score_tool),
    weighted_score,
    comment: comment || null,
  }).select().single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json(data, { status: 201 });
}

// GET /api/evaluations?student_id=xxx (ต้อง login)
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const studentId = searchParams.get("student_id");

  let query = supabase
    .from("evaluations")
    .select("*, teacher:users!evaluations_teacher_id_fkey(name), job:jobs(title)")
    .order("created_at", { ascending: false });

  if (studentId) {
    query = query.eq("student_id", studentId);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json(data);
}
