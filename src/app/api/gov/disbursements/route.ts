import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logWorkflowTransition, notifyNextAction } from "@/lib/gov-workflow";
import { generateDisbursementRequestDoc, DisbursementItem } from "@/lib/gov-documents";

// ========== POST: สร้างใบเบิกค่าตอบแทน ==========
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("skc_users").select("role").eq("id", user.id).single();
  if (!profile || !["admin", "superadmin", "rmutl_staff", "project_staff"].includes(profile.role)) {
    return NextResponse.json({ error: "เฉพาะ staff/admin" }, { status: 403 });
  }

  const body = await request.json();
  const {
    activity_id, disbursement_ref, fiscal_period,
    items, // [{ student_id, student_name, job_title, job_id, hours, rate_per_hour, amount, bank_account }]
    auto_generate,
  } = body;

  if (!activity_id) return NextResponse.json({ error: "ต้องระบุ activity_id" }, { status: 400 });
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "ต้องมีรายการอย่างน้อย 1 รายการ" }, { status: 400 });
  }

  const totalAmount = items.reduce((sum: number, item: any) => sum + (item.amount || 0), 0);

  // Create disbursement
  const { data: disb, error } = await supabase
    .from("skc_disbursements")
    .insert({
      activity_id,
      disbursement_ref,
      fiscal_period,
      items,
      total_amount: totalAmount,
      requested_by: user.id,
      requested_at: new Date().toISOString(),
      status: "PENDING_SIGNATURE",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Update jobs gov_status (all jobs in this disbursement)
  const jobIds = [...new Set(items.map((i: any) => i.job_id).filter(Boolean))];
  for (const jobId of jobIds) {
    await supabase.from("skc_jobs").update({ gov_status: "DISBURSEMENT_PENDING" }).eq("id", jobId);
    await logWorkflowTransition(supabase, {
      jobId,
      activityId: activity_id,
      fromStatus: "WORK_CERTIFIED",
      toStatus: "DISBURSEMENT_PENDING",
      actorId: user.id,
      note: `รวมในใบเบิก ${disbursement_ref} รวม ${totalAmount.toFixed(2)} บาท`,
    });
  }

  // Notify finance/staff
  await notifyNextAction({
    supabase,
    toStatus: "DISBURSEMENT_PENDING",
    activityId: activity_id,
    docRef: disbursement_ref,
  });

  let fileUrl: string | undefined;

  // Auto-generate document
  if (auto_generate) {
    try {
      const { data: activity } = await supabase
        .from("skc_activity_approvals")
        .select("*, project:skc_gov_projects(title, budget_source)")
        .eq("id", activity_id)
        .single();

      const buffer = await generateDisbursementRequestDoc({
        docRef: disbursement_ref,
        docDate: new Date(),
        projectTitle: activity?.project?.title || activity?.activity_title || "",
        activityTitle: activity?.activity_title || "",
        fiscalPeriod: fiscal_period,
        budgetSource: activity?.project?.budget_source || "งบประจำ",
        items: items.map((item: any) => ({
          studentName: item.student_name,
          studentId: item.student_id || "",
          jobTitle: item.job_title || "",
          hours: item.hours,
          ratePerHour: item.rate_per_hour,
          amount: item.amount,
          bankAccount: item.bank_account,
        })),
        totalAmount,
        requester: { name: "", position: "เจ้าหน้าที่โครงการ SkillChain" },
        headApprover: { position: "หัวหน้าโครงการ SkillChain" },
        financeApprover: { position: "ผู้อำนวยการกองคลัง" },
        finalApprover: { position: "อธิการบดี / รองอธิการบดีที่ได้รับมอบหมาย" },
        organization: "มหาวิทยาลัยเทคโนโลยีราชมงคลล้านนา",
      });

      const filename = `disbursement-${disb.id}-${Date.now()}.docx`;
      const { data: uploaded } = await supabase.storage
        .from("official-documents")
        .upload(`disbursements/${filename}`, buffer, {
          contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          upsert: true,
        });

      if (uploaded) {
        const { data: urlData } = supabase.storage.from("official-documents").getPublicUrl(uploaded.path);
        fileUrl = urlData.publicUrl;

        await supabase.from("skc_disbursements").update({ request_doc_url: fileUrl }).eq("id", disb.id);

        await supabase.from("skc_official_documents").insert({
          doc_type: "DISBURSEMENT_REQUEST",
          doc_ref: disbursement_ref,
          doc_date: new Date().toISOString().slice(0, 10),
          title: `แบบขอเบิกค่าตอบแทน — ${activity?.activity_title}`,
          activity_id,
          disbursement_id: disb.id,
          file_url: fileUrl,
          generated_by: user.id,
          generated_from: "disbursement-template-v1",
          status: "DRAFT",
        });
      }
    } catch (err) {
      console.error("Doc generation failed:", err);
    }
  }

  return NextResponse.json({ success: true, disbursement: disb, file_url: fileUrl });
}

// ========== GET: ดึงรายการใบเบิก ==========
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const activityId = searchParams.get("activity_id");

  let query = supabase
    .from("skc_disbursements")
    .select("*, activity:skc_activity_approvals(id, activity_title, project:skc_gov_projects(title))")
    .order("created_at", { ascending: false });

  if (status) query = query.eq("status", status);
  if (activityId) query = query.eq("activity_id", activityId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ disbursements: data });
}
