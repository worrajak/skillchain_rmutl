"use client";

import { useEffect, useState, use } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ImageGallery } from "@/components/image-gallery";
import { ArrowLeft, User, Calendar, MapPin, Wallet, CheckCircle, Clock, Shield, Loader2, ExternalLink, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getCampusLabel } from "@/types/database";

const STATUS_TH: Record<string, { label: string; color: string }> = {
  PENDING_REVIEW: { label: "รอพิจารณา", color: "bg-orange-100 text-orange-800" },
  OPEN: { label: "เปิดรับ", color: "bg-green-100 text-green-800" },
  ASSIGNED: { label: "มอบหมายแล้ว", color: "bg-blue-100 text-blue-800" },
  IN_PROGRESS: { label: "กำลังทำ", color: "bg-cyan-100 text-cyan-800" },
  SUBMITTED: { label: "ส่งงานแล้ว", color: "bg-yellow-100 text-yellow-800" },
  COMPLETED: { label: "เสร็จสิ้น", color: "bg-green-100 text-green-800" },
  IN_WARRANTY: { label: "อยู่ในประกัน", color: "bg-purple-100 text-purple-800" },
  CLOSED: { label: "ปิดงาน", color: "bg-gray-100 text-gray-800" },
};

const STAGES = [
  { key: "PENDING_REVIEW", label: "รอพิจารณา" },
  { key: "OPEN", label: "เปิดรับ" },
  { key: "ASSIGNED", label: "มอบหมาย" },
  { key: "IN_PROGRESS", label: "ทำงาน" },
  { key: "SUBMITTED", label: "ส่งงาน" },
  { key: "COMPLETED", label: "เสร็จ" },
  { key: "IN_WARRANTY", label: "ประกัน" },
  { key: "CLOSED", label: "ปิดงาน" },
];

