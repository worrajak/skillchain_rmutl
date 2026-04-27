import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateActivityApprovalDoc } from "@/lib/gov-documents";

// POST /api/gov/activity-approvals/[id]/generate-doc
// สร้างไฟล์ .docx บันทึกขออนุมัติกิจกรรม
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("skc_users").select("role").eq("id", user.id).single();
  if (!profile || !["admin", "superadmin", "rmutl_staff", "project_staff"].includes(profile.role)) {
    return NextResponse.json({ error: "เฉพาะ staff" }, { status: 403 });
  }

  // Get activity + related data
  const { data: activity } = await supabase
    .from("skc_activity_approvals")
    .select(`
      *,
      job:skc_jobs(id, title, location, campus),
      project:skc_gov_projects(id, title, fiscal_year, budget_source),
      requester:skc_users!skc_activity_approvals_requested_by_fkey(id, first_name, last_name)
    `)
    .eq("id", id)
    .single();

  if (!activity) return NextResponse.json({ error: "ไม่พบกิจกรรม" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const approverPosition = body.approver_position || "คณบดี";
  const approverName = body.approver_name;
  const purpose = body.purpose || activity.description || "เพื่อพัฒนาทักษะวิชาชีพและประสบการณ์การปฏิบัติงานจริงของนักศึกษา";

  // Generate DOCX
  const buffer = await generateActivityApprovalDoc({
    docRef: activity.approval_ref,
    docDate: new Date(),
    projectTitle: activity.project?.title || activity.activity_title,
    activityTitle: activity.activity_title,
    requester: {
      name: `${activity.requester?.first_name || ""} ${activity.requester?.last_name || ""}`.trim() || "ผู้ขอ",
      position: "เจ้าหน้าที่โครงการ SkillChain",
    },
    approver: {
      position: approverPosition,
      name: approverName,
    },
    purpose,
    numStudents: activity.num_students,
    totalHours: parseFloat(activity.total_hours),
    ratePerHour: parseFloat(activity.rate_per_hour),
    totalCompensation: parseFloat(activity.total_compensation),
    startDate: activity.start_date,
    endDate: activity.end_date,
    location: activity.location || activity.job?.location || "",
    budgetSource: activity.project?.budget_source || "งบประจำ",
    organization: "มหาวิทยาลัยเทคโนโลยีราชมงคลล้านนา",
  });

  // Upload to storage
  const filename = `activity-approval-${id}-${Date.now()}.docx`;
  const { data: uploaded, error: uploadErr } = await supabase.storage
    .from("official-documents")
    .upload(`activity-approvals/${filename}`, buffer, {
      contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      upsert: true,
    });

  if (uploadErr) {
    console.error("Storage upload failed:", uploadErr);
    // Fallback: return as direct download
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  const { data: urlData } = supabase.storage.from("official-documents").getPublicUrl(uploaded.path);

  // Register in official_documents
  await supabase.from("skc_official_documents").insert({
    doc_type: "ACTIVITY_APPROVAL",
    doc_ref: activity.approval_ref,
    doc_date: new Date().toISOString().slice(0, 10),
    title: `บันทึกขออนุมัติกิจกรรม — ${activity.activity_title}`,
    activity_id: id,
    job_id: activity.job_id,
    project_id: activity.project_id,
    file_url: urlData.publicUrl,
    generated_by: user.id,
    generated_from: "activity-approval-template-v1",
  });

  // Update activity with doc URL
  await supabase
    .from("skc_activity_approvals")
    .update({ approval_doc_url: urlData.publicUrl })
    .eq("id", id);

  return NextResponse.json({
    success: true,
    file_url: urlData.publicUrl,
    filename,
  });
}
