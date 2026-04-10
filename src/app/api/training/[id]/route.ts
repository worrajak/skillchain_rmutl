import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/training/[id] — course detail + modules + enrollments
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: course }, { data: modules }, { data: enrollments }] = await Promise.all([
    supabase.from("training_courses")
      .select("*, instructor:users!training_courses_instructor_id_fkey(name, email)")
      .eq("id", id).single(),
    supabase.from("training_modules").select("*").eq("course_id", id).order("sort_order"),
    supabase.from("training_enrollments")
      .select("*, trainee:users!training_enrollments_trainee_id_fkey(name, email, role, avatar_url)")
      .eq("course_id", id).order("enrolled_at"),
  ]);

  if (!course) return NextResponse.json({ error: "ไม่พบหลักสูตร" }, { status: 404 });

  return NextResponse.json({ ...course, modules: modules ?? [], enrollments: enrollments ?? [] });
}

// PATCH /api/training/[id] — update course status
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { status } = body;

  const validTransitions: Record<string, string[]> = {
    DRAFT: ["OPEN_ENROLLMENT", "CANCELLED"],
    OPEN_ENROLLMENT: ["IN_PROGRESS", "CANCELLED"],
    IN_PROGRESS: ["COMPLETED", "CANCELLED"],
  };

  // ตรวจ role: เฉพาะ staff/teacher เท่านั้น
  const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single();
  const staffRoles = ["teacher", "project_staff", "rmutl_staff", "admin", "superadmin"];
  if (!profile || !staffRoles.includes(profile.role)) {
    return NextResponse.json({ error: "เฉพาะอาจารย์/คณะทำงานเท่านั้น" }, { status: 403 });
  }

  const { data: course } = await supabase.from("training_courses").select("status, instructor_id").eq("id", id).single();
  if (!course) return NextResponse.json({ error: "ไม่พบหลักสูตร" }, { status: 404 });

  const allowed = validTransitions[course.status];
  if (!allowed || !allowed.includes(status)) {
    return NextResponse.json({ error: `ไม่สามารถเปลี่ยนสถานะจาก ${course.status} เป็น ${status}` }, { status: 400 });
  }

  const { error } = await supabase.from("training_courses").update({ status }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ message: `เปลี่ยนสถานะเป็น ${status} แล้ว` });
}
