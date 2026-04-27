import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// POST /api/training/[id]/assess — assess a module for an enrollment
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: courseId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Check assessor role
  const { data: profile } = await supabase.from("skc_users").select("role").eq("id", user.id).single();
  const assessorRoles = ["teacher", "project_staff", "rmutl_staff", "admin", "superadmin"];
  if (!profile || !assessorRoles.includes(profile.role)) {
    return NextResponse.json({ error: "ไม่มีสิทธิ์ประเมิน" }, { status: 403 });
  }

  const body = await request.json();
  const { module_id, enrollment_id, passed, score, note, evidence_url } = body;

  // Verify module belongs to this course
  const { data: mod } = await supabase.from("training_modules")
    .select("id").eq("id", module_id).eq("course_id", courseId).single();
  if (!mod) return NextResponse.json({ error: "โมดูลไม่อยู่ในหลักสูตรนี้" }, { status: 400 });

  // Upsert assessment
  const { data, error } = await supabase.from("module_assessments").upsert({
    module_id,
    enrollment_id,
    passed: passed ?? false,
    score: score ?? null,
    note: note ?? null,
    evidence_url: evidence_url ?? null,
    assessor_id: user.id,
    assessed_at: new Date().toISOString(),
  }, { onConflict: "module_id,enrollment_id" }).select("id").single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Check if all modules passed → issue certificate
  const { data: modules } = await supabase.from("training_modules")
    .select("id").eq("course_id", courseId);
  const { data: assessments } = await supabase.from("module_assessments")
    .select("module_id, passed").eq("enrollment_id", enrollment_id);

  const passedModules = new Set(
    (assessments ?? []).filter((a) => a.passed).map((a) => a.module_id)
  );
  const allPassed = (modules ?? []).every((m) => passedModules.has(m.id));

  if (allPassed) {
    // Generate certificate number
    const certNumber = `TC-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
    await supabase.from("skc_training_enrollments").update({
      completed_at: new Date().toISOString(),
      certificate_number: certNumber,
    }).eq("id", enrollment_id);

    // Auto-issue credential if course specifies it
    const { data: course } = await supabase.from("skc_training_courses")
      .select("grants_credential_level").eq("id", courseId).single();

    if (course?.grants_credential_level) {
      const { data: enrollment } = await supabase.from("skc_training_enrollments")
        .select("trainee_id").eq("id", enrollment_id).single();

      if (enrollment) {
        await supabase.from("skc_student_credentials").insert({
          student_id: enrollment.trainee_id,
          credential_level: course.grants_credential_level,
          certified_by: "PROJECT_BARAMEE",
          certified_by_user_id: user.id,
          certificate_ref: certNumber,
          specialization: null,
          is_active: true,
        });
      }
    }

    return NextResponse.json({
      id: data.id,
      message: "ประเมินสำเร็จ — ผู้เรียนผ่านครบทุกโมดูล!",
      all_passed: true,
      certificate_number: certNumber,
    });
  }

  return NextResponse.json({
    id: data.id,
    message: "บันทึกผลประเมินแล้ว",
    all_passed: false,
  });
}
