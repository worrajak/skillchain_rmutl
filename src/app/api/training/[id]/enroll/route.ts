import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// POST /api/training/[id]/enroll — enroll in a course
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: courseId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Check course status
  const { data: course } = await supabase.from("skc_training_courses")
    .select("status, max_participants, is_open_to_external")
    .eq("id", courseId).single();

  if (!course) return NextResponse.json({ error: "ไม่พบหลักสูตร" }, { status: 404 });
  if (course.status !== "OPEN_ENROLLMENT") {
    return NextResponse.json({ error: "หลักสูตรไม่ได้เปิดรับสมัคร" }, { status: 400 });
  }

  // Check user role
  const { data: profile } = await supabase.from("skc_users").select("role").eq("id", user.id).single();
  const isExternal = profile?.role === "trainee";

  if (isExternal && !course.is_open_to_external) {
    return NextResponse.json({ error: "หลักสูตรนี้เฉพาะนักศึกษา มทร.ล้านนา" }, { status: 403 });
  }

  // Check capacity
  const { count } = await supabase.from("skc_training_enrollments")
    .select("*", { count: "exact", head: true }).eq("course_id", courseId);

  if ((count ?? 0) >= course.max_participants) {
    return NextResponse.json({ error: "หลักสูตรเต็มแล้ว" }, { status: 400 });
  }

  // Enroll
  const { error } = await supabase.from("skc_training_enrollments").insert({
    course_id: courseId,
    trainee_id: user.id,
    is_external: isExternal,
  });

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "คุณลงทะเบียนหลักสูตรนี้แล้ว" }, { status: 400 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ message: "ลงทะเบียนสำเร็จ" }, { status: 201 });
}
