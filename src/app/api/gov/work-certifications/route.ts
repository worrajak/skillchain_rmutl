import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logWorkflowTransition, notifyNextAction } from "@/lib/gov-workflow";
import { generateWorkCertificationDoc } from "@/lib/gov-documents";
import { awardCreditsForJobCompletion } from "@/lib/skill-credits";

// ========== POST: สร้างใบรับรองการปฏิบัติงาน ==========
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const {
    job_id, activity_id,
    total_hours_actual, work_quality, work_summary,
    cert_ref, auto_generate,
  } = body;

  if (!job_id) return NextResponse.json({ error: "ต้องระบุ job_id" }, { status: 400 });

  // Get job details
  const { data: job, error: jobErr } = await supabase
    .from("skc_jobs")
    .select("*, student:skc_users!skc_jobs_student_id_fkey(id, first_name, last_name, student_id), employer:skc_users!skc_jobs_employer_id_fkey(id, first_name, last_name)")
    .eq("id", job_id)
    .single();

  if (jobErr || !job) return NextResponse.json({ error: "ไม่พบงาน" }, { status: 404 });

  // Check permission
  const { data: profile } = await supabase.from("skc_users").select("role").eq("id", user.id).single();
  const isEmployer = job.employer_id === user.id;
  const isMentor = job.mentor_id === user.id;
  const isStaff = profile && ["admin", "superadmin", "rmutl_staff", "project_staff", "teacher"].includes(profile.role);

  if (!isEmployer && !isMentor && !isStaff) {
    return NextResponse.json({ error: "เฉพาะผู้ว่าจ้าง พี่เลี้ยง หรือ staff" }, { status: 403 });
  }

  // Create certification record
  const { data: cert, error } = await supabase
    .from("skc_work_certifications")
    .insert({
      activity_id,
      job_id,
      student_id: job.student_id,
      cert_ref,
      cert_date: new Date().toISOString().slice(0, 10),
      total_hours_actual,
      work_quality: work_quality || "ดี",
      work_summary: work_summary || "",
      certified_by_employer: isEmployer ? user.id : null,
      certified_by_mentor: isMentor ? user.id : null,
      certified_by_staff: isStaff ? user.id : null,
      employer_signed_at: isEmployer ? new Date().toISOString() : null,
      mentor_signed_at: isMentor ? new Date().toISOString() : null,
      staff_signed_at: isStaff ? new Date().toISOString() : null,
      status: "SIGNED",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Update job gov_status
  await supabase.from("skc_jobs").update({ gov_status: "WORK_CERTIFIED" }).eq("id", job_id);

  // Log + Notify
  await logWorkflowTransition(supabase, {
    jobId: job_id,
    activityId: activity_id,
    fromStatus: "IN_PROGRESS",
    toStatus: "WORK_CERTIFIED",
    actorId: user.id,
    note: `รับรองการปฏิบัติงาน (${total_hours_actual} ชม., ${work_quality})`,
  });

  // ===== SKILL CREDIT AWARD =====
  // งานได้รับการรับรองแล้ว → มอบแต้มทักษะให้ นศ. (Soul-Bound)
  if (job.student_id) {
    const qualityMap: Record<string, "excellent" | "good" | "fair"> = {
      "ดีมาก": "excellent",
      "ดี": "good",
      "พอใช้": "fair",
    };
    const quality = qualityMap[work_quality] ?? "good";

    await awardCreditsForJobCompletion(supabase, {
      jobId: job_id,
      studentId: job.student_id,
      quality,
      awardedBy: user.id,
    });
  }

  await notifyNextAction({
    supabase,
    toStatus: "WORK_CERTIFIED",
    jobId: job_id,
    jobTitle: job.title,
  });

  let fileUrl: string | undefined;

  // Auto-generate document
  if (auto_generate) {
    try {
      const buffer = await generateWorkCertificationDoc({
        docRef: cert_ref,
        docDate: new Date(),
        student: {
          name: `${job.student?.first_name || ""} ${job.student?.last_name || ""}`.trim(),
          studentId: job.student?.student_id || "",
        },
        job: {
          title: job.title,
          location: job.location,
          startDate: job.work_start_date || new Date(),
          endDate: job.work_end_date || new Date(),
          totalHours: total_hours_actual,
        },
        workQuality: work_quality,
        workSummary: work_summary,
        compensation: job.pay_amount,
        employer: {
          name: `${job.employer?.first_name || ""} ${job.employer?.last_name || ""}`.trim(),
          position: "ผู้ว่าจ้าง",
          organization: "มทร.ล้านนา",
        },
        staff: {
          name: "",
          position: "เจ้าหน้าที่โครงการ SkillChain",
        },
        organization: "มหาวิทยาลัยเทคโนโลยีราชมงคลล้านนา",
      });

      const filename = `work-cert-${cert.id}-${Date.now()}.docx`;
      const { data: uploaded } = await supabase.storage
        .from("official-documents")
        .upload(`work-certifications/${filename}`, buffer, {
          contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          upsert: true,
        });

      if (uploaded) {
        const { data: urlData } = supabase.storage.from("official-documents").getPublicUrl(uploaded.path);
        fileUrl = urlData.publicUrl;

        await supabase.from("skc_work_certifications").update({ cert_doc_url: fileUrl }).eq("id", cert.id);

        await supabase.from("skc_official_documents").insert({
          doc_type: "WORK_CERTIFICATION",
          doc_ref: cert_ref,
          doc_date: new Date().toISOString().slice(0, 10),
          title: `ใบรับรองการปฏิบัติงาน — ${job.title}`,
          activity_id,
          job_id,
          file_url: fileUrl,
          generated_by: user.id,
          generated_from: "work-certification-template-v1",
          status: "SIGNED",
        });
      }
    } catch (err) {
      console.error("Doc generation failed:", err);
    }
  }

  return NextResponse.json({ success: true, certification: cert, file_url: fileUrl });
}

// ========== GET: ดึงรายการใบรับรอง ==========
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get("job_id");
  const studentId = searchParams.get("student_id");

  let query = supabase
    .from("skc_work_certifications")
    .select("*, job:skc_jobs(id, title, location), student:skc_users!skc_work_certifications_student_id_fkey(id, first_name, last_name, student_id)")
    .order("created_at", { ascending: false });

  if (jobId) query = query.eq("job_id", jobId);
  if (studentId) query = query.eq("student_id", studentId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ certifications: data });
}
