import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// POST /api/reviews — Create employer or student review
export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { type } = body; // "employer" | "student" | "mentor"

  if (type === "employer") {
    // Employer reviews Student
    const { job_id, student_id, score_quality, score_punctuality, score_attitude, comment } = body;

    if (!job_id || !student_id || !score_quality || !score_punctuality || !score_attitude) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const overall_rating = (score_quality + score_punctuality + score_attitude) / 3;

    const { data, error } = await supabase.from("employer_reviews").insert({
      job_id,
      employer_id: user.id,
      student_id,
      score_quality,
      score_punctuality,
      score_attitude,
      overall_rating,
      comment: comment || null,
    }).select().single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json(data, { status: 201 });
  }

  if (type === "student") {
    // Student reviews Employer
    const { job_id, employer_id, score_clarity, score_payment, score_safety, comment } = body;

    if (!job_id || !employer_id || !score_clarity || !score_payment || !score_safety) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const overall_rating = (score_clarity + score_payment + score_safety) / 3;

    const { data, error } = await supabase.from("student_reviews").insert({
      job_id,
      student_id: user.id,
      employer_id,
      score_clarity,
      score_payment,
      score_safety,
      overall_rating,
      comment: comment || null,
    }).select().single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json(data, { status: 201 });
  }

  if (type === "mentor") {
    // Mentor reviews Trainee
    const { job_id, trainee_id, score_effort, score_safety, score_skill_dev, comment, recommend_promotion } = body;

    if (!job_id || !trainee_id || !score_effort || !score_safety || !score_skill_dev) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const weighted_score = (score_effort + score_safety + score_skill_dev) / 3;

    const { data, error } = await supabase.from("mentor_reviews").insert({
      job_id,
      mentor_id: user.id,
      trainee_id,
      score_effort,
      score_safety,
      score_skill_dev,
      weighted_score,
      comment: comment || null,
      recommend_promotion: recommend_promotion ?? false,
    }).select().single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json(data, { status: 201 });
  }

  return NextResponse.json({ error: "Invalid review type" }, { status: 400 });
}

// GET /api/reviews?type=employer&student_id=xxx
// GET /api/reviews?type=student&employer_id=xxx
// GET /api/reviews?type=mentor&trainee_id=xxx
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");

  if (type === "employer") {
    const studentId = searchParams.get("student_id");
    let query = supabase
      .from("employer_reviews")
      .select("*, employer:users!employer_reviews_employer_id_fkey(name), job:jobs(title)")
      .order("created_at", { ascending: false });
    if (studentId) query = query.eq("student_id", studentId);
    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(data);
  }

  if (type === "student") {
    const employerId = searchParams.get("employer_id");
    let query = supabase
      .from("student_reviews")
      .select("*, student:users!student_reviews_student_id_fkey(name), job:jobs(title)")
      .order("created_at", { ascending: false });
    if (employerId) query = query.eq("employer_id", employerId);
    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(data);
  }

  if (type === "mentor") {
    const traineeId = searchParams.get("trainee_id");
    let query = supabase
      .from("mentor_reviews")
      .select("*, mentor:users!mentor_reviews_mentor_id_fkey(name), job:jobs(title)")
      .order("created_at", { ascending: false });
    if (traineeId) query = query.eq("trainee_id", traineeId);
    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(data);
  }

  // Return summary views
  const summaryType = searchParams.get("summary");
  if (summaryType === "student") {
    const { data, error } = await supabase.from("student_rating_summary").select("*");
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(data);
  }
  if (summaryType === "employer") {
    const { data, error } = await supabase.from("employer_rating_summary").select("*");
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(data);
  }

  return NextResponse.json({ error: "Missing type parameter" }, { status: 400 });
}
