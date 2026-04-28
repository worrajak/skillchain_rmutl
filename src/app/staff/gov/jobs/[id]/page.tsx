import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { STATUS_LABELS, getNextAction, type GovStatus } from "@/lib/gov-workflow";
import Link from "next/link";
import { GenerateDocButton } from "@/components/gov/generate-doc-button";

export default async function GovJobDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("skc_users").select("role").eq("id", user.id).single();
  if (!profile || !["admin", "superadmin", "rmutl_staff", "project_staff", "teacher"].includes(profile.role)) {
    redirect("/");
  }

  const { data: job } = await supabase
    .from("skc_jobs")
    .select(`
      *,
      student:skc_users!skc_jobs_student_id_fkey(id, first_name, last_name, student_id),
      employer:skc_users!skc_jobs_employer_id_fkey(id, first_name, last_name)
    `)
    .eq("id", id)
    .single();

  if (!job) notFound();

  const { data: activity } = job.gov_activity_id
    ? await supabase.from("skc_activity_approvals").select("*").eq("id", job.gov_activity_id).single()
    : { data: null };

  const { data: certification } = await supabase
    .from("skc_work_certifications")
    .select("*")
    .eq("job_id", id)
    .order("created_at", { ascending: false })
    .maybeSingle();

  const { data: workflowLog } = await supabase
    .from("skc_gov_workflow_log")
    .select("*, actor:skc_users(first_name, last_name)")
    .eq("job_id", id)
    .order("created_at", { ascending: false });

  const { data: documents } = await supabase
    .from("skc_official_documents")
    .select("*")
    .eq("job_id", id)
    .order("generated_at", { ascending: false });

  const currentStatus = (job.gov_status || "DRAFT") as GovStatus;
  const nextAction = getNextAction(currentStatus);

  const stages: { key: GovStatus; label: string }[] = [
    { key: "DRAFT", label: "ร่าง" },
    { key: "ACTIVITY_APPROVAL_PENDING", label: "รออนุมัติกิจกรรม" },
    { key: "ACTIVITY_APPROVED", label: "อนุมัติแล้ว" },
    { key: "CONTRACT_SIGNED", label: "ลงนามสัญญา" },
    { key: "IN_PROGRESS", label: "ปฏิบัติงาน" },
    { key: "WORK_CERTIFIED", label: "รับรองงาน" },
    { key: "DISBURSEMENT_PENDING", label: "รอเบิก" },
    { key: "DISBURSEMENT_APPROVED", label: "อนุมัติเบิก" },
    { key: "PAID", label: "จ่ายแล้ว" },
    { key: "COMPLETED", label: "เสร็จสิ้น" },
  ];

  const currentStageIdx = stages.findIndex(s => s.key === currentStatus);

  return (
    <div className="container max-w-5xl mx-auto py-8 px-4">
      <Link href="/staff/gov" className="text-sm text-muted-foreground hover:underline">
        ← กลับ Dashboard
      </Link>

      <div className="mt-4 mb-6">
        <h1 className="text-2xl font-bold">{job.title}</h1>
        <div className="flex flex-wrap gap-2 mt-2 text-sm text-muted-foreground">
          <span>📍 {job.location}</span>
          <span>🏫 {job.campus}</span>
          <span>💰 {Number(job.pay_amount).toLocaleString("th-TH")} บาท</span>
        </div>
      </div>

      {/* Progress Bar */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>📊 สถานะเอกสารราชการ</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2 mb-4">
            {stages.map((stage, idx) => (
              <div key={stage.key} className="flex items-center gap-1">
                <div
                  className={`
                    px-2 py-1 rounded text-xs
                    ${idx < currentStageIdx ? "bg-green-100 text-green-800" : ""}
                    ${idx === currentStageIdx ? "bg-blue-600 text-white font-bold" : ""}
                    ${idx > currentStageIdx ? "bg-slate-100 text-slate-500" : ""}
                  `}
                >
                  {idx + 1}. {stage.label}
                </div>
                {idx < stages.length - 1 && <span className="text-slate-300">→</span>}
              </div>
            ))}
          </div>

          {nextAction && (
            <div className={`
              p-3 rounded border mt-2
              ${nextAction.urgency === "high" ? "bg-red-50 border-red-200" : "bg-amber-50 border-amber-200"}
            `}>
              <div className="font-bold text-sm">🎯 ขั้นตอนถัดไป</div>
              <div className="text-sm mt-1">
                <strong>{nextAction.actor}:</strong> {nextAction.action}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Job Details */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>📋 รายละเอียด</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div><strong>นักศึกษา:</strong> {job.student ? `${job.student.first_name} ${job.student.last_name} (${job.student.student_id})` : "-"}</div>
          <div><strong>ผู้ว่าจ้าง:</strong> {job.employer ? `${job.employer.first_name} ${job.employer.last_name}` : "-"}</div>
          <div><strong>เริ่มงาน:</strong> {job.work_start_date ? new Date(job.work_start_date).toLocaleDateString("th-TH") : "-"}</div>
          <div><strong>สิ้นสุด:</strong> {job.work_end_date ? new Date(job.work_end_date).toLocaleDateString("th-TH") : "-"}</div>
          {activity && (
            <>
              <div><strong>ชั่วโมงที่ขออนุมัติ:</strong> {activity.total_hours}</div>
              <div><strong>อัตราค่าตอบแทน:</strong> {Number(activity.rate_per_hour).toLocaleString("th-TH")} บาท/ชม.</div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Documents */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>📄 เอกสารราชการ</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Generate button — only when activity exists */}
          {activity && (
            <div className="border rounded-lg p-3 bg-blue-50/50 flex items-center justify-between gap-3 flex-wrap">
              <div className="text-sm">
                <p className="font-medium">บันทึกขออนุมัติกิจกรรม</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {activity.activity_title} · {activity.num_students} คน · {activity.total_hours} ชม. · {Number(activity.total_compensation).toLocaleString("th-TH")} บาท
                </p>
              </div>
              <GenerateDocButton activityId={activity.id} variant="activity-approval" />
            </div>
          )}
          {!activity && (
            <p className="text-xs text-amber-700 bg-amber-50 rounded p-2">
              ⚠️ งานนี้ยังไม่มี activity approval — DB trigger ควรสร้างให้อัตโนมัติเมื่อสร้างงาน
            </p>
          )}

          {/* Existing documents list */}
          {(documents || []).length === 0 ? (
            <p className="text-sm text-muted-foreground">ยังไม่เคยออกเอกสารสำหรับงานนี้</p>
          ) : (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">เอกสารที่ออกแล้ว ({documents?.length})</p>
              {(documents || []).map((doc: any) => (
                <div key={doc.id} className="flex justify-between items-center p-2 border rounded">
                  <div>
                    <div className="text-sm font-medium">{doc.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {doc.doc_type} · {doc.doc_ref || "(ไม่มีเลขที่)"} · {new Date(doc.generated_at).toLocaleString("th-TH")}
                    </div>
                  </div>
                  {doc.file_url && (
                    <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                      <Button size="sm" variant="outline">⬇️ ดาวน์โหลด</Button>
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Audit Log */}
      <Card>
        <CardHeader>
          <CardTitle>📜 บันทึกการดำเนินงาน (Audit Log)</CardTitle>
        </CardHeader>
        <CardContent>
          {(workflowLog || []).length === 0 ? (
            <p className="text-sm text-muted-foreground">ยังไม่มีรายการ</p>
          ) : (
            <div className="space-y-2">
              {(workflowLog || []).map((log: any) => (
                <div key={log.id} className="flex gap-3 p-2 border-l-2 border-blue-200">
                  <div className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(log.created_at).toLocaleString("th-TH")}
                  </div>
                  <div className="text-sm">
                    <div>
                      {log.from_status && <span className="text-muted-foreground">{STATUS_LABELS[log.from_status as GovStatus]} → </span>}
                      <strong>{STATUS_LABELS[log.to_status as GovStatus]}</strong>
                    </div>
                    {log.note && <div className="text-xs text-muted-foreground">{log.note}</div>}
                    {log.actor && <div className="text-xs text-muted-foreground">โดย: {log.actor.first_name} {log.actor.last_name}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
