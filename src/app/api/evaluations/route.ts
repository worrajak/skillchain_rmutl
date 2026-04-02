import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// POST /api/evaluations — Teacher evaluates student
export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

  const weighted_score =
    score_quality * 0.4 + score_skill * 0.3 + score_time * 0.2 + score_tool * 0.1;

  const { data, error } = await supabase.from("evaluations").insert({
    job_id,
    student_id,
    teacher_id: user.id,
    score_quality,
    score_skill,
    score_time,
    score_tool,
    weighted_score,
    comment: comment || null,
  }).select().single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json(data, { status: 201 });
}

// GET /api/evaluations?student_id=xxx
export async function GET(request: NextRequest) {
  const supabase = await createClient();
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
