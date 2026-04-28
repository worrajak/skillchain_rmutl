import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createNotification } from "@/lib/telegram";

// POST /api/warranty-claims
// Body: { job_id, claim_reason, claim_severity?, claim_photos? }
// Employer opens a warranty claim — staff + student get notified
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { job_id, claim_reason, claim_severity = "MINOR", claim_photos = [] } = body;

  if (!job_id || !claim_reason) {
    return NextResponse.json({ error: "ต้องระบุ job_id และ claim_reason" }, { status: 400 });
  }

  // Verify job exists and is in warranty period
  const { data: job } = await supabase
    .from("skc_jobs")
    .select("*, supervisor:skc_users!skc_jobs_approved_by_staff_fkey(name), student:skc_users!skc_jobs_student_id_fkey(id, name)")
    .eq("id", job_id)
    .single();

  if (!job) return NextResponse.json({ error: "ไม่พบงาน" }, { status: 404 });

  // Only employer can claim
  if (job.employer_id !== user.id) {
    return NextResponse.json({ error: "เฉพาะผู้ว่าจ้างของงานนี้เท่านั้น" }, { status: 403 });
  }

  // Check warranty is active
  if (job.warranty_status !== "ACTIVE") {
    return NextResponse.json({
      error: "งานนี้ไม่อยู่ในระยะประกัน",
      hint: `สถานะประกันปัจจุบัน: ${job.warranty_status ?? "ไม่ได้เริ่ม"}`,
    }, { status: 400 });
  }

  // Check warranty hasn't expired
  if (job.warranty_end_at && new Date(job.warranty_end_at) < new Date()) {
    return NextResponse.json({ error: "หมดระยะประกันแล้ว" }, { status: 400 });
  }

  // Create claim
  const { data: claim, error } = await supabase
    .from("skc_warranty_claims")
    .insert({
      job_id,
      claimed_by: user.id,
      claim_reason,
      claim_severity,
      claim_photos,
      status: "OPEN",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Mark job as CLAIMED
  await supabase
    .from("skc_jobs")
    .update({ warranty_status: "CLAIMED" })
    .eq("id", job_id);

  // Notify staff supervisor + student + mentor
  const notifyUsers: { userId: string; role: string }[] = [];
  if (job.approved_by_staff) notifyUsers.push({ userId: job.approved_by_staff, role: "staff" });
  if (job.student_id) notifyUsers.push({ userId: job.student_id, role: "student" });
  if (job.mentor_id) notifyUsers.push({ userId: job.mentor_id, role: "mentor" });

  for (const u of notifyUsers) {
    await createNotification(supabase, {
      user_id: u.userId,
      type: "warranty_claim",
      title: `🚨 มีการ Claim ประกัน — ${job.title}`,
      body: `ผู้ว่าจ้างเปิด warranty claim (${claim_severity}): ${claim_reason.slice(0, 80)}`,
      link: `/project-staff/jobs/${job_id}`,
    });
  }

  return NextResponse.json({ success: true, claim });
}

// GET /api/warranty-claims?job_id=xxx&status=OPEN
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get("job_id");
  const status = searchParams.get("status");

  let query = supabase
    .from("skc_warranty_claims")
    .select("*, job:skc_jobs(id, title, employer_id, student_id, approved_by_staff), claimer:skc_users!skc_warranty_claims_claimed_by_fkey(name, email)")
    .order("created_at", { ascending: false });

  if (jobId) query = query.eq("job_id", jobId);
  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ claims: data });
}
