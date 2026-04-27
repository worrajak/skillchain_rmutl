import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit, getClientIP, RATE_LIMITS } from "@/lib/rate-limit";

// ตรวจสอบว่า reviewer เกี่ยวข้องกับงานจริง
async function verifyReviewer(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  jobId: string,
  reviewType: string
): Promise<{ ok: boolean; error?: string }> {
  const { data: job } = await supabase.from("skc_jobs").select("employer_id, student_id, mentor_id, status").eq("id", jobId).single();
  if (!job) return { ok: false, error: "ไม่พบงานนี้" };

  // งานต้องอยู่ในสถานะที่ประเมินได้
  if (!["SUBMITTED", "COMPLETED"].includes(job.status)) {
    return { ok: false, error: "งานยังไม่อยู่ในสถานะที่สามารถประเมินได้" };
  }

  const { data: reviewer } = await supabase.from("skc_users").select("role").eq("id", userId).single();

  switch (reviewType) {
    case "employer":
      // ผู้จ้างให้ดาว นศ. — ต้องเป็นเจ้าของงาน
      if (job.employer_id !== userId) return { ok: false, error: "เฉพาะผู้ว่าจ้างของงานนี้เท่านั้น" };
      break;
    case "student":
      // นศ.ให้ดาวผู้จ้าง — ต้องเป็น นศ.ที่ทำงานนี้
      if (job.student_id !== userId) return { ok: false, error: "เฉพาะนักศึกษาที่ทำงานนี้เท่านั้น" };
      break;
    case "mentor":
      // Mentor ประเมิน Trainee — ต้องเป็น mentor ของงานนี้
      if (job.mentor_id !== userId) return { ok: false, error: "เฉพาะพี่เลี้ยงของงานนี้เท่านั้น" };
      break;
    case "teacher":
      // อาจารย์/staff ประเมิน — ต้องมี role ที่เหมาะสม
      if (!reviewer || !["teacher", "rmutl_staff", "project_staff", "admin", "superadmin"].includes(reviewer.role)) {
        return { ok: false, error: "เฉพาะอาจารย์/คณะทำงานเท่านั้น" };
      }
      break;
    default:
      return { ok: false, error: "ประเภทการประเมินไม่ถูกต้อง" };
  }

  return { ok: true };
}

// POST /api/reviews — Create review (ตรวจสอบสิทธิ์เฉพาะงาน)
export async function POST(request: NextRequest) {
  const ip = getClientIP(request);
  const rl = checkRateLimit(ip, RATE_LIMITS.apiWrite);
  if (!rl.allowed) return NextResponse.json({ error: "ส่งคำขอบ่อยเกินไป" }, { status: 429 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { type, job_id } = body;

  if (!job_id) return NextResponse.json({ error: "ต้องระบุ job_id" }, { status: 400 });

  // ตรวจสอบสิทธิ์
  const check = await verifyReviewer(supabase, user.id, job_id, type);
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: 403 });

  if (type === "employer") {
    const { student_id, score_quality, score_punctuality, score_attitude, comment } = body;
    if (!student_id || !score_quality || !score_punctuality || !score_attitude) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    const overall_rating = (score_quality + score_punctuality + score_attitude) / 3;
    const { data, error } = await supabase.from("skc_employer_reviews").insert({
      job_id, employer_id: user.id, student_id,
      score_quality, score_punctuality, score_attitude, overall_rating,
      comment: comment || null,
    }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(data, { status: 201 });
  }

  if (type === "student") {
    const { employer_id, score_clarity, score_payment, score_safety, comment } = body;
    if (!employer_id || !score_clarity || !score_payment || !score_safety) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    const overall_rating = (score_clarity + score_payment + score_safety) / 3;
    const { data, error } = await supabase.from("skc_student_reviews").insert({
      job_id, student_id: user.id, employer_id,
      score_clarity, score_payment, score_safety, overall_rating,
      comment: comment || null,
    }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(data, { status: 201 });
  }

  if (type === "mentor") {
    const { trainee_id, score_effort, score_safety, score_skill_dev, comment, recommend_promotion } = body;
    if (!trainee_id || !score_effort || !score_safety || !score_skill_dev) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    const weighted_score = (score_effort + score_safety + score_skill_dev) / 3;
    const { data, error } = await supabase.from("skc_mentor_reviews").insert({
      job_id, mentor_id: user.id, trainee_id,
      score_effort, score_safety, score_skill_dev, weighted_score,
      comment: comment || null, recommend_promotion: recommend_promotion ?? false,
    }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(data, { status: 201 });
  }

  return NextResponse.json({ error: "Invalid review type" }, { status: 400 });
}

// GET /api/reviews?type=employer&student_id=xxx (ต้อง login)
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");

  if (type === "employer") {
    const studentId = searchParams.get("student_id");
    let query = supabase.from("skc_employer_reviews")
      .select("*, employer:skc_users!skc_employer_reviews_employer_id_fkey(name), job:skc_jobs(title)")
      .order("created_at", { ascending: false });
    if (studentId) query = query.eq("student_id", studentId);
    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(data);
  }

  if (type === "student") {
    const employerId = searchParams.get("employer_id");
    let query = supabase.from("skc_student_reviews")
      .select("*, student:skc_users!skc_student_reviews_student_id_fkey(name), job:skc_jobs(title)")
      .order("created_at", { ascending: false });
    if (employerId) query = query.eq("employer_id", employerId);
    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(data);
  }

  if (type === "mentor") {
    const traineeId = searchParams.get("trainee_id");
    let query = supabase.from("skc_mentor_reviews")
      .select("*, mentor:skc_users!skc_mentor_reviews_mentor_id_fkey(name), job:skc_jobs(title)")
      .order("created_at", { ascending: false });
    if (traineeId) query = query.eq("trainee_id", traineeId);
    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(data);
  }

  const summaryType = searchParams.get("summary");
  if (summaryType === "student") {
    const { data, error } = await supabase.from("skc_student_rating_summary").select("*");
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(data);
  }
  if (summaryType === "employer") {
    const { data, error } = await supabase.from("skc_employer_rating_summary").select("*");
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(data);
  }

  return NextResponse.json({ error: "Missing type parameter" }, { status: 400 });
}
