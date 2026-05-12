"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StaffSupervisorBadge } from "@/components/staff-supervisor-badge";
import { EmployerReviewForm } from "@/components/reviews/employer-review-form";
import { EscrowPaymentCard } from "@/components/escrow-payment-card";
import { ImageUpload } from "@/components/image-upload";
import { ImageGallery } from "@/components/image-gallery";
import { cn } from "@/lib/utils";
import {
  Briefcase, MapPin, Clock, Wallet, User, Calendar, CheckCircle, XCircle, Send, ArrowLeft,
  PartyPopper, ThumbsUp, Camera, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { getCampusLabel } from "@/types/database";
import Link from "next/link";
import { UserAvatar } from "@/components/avatar-upload";
import { QRCheckIn } from "@/components/qr-checkin";
import JobQrCard from "@/components/job-qr-card";
import WarrantyClaimForm from "@/components/warranty-claim-form";

const STATUS_TH: Record<string, { label: string; color: string }> = {
  PENDING_REVIEW: { label: "รอพิจารณา", color: "bg-orange-100 text-orange-800" },
  OPEN: { label: "เปิดรับ", color: "bg-green-100 text-green-800" },
  ASSIGNED: { label: "มอบหมายแล้ว", color: "bg-blue-100 text-blue-800" },
  IN_PROGRESS: { label: "กำลังทำ", color: "bg-cyan-100 text-cyan-800" },
  SUBMITTED: { label: "ส่งงานแล้ว", color: "bg-yellow-100 text-yellow-800" },
  COMPLETED: { label: "เสร็จสิ้น", color: "bg-green-100 text-green-800" },
  CANCELLED: { label: "ยกเลิก", color: "bg-gray-100 text-gray-800" },
  DISPUTED: { label: "มีข้อพิพาท", color: "bg-red-100 text-red-800" },
};

type JobImage = { id: string; image_url: string; caption?: string };

export default function EmployerJobDetailPage() {
  const { id } = useParams<{ id: string }>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [job, setJob] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [jobImages, setJobImages] = useState<JobImage[]>([]);

  const supabase = createClient();

  async function loadJob() {
    const res = await fetch(`/api/jobs/${id}`);
    if (res.ok) {
      const data = await res.json();
      setJob(data);
      if (data.work_start_date) setStartDate(data.work_start_date);
      if (data.work_end_date) setEndDate(data.work_end_date);
    }
    setLoading(false);
  }

  async function loadJobImages() {
    const { data } = await supabase
      .from("skc_job_images")
      .select("id, image_url, caption")
      .eq("job_id", id)
      .eq("image_type", "job")
      .order("sort_order");
    setJobImages(data ?? []);
  }

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setUserId(user.id);
    }
    init();
    loadJob();
    loadJobImages();
  }, [id]);

  async function handleProposeSchedule() {
    if (!startDate || !endDate) { toast.error("กรุณาเลือกวันเริ่มและวันจบ"); return; }
    setSubmitting(true);
    const res = await fetch(`/api/jobs/${id}/schedule`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ start_date: startDate, end_date: endDate }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (res.ok) { toast.success(data.message); loadJob(); }
    else toast.error(data.error);
  }

  async function handleConfirmSchedule() {
    setSubmitting(true);
    const res = await fetch(`/api/jobs/${id}/schedule`, { method: "PATCH" });
    const data = await res.json();
    setSubmitting(false);
    if (res.ok) { toast.success(data.message); loadJob(); }
    else toast.error(data.error);
  }

  async function handleConfirmCompletion() {
    setSubmitting(true);
    const res = await fetch(`/api/jobs/${id}/confirm-completion`, { method: "POST" });
    const data = await res.json();
    setSubmitting(false);
    if (res.ok) { toast.success(data.message); loadJob(); }
    else toast.error(data.error);
  }

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin size-8 border-4 border-blue-500 border-t-transparent rounded-full" /></div>;
  if (!job) return <div className="text-center py-20 text-muted-foreground">ไม่พบงาน</div>;

  const status = STATUS_TH[job.status] ?? { label: job.status, color: "bg-gray-100" };
  const staffName = job.staff_supervisor?.name;
  const studentName = job.student?.name;
  const isProposedByMe = job.schedule_proposed_by === userId;
  const isProposedByOther = job.schedule_proposed_by && !isProposedByMe;

  const canEdit = ["PENDING_REVIEW", "OPEN", "ASSIGNED"].includes(job.status) && job.employer_id === userId;

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <Link href="/employer/jobs">
          <Button variant="ghost" size="sm"><ArrowLeft className="size-4 mr-1" />กลับ</Button>
        </Link>
        {canEdit && (
          <Link href={`/employer/jobs/${job.id}/edit`}>
            <Button variant="outline" size="sm">
              ✏️ แก้ไขงาน
            </Button>
          </Link>
        )}
      </div>

      {/* Job Info */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <span className={cn("inline-flex rounded-full px-3 py-1 text-sm font-medium", status.color)}>{status.label}</span>
            <StaffSupervisorBadge name={staffName} userId={job.approved_by_staff} />
          </div>
          <CardTitle className="text-foreground">{job.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">{job.description}</p>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2"><MapPin className="size-4 text-muted-foreground" /><span>{job.location} ({getCampusLabel(String(job.campus))})</span></div>
            <div className="flex items-center gap-2"><Clock className="size-4 text-muted-foreground" /><span>กำหนด: {new Date(job.deadline).toLocaleDateString("th-TH")}</span></div>
            {job.pay_amount > 0 && <div className="flex items-center gap-2"><Wallet className="size-4 text-green-600" /><span className="text-green-700 font-bold">{job.pay_amount.toLocaleString()} TRPB</span></div>}
            {studentName && <div className="flex items-center gap-2"><UserAvatar url={job.student?.avatar_url ?? null} name={studentName} size="sm" /><span className="font-medium">{studentName}</span></div>}
          </div>
        </CardContent>
      </Card>

      {/* Job Images — ผู้ว่าจ้างอัปโหลด/ดูรูปเครื่อง */}
      {["PENDING_REVIEW", "OPEN", "ASSIGNED"].includes(job.status) ? (
        <Card>
          <CardContent className="pt-4 pb-4">
            <ImageUpload
              jobId={job.id}
              imageType="job"
              maxImages={4}
              label="รูปเครื่อง/ลักษณะงาน"
              existingImages={jobImages}
              onUploadComplete={loadJobImages}
            />
          </CardContent>
        </Card>
      ) : (
        <ImageGallery jobId={job.id} imageType="job" label="รูปเครื่อง/ลักษณะงาน" />
      )}

      {/* Smart Job QR — แสดงตั้งแต่ ASSIGNED ขึ้นไป (ใช้ทุก stage) */}
      {!["OPEN", "PENDING_REVIEW"].includes(job.status) && (
        <JobQrCard jobId={job.id} jobTitle={job.title} />
      )}

      {/* Warranty Claim — แสดงเฉพาะเมื่ออยู่ในประกัน */}
      {(job.status === "COMPLETED" || job.status === "IN_WARRANTY") && job.warranty_status === "ACTIVE" && (
        <WarrantyClaimForm
          jobId={job.id}
          jobTitle={job.title}
          warrantyEndAt={job.warranty_end_at}
          warrantyStatus={job.warranty_status}
        />
      )}

      {/* QR Check-in — เมื่อมอบหมายแล้วหรือกำลังทำ */}
      {["ASSIGNED", "IN_PROGRESS"].includes(job.status) && (
        <QRCheckIn jobId={job.id} title={job.title} />
      )}

      {/* Escrow — ฝากเงินเมื่อ ASSIGNED / IN_PROGRESS */}
      {["ASSIGNED", "IN_PROGRESS"].includes(job.status) && job.type === "PAID" && job.pay_amount > 0 && !job.escrow_tx && (
        <EscrowPaymentCard
          jobId={job.id}
          jobStatus={job.status}
          payAmount={job.pay_amount}
          hasMentor={!!job.mentor_id}
          escrowTx={job.escrow_tx}
          viewerRole="employer"
          studentWallet={job.student?.wallet_address ?? null}
          mentorWallet={null}
        />
      )}

      {/* Work Schedule — ASSIGNED */}
      {job.status === "ASSIGNED" && (
        <Card className="border-blue-200">
          <CardHeader>
            <CardTitle className="text-foreground text-sm flex items-center gap-2">
              <Calendar className="size-5 text-blue-600" />กำหนดวันทำงาน
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isProposedByOther && job.work_start_date ? (
              // นศ. เสนอวันมาแล้ว — ผู้จ้างยืนยัน
              <div className="space-y-3">
                <div className="rounded-lg bg-blue-50 p-4 text-center">
                  <p className="text-sm text-blue-800 font-medium mb-2">นักศึกษาเสนอวันทำงาน:</p>
                  <p className="text-lg font-bold text-blue-900">
                    {new Date(job.work_start_date).toLocaleDateString("th-TH")} — {new Date(job.work_end_date).toLocaleDateString("th-TH")}
                  </p>
                </div>
                <Button onClick={handleConfirmSchedule} disabled={submitting} className="w-full">
                  <CheckCircle className="size-4 mr-2" />{submitting ? "กำลังยืนยัน..." : "ยืนยันวันทำงาน"}
                </Button>
              </div>
            ) : isProposedByMe ? (
              <div className="rounded-lg bg-yellow-50 p-4 text-center">
                <p className="text-sm text-yellow-800">คุณเสนอวันทำงานแล้ว — รอนักศึกษายืนยัน</p>
                <p className="text-sm font-medium mt-1">
                  {job.work_start_date && new Date(job.work_start_date).toLocaleDateString("th-TH")} — {job.work_end_date && new Date(job.work_end_date).toLocaleDateString("th-TH")}
                </p>
              </div>
            ) : (
              // ยังไม่มีใครเสนอ — ผู้จ้างเสนอเอง
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-foreground text-xs">วันเริ่มงาน</Label>
                    <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-foreground text-xs">วันจบงาน</Label>
                    <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                  </div>
                </div>
                <Button onClick={handleProposeSchedule} disabled={submitting} className="w-full">
                  <Send className="size-4 mr-2" />{submitting ? "กำลังส่ง..." : "เสนอวันทำงาน"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Work Dates — IN_PROGRESS */}
      {(job.status === "IN_PROGRESS" || job.status === "SUBMITTED" || job.status === "COMPLETED") && job.work_start_date && (
        <Card>
          <CardContent className="flex items-center justify-between pt-4 pb-4">
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="size-4 text-blue-600" />
              <span className="text-foreground font-medium">วันทำงาน:</span>
              <span>{new Date(job.work_start_date).toLocaleDateString("th-TH")} — {new Date(job.work_end_date).toLocaleDateString("th-TH")}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Interim Review (IN_PROGRESS) — ผู้ว่าจ้างประเมินระหว่างทำงาน */}
      {job.status === "IN_PROGRESS" && userId && job.student_id && studentName && job.employer_id === userId && (
        <EmployerReviewForm
          jobId={job.id}
          employerId={userId}
          studentId={job.student_id}
          studentName={studentName}
          jobTitle={job.title}
          evalPhase="IN_PROGRESS"
          onSuccess={loadJob}
        />
      )}

      {/* SUBMITTED — Acceptance hero (banner + photos + accept button) */}
      {job.status === "SUBMITTED" && (
        <>
          {/* Hero banner */}
          <Card className="border-2 border-orange-300 bg-gradient-to-br from-yellow-50 via-orange-50 to-rose-50">
            <CardContent className="pt-5 pb-5 flex items-center gap-4">
              <div className="rounded-full bg-orange-100 p-3 shrink-0">
                <PartyPopper className="size-7 text-orange-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-foreground text-lg">นักศึกษาส่งมอบงานแล้ว!</p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  <strong>{studentName}</strong> ส่งงานเรียบร้อย — ตรวจรูปด้านล่างแล้วกดยืนยันรับงาน
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Completion photos — hero */}
          <Card className="border-green-200">
            <CardHeader className="pb-2 bg-green-50/50">
              <CardTitle className="text-base flex items-center gap-2 text-green-800">
                <CheckCircle className="size-5 text-green-600" />
                รูปงานเสร็จที่ส่งมอบ
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <ImageGallery jobId={job.id} imageType="completion" label="รูปงานเสร็จ" showEmpty />
            </CardContent>
          </Card>

          {/* Progress photos — supporting */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2 text-foreground">
                <Camera className="size-4 text-orange-600" />
                รูประหว่างทำงาน (อ้างอิง)
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-3">
              <ImageGallery jobId={job.id} imageType="progress" label="รูประหว่างทำงาน" showEmpty />
            </CardContent>
          </Card>

          {/* Acceptance card — big confirm button */}
          <Card className="border-2 border-green-400 bg-green-50/40 shadow-sm">
            <CardHeader>
              <CardTitle className="text-foreground flex items-center gap-2">
                <ThumbsUp className="size-5 text-green-600" />
                ยืนยันรับงาน
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Confirmation checklist */}
              <div className="grid grid-cols-2 gap-2">
                <div className={cn(
                  "rounded-lg p-3 border bg-white flex items-center gap-2",
                  job.employer_confirmed_completion && "border-green-400 bg-green-50",
                )}>
                  {job.employer_confirmed_completion
                    ? <CheckCircle className="size-5 text-green-600 shrink-0" />
                    : <Clock className="size-5 text-gray-300 shrink-0" />}
                  <div className="min-w-0">
                    <p className="font-medium text-sm">ผู้ว่าจ้าง</p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {job.employer_confirmed_completion ? "✅ ยืนยันแล้ว" : "รอยืนยัน"}
                    </p>
                  </div>
                </div>
                <div className={cn(
                  "rounded-lg p-3 border bg-white flex items-center gap-2",
                  job.staff_confirmed_completion && "border-green-400 bg-green-50",
                )}>
                  {job.staff_confirmed_completion
                    ? <CheckCircle className="size-5 text-green-600 shrink-0" />
                    : <Clock className="size-5 text-gray-300 shrink-0" />}
                  <div className="min-w-0">
                    <p className="font-medium text-sm">ผู้กำกับ</p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {staffName ? `${staffName}: ` : ""}{job.staff_confirmed_completion ? "✅ ยืนยันแล้ว" : "รอยืนยัน"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Big accept button */}
              {!job.employer_confirmed_completion && (
                <Button
                  onClick={handleConfirmCompletion}
                  disabled={submitting}
                  size="lg"
                  className="w-full bg-green-600 hover:bg-green-700 text-base h-12"
                >
                  {submitting
                    ? <><Loader2 className="size-5 mr-2 animate-spin" />กำลังยืนยัน...</>
                    : <><ThumbsUp className="size-5 mr-2" />ยืนยันรับงาน — งานเรียบร้อย</>}
                </Button>
              )}

              {job.employer_confirmed_completion && !job.staff_confirmed_completion && (
                <div className="rounded-lg bg-yellow-100 border border-yellow-300 p-3 text-center text-sm text-yellow-800 flex items-center justify-center gap-2">
                  <CheckCircle className="size-4" />
                  คุณยืนยันแล้ว — รอผู้กำกับยืนยัน
                </div>
              )}

              <p className="text-xs text-muted-foreground text-center">
                💡 เมื่อทั้ง 2 ฝ่ายยืนยัน → งานจะปิดและเริ่มประกัน 7 วันอัตโนมัติ
              </p>
            </CardContent>
          </Card>
        </>
      )}

      {/* COMPLETED — Photos shown read-only */}
      {job.status === "COMPLETED" && (
        <Card>
          <CardContent className="pt-4 pb-4 space-y-3">
            <ImageGallery jobId={job.id} imageType="completion" label="รูปงานเสร็จ (นศ.)" />
            <ImageGallery jobId={job.id} imageType="progress" label="รูประหว่างทำงาน (นศ.)" />
          </CardContent>
        </Card>
      )}

      {/* Completed */}
      {job.status === "COMPLETED" && (
        <>
          <Card className="border-green-200 bg-green-50">
            <CardContent className="flex items-center gap-3 pt-4 pb-4">
              <CheckCircle className="size-6 text-green-600" />
              <div>
                <p className="font-medium text-green-800">งานเสร็จสมบูรณ์</p>
                <p className="text-xs text-green-700">ให้คะแนนนักศึกษาด้านล่าง</p>
              </div>
            </CardContent>
          </Card>
          {job.type === "PAID" && job.pay_amount > 0 && (
            <EscrowPaymentCard
              jobId={job.id}
              jobStatus={job.status}
              payAmount={job.pay_amount}
              hasMentor={!!job.mentor_id}
              escrowTx={job.escrow_tx}
              viewerRole="employer"
              studentWallet={job.student?.wallet_address ?? null}
              mentorWallet={null}
              onPaymentRecorded={loadJob}
            />
          )}
          {userId && job.student_id && studentName && (
            <EmployerReviewForm
              jobId={job.id}
              employerId={userId}
              studentId={job.student_id}
              studentName={studentName}
              jobTitle={job.title}
            />
          )}
        </>
      )}
    </div>
  );
}
