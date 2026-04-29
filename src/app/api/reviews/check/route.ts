import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/reviews/check?type=employer|student|mentor&job_id=...&eval_phase=POST_WORK
// Returns the logged-in user's existing review for the given job + phase, or null.
// Used by review forms to pre-render 'already reviewed' state instead of
// trying to insert and hitting unique constraint.
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");
  const jobId = searchParams.get("job_id");
  const evalPhase = searchParams.get("eval_phase") ?? "POST_WORK";

  if (!type || !jobId) {
    return NextResponse.json({ error: "type + job_id required" }, { status: 400 });
  }

  if (type === "employer") {
    const { data } = await supabase
      .from("skc_employer_reviews")
      .select("*")
      .eq("job_id", jobId)
      .eq("employer_id", user.id)
      .eq("eval_phase", evalPhase)
      .maybeSingle();
    return NextResponse.json({ existing: data ?? null });
  }

  if (type === "student") {
    const { data } = await supabase
      .from("skc_student_reviews")
      .select("*")
      .eq("job_id", jobId)
      .eq("student_id", user.id)
      .eq("eval_phase", evalPhase)
      .maybeSingle();
    return NextResponse.json({ existing: data ?? null });
  }

  if (type === "mentor") {
    const { data } = await supabase
      .from("skc_mentor_reviews")
      .select("*")
      .eq("job_id", jobId)
      .eq("mentor_id", user.id)
      .maybeSingle();
    return NextResponse.json({ existing: data ?? null });
  }

  return NextResponse.json({ error: "Invalid type" }, { status: 400 });
}