export default function StaffJobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [job, setJob] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [claims, setClaims] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const supabase = createClient();

  async function load() {
    setLoading(true);

    // 1. Job + relations (skip approved_by_staff — not a FK in Prisma)
    const { data: jobData, error: jobErr } = await supabase
      .from("skc_jobs")
      .select(`
        *,
        student:skc_users!skc_jobs_student_id_fkey(id, name, email, campus, faculty),
        employer:skc_users!skc_jobs_employer_id_fkey(id, name, email),
        mentor:skc_users!skc_jobs_mentor_id_fkey(id, name)
      `)
      .eq("id", id)
      .single();

    if (jobErr) {
      console.error("Load job error:", jobErr);
    }

    // 2. Supervisor — separate query (approved_by_staff is just a String column)
    let supervisor = null;
    if (jobData?.approved_by_staff) {
      const { data: sup } = await supabase
        .from("skc_users")
        .select("id, name, email")
        .eq("id", jobData.approved_by_staff)
        .single();
      supervisor = sup;
    }

    setJob({ ...jobData, supervisor });

    // 3. Workflow log — use skc_gov_workflow_log (has job_id + actor_id)
    if (jobData) {
      const { data: logsData } = await supabase
        .from("skc_gov_workflow_log")
        .select("id, from_status, to_status, note, created_at, actor_id")
        .eq("job_id", id)
        .order("created_at", { ascending: false });

      // Fetch actor names separately (no FK in schema)
      const actorIds = [...new Set((logsData ?? []).map((l) => l.actor_id).filter(Boolean))];
      let actorMap: Record<string, string> = {};
      if (actorIds.length > 0) {
        const { data: actors } = await supabase
          .from("skc_users")
          .select("id, name")
          .in("id", actorIds);
        actorMap = Object.fromEntries((actors ?? []).map((a) => [a.id, a.name]));
      }

      setLogs(
        (logsData ?? []).map((l) => ({
          ...l,
          action: l.to_status,
          actor: l.actor_id ? { name: actorMap[l.actor_id] } : null,
        }))
      );

      // 4. Warranty claims
      const { data: claimsData } = await supabase
        .from("skc_warranty_claims")
        .select("*")
        .eq("job_id", id)
        .order("created_at", { ascending: false });

      const claimerIds = [...new Set((claimsData ?? []).map((c) => c.claimed_by).filter(Boolean))];
      let claimerMap: Record<string, string> = {};
      if (claimerIds.length > 0) {
        const { data: claimers } = await supabase
          .from("skc_users")
          .select("id, name")
          .in("id", claimerIds);
        claimerMap = Object.fromEntries((claimers ?? []).map((u) => [u.id, u.name]));
      }
      setClaims(
        (claimsData ?? []).map((c) => ({
          ...c,
          claimer: c.claimed_by ? { name: claimerMap[c.claimed_by] } : null,
        }))
      );
    }

    setLoading(false);
  }

  useEffect(() => { load(); }, [id]);

  async function handleConfirm() {
    setSubmitting(true);
    const res = await fetch(`/api/jobs/${id}/confirm-completion`, { method: "POST" });
    const data = await res.json();
    setSubmitting(false);
    if (res.ok) { toast.success(data.message); load(); }
    else toast.error(data.error);
  }

  async function handleReleaseEscrow() {
    setSubmitting(true);
    const res = await fetch(`/api/jobs/${id}/release-escrow`, { method: "POST" });
    const data = await res.json();
    setSubmitting(false);
    if (res.ok) {
      toast.success(`${data.message} — TX: ${data.tx_hash?.slice(0, 12)}...`);
      load();
    } else {
      toast.error(data.error);
    }
  }

  if (loading) return <div className="p-8 text-center">กำลังโหลด...</div>;
  if (!job) return <div className="p-8 text-center">ไม่พบงาน</div>;

  const status = STATUS_TH[job.status] ?? { label: job.status, color: "bg-gray-100" };
  const currentStageIdx = STAGES.findIndex(s => s.key === job.status);

  // Warranty info
  const warrantyDays = job.warranty_period_days ?? 7;
  const warrantyEnd = job.warranty_end_at ? new Date(job.warranty_end_at) : null;
  const daysLeft = warrantyEnd ? Math.ceil((warrantyEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;

  return (
    <div className="space-y-4">
      <Link href="/project-staff/active-jobs" className="text-sm text-muted-foreground hover:underline inline-flex items-center gap-1">
        <ArrowLeft className="size-4" /> กลับรายการงาน
      </Link>

      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{job.title}</h1>
          <div className="flex flex-wrap items-center gap-2 mt-2 text-sm">
            <Badge className={cn(status.color, "text-foreground")}>{status.label}</Badge>
            {job.type === "PAID" && job.pay_amount > 0 && (
              <Badge variant="outline">💰 {Number(job.pay_amount).toLocaleString()} TRPB</Badge>
            )}
            <span className="text-muted-foreground">📍 {job.location}</span>
            <span className="text-muted-foreground">🏫 {getCampusLabel(job.campus)}</span>
          </div>
        </div>
      </div>

      {/* Progress Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">📊 สถานะงาน</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-1 mb-3">
            {STAGES.map((stage, idx) => (
              <div key={stage.key} className="flex items-center gap-1">
                <div
                  className={cn(
                    "px-2 py-1 rounded text-xs whitespace-nowrap",
                    idx < currentStageIdx && "bg-green-100 text-green-800",
                    idx === currentStageIdx && "bg-blue-600 text-white font-bold",
                    idx > currentStageIdx && "bg-slate-100 text-slate-500"
                  )}
                >
                  {idx + 1}. {stage.label}
                </div>
                {idx < STAGES.length - 1 && <span className="text-slate-300">→</span>}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* People */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">👥 ผู้เกี่ยวข้อง</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <div className="flex items-start gap-2 p-2 rounded bg-blue-50">
            <User className="size-4 text-blue-600 mt-0.5 shrink-0" />
            <div>
              <div className="text-xs text-blue-700">นักศึกษา (ผู้รับงาน)</div>
              <div className="font-medium">{job.student?.name ?? "-"}</div>
              {job.student && (
                <div className="text-xs text-muted-foreground">
                  {job.student.email} · {job.student.faculty}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-start gap-2 p-2 rounded bg-green-50">
            <User className="size-4 text-green-600 mt-0.5 shrink-0" />
            <div>
              <div className="text-xs text-green-700">ผู้ว่าจ้าง</div>
              <div className="font-medium">{job.employer?.name ?? "-"}</div>
              {job.employer && <div className="text-xs text-muted-foreground">{job.employer.email}</div>}
            </div>
          </div>

          {job.mentor && (
            <div className="flex items-start gap-2 p-2 rounded bg-purple-50">
              <User className="size-4 text-purple-600 mt-0.5 shrink-0" />
              <div>
                <div className="text-xs text-purple-700">พี่เลี้ยง (Mentor)</div>
                <div className="font-medium">{job.mentor.name}</div>
              </div>
            </div>
          )}

          <div className="flex items-start gap-2 p-2 rounded bg-amber-50">
            <Shield className="size-4 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <div className="text-xs text-amber-700">เจ้าหน้าที่กำกับ (Staff Supervisor)</div>
              <div className="font-medium">{job.supervisor?.name ?? "(ยังไม่มี)"}</div>
              {job.staff_approval_at && (
                <div className="text-xs text-muted-foreground">
                  อนุมัติ: {new Date(job.staff_approval_at).toLocaleString("th-TH")}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Schedule */}
      {(job.work_start_date || job.work_end_date || job.deadline) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">📅 กำหนดเวลา</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            {job.work_start_date && <div>เริ่มงาน: {new Date(job.work_start_date).toLocaleDateString("th-TH")}</div>}
            {job.work_end_date && <div>สิ้นสุด: {new Date(job.work_end_date).toLocaleDateString("th-TH")}</div>}
            {job.deadline && <div>กำหนดส่ง: {new Date(job.deadline).toLocaleDateString("th-TH")}</div>}
          </CardContent>
        </Card>
      )}

      {/* Warranty Info */}
      {job.warranty_status && job.warranty_status !== "NOT_STARTED" && (
        <Card className={daysLeft !== null && daysLeft < 3 ? "border-red-200 bg-red-50" : ""}>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="size-5 text-purple-600" />
              ระยะประกันงาน ({warrantyDays} วัน)
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            {job.warranty_start_at && (
              <div>เริ่มประกัน: {new Date(job.warranty_start_at).toLocaleString("th-TH")}</div>
            )}
            {warrantyEnd && (
              <div className="flex items-center gap-2">
                สิ้นสุดประกัน: {warrantyEnd.toLocaleString("th-TH")}
                {daysLeft !== null && daysLeft > 0 && (
                  <Badge variant="outline" className="text-xs">เหลืออีก {daysLeft} วัน</Badge>
                )}
                {daysLeft !== null && daysLeft <= 0 && (
                  <Badge className="text-xs bg-gray-200">หมดประกันแล้ว</Badge>
                )}
              </div>
            )}
            <div>สถานะประกัน: <Badge variant="outline">{job.warranty_status}</Badge></div>
          </CardContent>
        </Card>
      )}

      {/* Description */}
      <Card>
        <CardHeader><CardTitle className="text-base">📝 รายละเอียดงาน</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm whitespace-pre-wrap">{job.description}</p>
        </CardContent>
      </Card>

      {/* Photos */}
      <ImageGallery jobId={job.id} imageType="job" label="รูปก่อนทำ (ผู้จ้าง)" />
      {(["IN_PROGRESS", "SUBMITTED", "COMPLETED", "IN_WARRANTY", "CLOSED"].includes(job.status)) && (
        <>
          <ImageGallery jobId={job.id} imageType="progress" label="รูประหว่างทำงาน" />
          <ImageGallery jobId={job.id} imageType="completion" label="รูปงานเสร็จ" />
        </>
      )}

      {/* Confirmation status */}
      {job.status === "SUBMITTED" && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardHeader><CardTitle className="text-base">✅ ยืนยันงานเสร็จ</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <div className="flex gap-4 text-sm">
              <span className="flex items-center gap-1">
                {job.staff_confirmed_completion ? <CheckCircle className="size-4 text-green-600" /> : <Clock className="size-4 text-gray-400" />}
                Staff (คุณ)
              </span>
              <span className="flex items-center gap-1">
                {job.employer_confirmed_completion ? <CheckCircle className="size-4 text-green-600" /> : <Clock className="size-4 text-gray-400" />}
                ผู้ว่าจ้าง
              </span>
            </div>
            {!job.staff_confirmed_completion && (
              <Button onClick={handleConfirm} disabled={submitting} className="w-full">
                <CheckCircle className="size-4 mr-1" />
                {submitting ? "กำลังยืนยัน..." : "ยืนยันงานเสร็จ"}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Escrow release */}
      {job.status === "COMPLETED" && job.type === "PAID" && job.pay_amount > 0 && !job.escrow_tx && (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader><CardTitle className="text-base">💰 จ่ายค่าจ้าง</CardTitle></CardHeader>
          <CardContent>
            <Button onClick={handleReleaseEscrow} disabled={submitting} className="w-full bg-amber-600 hover:bg-amber-700">
              {submitting ? <><Loader2 className="size-4 mr-1 animate-spin" />กำลังจ่ายค่าจ้าง...</> : <><Wallet className="size-4 mr-1" />จ่ายค่าจ้าง {Number(job.pay_amount).toLocaleString()} TRPB</>}
            </Button>
          </CardContent>
        </Card>
      )}

      {job.escrow_tx && (
        <a
          href={`https://nile.tronscan.org/#/transaction/${job.escrow_tx}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
        >
          <ExternalLink className="size-3" />
          ดู Transaction บน TronScan
        </a>
      )}

      {/* Warranty Claims */}
      {claims.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="size-4 text-red-600" />
              คำขอประกัน ({claims.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {claims.map((c) => (
              <div key={c.id} className="border rounded p-3 text-sm">
                <div className="flex items-center justify-between mb-1">
                  <Badge>{c.status}</Badge>
                  <Badge variant="outline">{c.claim_severity}</Badge>
                </div>
                <div className="text-xs text-muted-foreground mb-1">
                  โดย {c.claimer?.name} · {new Date(c.claimed_at).toLocaleString("th-TH")}
                </div>
                <div>{c.claim_reason}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Audit Log */}
      <Card>
        <CardHeader><CardTitle className="text-base">📜 ประวัติการดำเนินงาน</CardTitle></CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground">ยังไม่มีประวัติ</p>
          ) : (
            <div className="space-y-2">
              {logs.map((log) => (
                <div key={log.id} className="flex gap-3 p-2 border-l-2 border-blue-200 text-sm">
                  <div className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(log.created_at).toLocaleString("th-TH")}
                  </div>
                  <div>
                    <div className="font-medium">{log.action}</div>
                    {log.note && <div className="text-xs text-muted-foreground">{log.note}</div>}
                    {log.actor && <div className="text-xs text-muted-foreground">โดย: {log.actor.name}</div>}
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
