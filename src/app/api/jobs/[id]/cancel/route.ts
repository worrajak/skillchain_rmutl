import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createNotification, createNotifications } from "@/lib/telegram";

// POST /api/jobs/[id]/cancel — submit cancellation request
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { reason, reason_detail } = body;

  if (!reason) return NextResponse.json({ error: "ต้องระบุเหตุผล" }, { status: 400 });

  // ตรวจว่าเป็นเจ้าของงาน
  const { data: job } = await supabase.from("skc_jobs").select("*").eq("id", id).single();
  if (!job) return NextResponse.json({ error: "ไม่พบงาน" }, { status: 404 });
  if (job.employer_id !== user.id) return NextResponse.json({ error: "ไม่ใช่เจ้าของงาน" }, { status: 403 });

  // สร้างคำร้อง
  const { data, error } = await supabase.from("skc_job_cancellation_requests").insert({
    job_id: id,
    requested_by: user.id,
    reason,
    reason_detail: reason_detail || null,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // แจ้งนักศึกษา
  if (job.student_id) {
    await createNotification(supabase, {
      user_id: job.student_id,
      type: "cancellation_request",
      title: "ผู้ว่าจ้างขอยกเลิกงาน",
      body: `งาน "${job.title}" — เหตุผล: ${reason_detail || reason}`,
      link: `/student/jobs`,
    });
  }

  // แจ้ง staff/admin
  const { data: staffUsers } = await supabase
    .from("skc_users")
    .select("id")
    .in("role", ["admin", "superadmin", "project_staff"])
    .eq("approval_status", "APPROVED");

  if (staffUsers) {
    await createNotifications(supabase,
      staffUsers.map((s) => ({
        user_id: s.id,
        type: "cancellation_request",
        title: "คำร้องขอยกเลิกงาน",
        body: `งาน "${job.title}" — รอการพิจารณา`,
        link: `/admin/jobs`,
      }))
    );
  }

  return NextResponse.json(data, { status: 201 });
}
