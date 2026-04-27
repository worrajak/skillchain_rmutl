import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logWorkflowTransition, notifyNextAction } from "@/lib/gov-workflow";

// ========== POST: สร้างบันทึกขออนุมัติกิจกรรม ==========
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("skc_users").select("role, first_name, last_name").eq("id", user.id).single();
  if (!profile || !["admin", "superadmin", "rmutl_staff", "project_staff"].includes(profile.role)) {
    return NextResponse.json({ error: "เฉพาะ staff/admin" }, { status: 403 });
  }

  const body = await request.json();
  const {
    project_id, job_id, activity_title, description,
    num_students, total_hours, rate_per_hour, total_compensation,
    start_date, end_date, location, approval_ref,
  } = body;

  if (!activity_title) {
    return NextResponse.json({ error: "ต้องระบุชื่อกิจกรรม" }, { status: 400 });
  }

  const { data: activity, error } = await supabase
    .from("skc_activity_approvals")
    .insert({
      project_id,
      job_id,
      activity_title,
      description,
      num_students: num_students ?? 1,
      total_hours: total_hours ?? 0,
      rate_per_hour: rate_per_hour ?? 0,
      total_compensation: total_compensation ?? (total_hours * rate_per_hour),
      start_date,
      end_date,
      location,
      approval_ref,
      requested_by: user.id,
      requested_at: new Date().toISOString(),
      status: "PENDING_SIGNATURE",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Update job gov_status
  if (job_id) {
    await supabase.from("skc_jobs").update({
      gov_status: "ACTIVITY_APPROVAL_PENDING",
      gov_activity_id: activity.id,
      gov_project_id: project_id,
    }).eq("id", job_id);
  }

  // Log + Notify
  await logWorkflowTransition(supabase, {
    jobId: job_id,
    activityId: activity.id,
    toStatus: "ACTIVITY_APPROVAL_PENDING",
    actorId: user.id,
    note: `สร้างบันทึกขออนุมัติกิจกรรม: ${activity_title}`,
  });

  const { data: job } = supabase ? await supabase.from("skc_jobs").select("title").eq("id", job_id).single() : { data: null };
  await notifyNextAction({
    supabase,
    toStatus: "ACTIVITY_APPROVAL_PENDING",
    jobId: job_id,
    activityId: activity.id,
    jobTitle: job?.title,
  });

  return NextResponse.json({ success: true, activity });
}

// ========== GET: ดึงรายการขออนุมัติกิจกรรม ==========
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const jobId = searchParams.get("job_id");
  const projectId = searchParams.get("project_id");

  let query = supabase
    .from("skc_activity_approvals")
    .select(`
      *,
      job:skc_jobs(id, title, location, campus, pay_amount, student_id, employer_id, gov_status),
      project:skc_gov_projects(id, title, fiscal_year, total_budget, used_budget)
    `)
    .order("created_at", { ascending: false });

  if (status) query = query.eq("status", status);
  if (jobId) query = query.eq("job_id", jobId);
  if (projectId) query = query.eq("project_id", projectId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ activities: data });
}
