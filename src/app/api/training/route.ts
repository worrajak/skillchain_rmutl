import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/training — list courses
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

  let query = supabase
    .from("skc_training_courses")
    .select("*, instructor:skc_users!skc_training_courses_instructor_id_fkey(name, email)")
    .order("start_date", { ascending: false });

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST /api/training — create course (staff/instructor only)
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("skc_users").select("role").eq("id", user.id).single();
  const allowedRoles = ["teacher", "project_staff", "rmutl_staff", "admin", "superadmin"];
  if (!profile || !allowedRoles.includes(profile.role)) {
    return NextResponse.json({ error: "ไม่มีสิทธิ์สร้างหลักสูตร" }, { status: 403 });
  }

  const body = await request.json();
  const { title, description, category, provider, start_date, end_date, total_hours,
    max_participants, min_participants, is_open_to_external, hourly_rate_trpb,
    per_pass_rate_trpb, total_budget_trpb, grants_credential_level, modules } = body;

  // Create course
  const { data: course, error } = await supabase.from("skc_training_courses").insert({
    title,
    description,
    category: category || "general",
    provider: provider || "RMUTL_TEACHER",
    instructor_id: user.id,
    status: "DRAFT",
    start_date,
    end_date,
    total_hours: total_hours || 0,
    max_participants: max_participants || 20,
    min_participants: min_participants || 1,
    is_open_to_external: is_open_to_external || false,
    payment_mode: "VOLUNTEER",
    hourly_rate_trpb: hourly_rate_trpb || 0,
    per_pass_rate_trpb: per_pass_rate_trpb || 0,
    total_budget_trpb: total_budget_trpb || 0,
    grants_credential_level: grants_credential_level || null,
  }).select("id").single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Create modules if provided
  if (modules && Array.isArray(modules) && modules.length > 0) {
    const moduleRows = modules.map((m: { title: string; hours: number; pass_criteria: string; competency_code?: string; description?: string }, i: number) => ({
      course_id: course.id,
      sort_order: i + 1,
      title: m.title,
      hours: m.hours || 0,
      pass_criteria: m.pass_criteria || "ผ่านการทดสอบ",
      competency_code: m.competency_code || null,
      description: m.description || null,
    }));
    await supabase.from("training_modules").insert(moduleRows);
  }

  return NextResponse.json({ id: course.id, message: "สร้างหลักสูตรสำเร็จ" }, { status: 201 });
}
