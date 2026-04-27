import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { onJobCreated } from "@/lib/gov-sync";

// POST /api/jobs — สร้างงานใหม่ + trigger gov workflow
// เรียกจาก frontend (/employer/jobs/new) แทน direct insert
// เพื่อให้ notification + gov sync ทำงานแน่นอน
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();

  const {
    title, description, type, job_category, location, campus,
    pay_amount, deadline, is_mentorship, hiring_mode,
  } = body;

  if (!title || !description) {
    return NextResponse.json({ error: "ต้องมีชื่องานและคำอธิบาย" }, { status: 400 });
  }

  // Insert job
  const { data: newJob, error } = await supabase
    .from("skc_jobs")
    .insert({
      title,
      description,
      type,
      job_category,
      location,
      campus,
      pay_amount: Number(pay_amount) || 0,
      deadline: deadline ? new Date(deadline).toISOString() : null,
      employer_id: user.id,
      is_mentorship: !!is_mentorship,
      hiring_mode: hiring_mode ?? "MODE_A",
      status: "PENDING_REVIEW",
    })
    .select("id, title")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!newJob) return NextResponse.json({ error: "Insert failed" }, { status: 500 });

  // ===== GOV SYNC HOOK =====
  // DB trigger จะสร้าง activity_approval อัตโนมัติ
  // Hook นี้ส่ง notification ให้ staff เพิ่มเติม
  try {
    await onJobCreated(supabase, newJob.id);
  } catch (err) {
    console.error("Gov sync hook failed (non-fatal):", err);
  }

  return NextResponse.json({ success: true, job: newJob });
}
