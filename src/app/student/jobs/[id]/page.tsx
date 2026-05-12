"use client";

import { useEffect, useState, useCallback } from "react";
import { use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  ArrowLeft, Briefcase, MapPin, Wallet, User, Shield, Calendar, Clock,
  CheckCircle, Camera, Send, Loader2, AlertCircle, Hourglass, PartyPopper,
} from "lucide-react";
import { toast } from "sonner";
import { ImageUpload } from "@/components/image-upload";
import { ImageGallery } from "@/components/image-gallery";
import { CameraCapture } from "@/components/camera-capture";
import { UserAvatar } from "@/components/user-avatar";
import { TeamStrip } from "@/components/team-strip";
import { StudentReviewForm } from "@/components/reviews/student-review-form";

const STATUS_TH: Record<string, { label: string; color: string }> = {
  ASSIGNED: { label: "ได้รับมอบหมาย", color: "bg-blue-100 text-blue-800" },
  CONFIRMED: { label: "ยืนยันวันแล้ว", color: "bg-cyan-100 text-cyan-800" },
  IN_PROGRESS: { label: "กำลังทำ", color: "bg-cyan-100 text-cyan-800" },
  SUBMITTED: { label: "ส่งงานแล้ว", color: "bg-yellow-100 text-yellow-800" },
  COMPLETED: { label: "เสร็จสิ้น", color: "bg-green-100 text-green-800" },
  IN_WARRANTY: { label: "อยู่ในประกัน", color: "bg-purple-100 text-purple-800" },
  CLOSED: { label: "ปิดงาน", color: "bg-gray-100 text-gray-800" },
};

type JobImage = { id: string; image_url: string; image_type: string; caption?: string };

export default function StudentJobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const supabase = createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [job, setJob] = useState<any>(null);
  const [supervisorName, setSupervisorName] = useState<string | null>(null);
  const [progressImages, setProgressImages] = useState<JobImage[]>([]);
  const [completionImages, setCompletionImages] = useState<JobImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  // Schedule form state
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [scheduling, setScheduling] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Camera capture state (replaces drag-and-drop on mobile)
  const [cameraType, setCameraType] = useState<"progress" | "completion" | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }
    setUserId(user.id);

    const { data: jobData, error } = await supabase
      .from("skc_jobs")
      .select(`
        *,
        employer:skc_users!skc_jobs_employer_id_fkey(id, name, email, organization)
      `)
      .eq("id", id)
      .single();

    if (error || !jobData) {
      toast.error("ไม่พบงาน");
      setLoading(false);
      return;
    }

    // Permission check: only the assigned student (or admin/staff) can view
    if (jobData.student_id && jobData.student_id !== user.id) {
      // Check role
      const { data: u } = await supabase.from("skc_users").select("role").eq("id", user.id).single();
      const allowed = ["admin", "superadmin", "project_staff", "rmutl_staff"].includes(u?.role ?? "");
      if (!allowed) {
        setForbidden(true);
        setLoading(false);
        return;
      }
    }

    setJob(jobData);
    setStartDate(jobData.work_start_date ?? "");
    setEndDate(jobData.work_end_date ?? "");

    // Supervisor name (separate query — no FK)
    if (jobData.approved_by_staff) {
      const { data: sup } = await supabase
        .from("skc_users")
        .select("name")
        .eq("id", jobData.approved_by_staff)
        .single();
      setSupervisorName(sup?.name ?? null);
    } else {
      setSupervisorName(null);
    }

    // Job images
    const { data: imgs } = await supabase
      .from("skc_job_images")
      .select("id, image_url, image_type, caption")
      .eq("job_id", id)
      .order("sort_order");
    const all = imgs ?? [];
    setProgressImages(all.filter((i) => i.image_type === "progress"));
    setCompletionImages(all.filter((i) => i.image_type === "completion"));

    setLoading(false);
  }, [id, supabase, router]);

  useEffect(() => { load(); }, [load]);

  async function handleProposeSchedule() {
    if (!startDate || !endDate) { toast.error("กรุณาระบุวันเริ่ม + วันสิ้นสุด"); return; }
    if (new Date(endDate) < new Date(startDate)) { toast.error("วันสิ้นสุดต้องไม่ก่อนวันเริ่ม"); return; }
    setScheduling(true);
    const res = await fetch(`/api/jobs/${id}/schedule`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ start_date: startDate, end_date: endDate }),
    });
    const data = await res.json();
    setScheduling(false);
    if (res.ok) { toast.success(data.message); load(); }
    else toast.error(data.error);
  }

  async function handleConfirmSchedule() {
    setConfirming(true);
    const res = await fetch(`/api/jobs/${id}/schedule`, { method: "PATCH" });
    const data = await res.json();
    setConfirming(false);
    if (res.ok) { toast.success(data.message); load(); }
    else toast.error(data.error);
  }

  async function handleSubmit() {
    if (completionImages.length === 0) {
      toast.error("กรุณาอัปโหลด 'รูปงานเสร็จ' อย่างน้อย 1 รูปก่อนส่งมอบงาน");
      return;
    }
    if (!confirm("ยืนยันส่งมอบงาน?\n\nเมื่อส่งแล้ว จะรอผู้ว่าจ้าง + คณะทำงานยืนยัน\nคุณจะไม่สามารถอัปโหลดรูปเพิ่มได้")) return;

    setSubmitting(true);
    const res = await fetch(`/api/jobs/${id}/submit`, { method: "POST" });
    const data = await res.json();
    setSubmitting(false);
    if (res.ok) { toast.success(data.message); load(); }
    else toast.error(data.error);
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="size-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (forbidden) {
    return (
      <Card>
        <CardContent className="py-12 text-center space-y-3">
          <AlertCircle className="size-10 mx-auto text-red-500" />
          <p className="font-medium">คุณไม่มีสิทธิ์ดูงานนี้</p>
          <p className="text-sm text-muted-foreground">งานนี้อาจมอบหมายให้นักศึกษาคนอื่น</p>
          <Link href="/student/jobs"><Button variant="outline"><ArrowLeft className="size-4 mr-1" />กลับหน้างาน</Button></Link>
        </CardContent>
      </Card>
    );
  }

  if (!job) return null;

  const status = STATUS_TH[job.status] ?? { label: job.status, color: "bg-gray-100" };
  const isMine = job.student_id === userId;
  const canUploadImages = isMine && ["ASSIGNED", "CONFIRMED", "IN_PROGRESS"].includes(job.status);
  // ส่งมอบงานได้ตั้งแต่ CONFIRMED (ยืนยันวันแล้ว) — ระบบจะข้ามไป SUBMITTED
  const canSubmit = isMine && ["CONFIRMED", "IN_PROGRESS"].includes(job.status);
  const canProposeSchedule = isMine && job.status === "ASSIGNED";
  const canConfirmSchedule =
    isMine &&
    job.status === "ASSIGNED" &&
    job.work_start_date &&
    job.schedule_proposed_by &&
    job.schedule_proposed_by !== userId;
  const isReadOnly = ["SUBMITTED", "COMPLETED", "IN_WARRANTY", "CLOSED"].includes(job.status);

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <Link href="/student/jobs">
        <Button variant="ghost" size="sm"><ArrowLeft className="size-4 mr-1" />กลับ</Button>
      </Link>

      {/* Header */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex-1 min-w-0">
              <CardTitle className="text-xl">{job.title}</CardTitle>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <Badge className={cn(status.color, "text-xs")}>{status.label}</Badge>
                {job.pay_amount > 0 && (
                  <Badge variant="outline" className="text-xs text-green-700 font-medium">
                    <Wallet className="size-3 mr-1" />
                    {job.pay_amount.toLocaleString()} TRPB
                  </Badge>
                )}
                <Badge variant="outline" className="text-xs">{job.type}</Badge>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground whitespace-pre-wrap">{job.description}</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-3 border-t">
            <div className="flex items-center gap-2">
              <MapPin className="size-4 text-muted-foreground" />
              <span>{job.location}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="size-4 text-muted-foreground" />
              <span>กำหนดส่ง: {new Date(job.deadline).toLocaleDateString("th-TH")}</span>
            </div>
            <div className="flex items-center gap-2">
              {job.employer_id ? (
                <UserAvatar userId={job.employer_id} size="sm" />
              ) : (
                <User className="size-4 text-green-600" />
              )}
              <span>ผู้ว่าจ้าง: <strong>{job.employer?.name ?? "-"}</strong></span>
            </div>
            <div className="flex items-center gap-2">
              {job.approved_by_staff ? (
                <UserAvatar userId={job.approved_by_staff} size="sm" />
              ) : (
                <Shield className="size-4 text-amber-600" />
              )}
              <span>ผู้กำกับ: <strong>{supervisorName ?? "(ยังไม่มี)"}</strong></span>
            </div>
            {job.work_start_date && (
              <div className="flex items-center gap-2 md:col-span-2">
                <Calendar className="size-4 text-blue-600" />
                <span>
                  วันทำงาน:{" "}
                  <strong>
                    {new Date(job.work_start_date).toLocaleDateString("th-TH")}
                    {job.work_end_date && ` — ${new Date(job.work_end_date).toLocaleDateString("th-TH")}`}
                  </strong>
                  {job.schedule_confirmed && (
                    <span className="ml-2 text-green-700 inline-flex items-center gap-1">
                      <CheckCircle className="size-3" /> ยืนยันแล้ว
                    </span>
                  )}
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Team card — show only when job needs > 1 worker */}
      {job.required_workers > 1 && (
        <Card className="border-sky-200 bg-sky-50/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <User className="size-4 text-sky-600" />
              ทีมของคุณ
            </CardTitle>
          </CardHeader>
          <CardContent>
            <TeamStrip jobId={id} requiredWorkers={job.required_workers} showLabels />
            <p className="text-xs text-muted-foreground mt-2">
              💡 ค่าจ้างแบ่งเท่าๆ กันให้ทุกคน · คนใดในทีมส่งมอบงานได้ · 👑 = หัวหน้าทีม
            </p>
          </CardContent>
        </Card>
      )}

      {/* Schedule actions (ASSIGNED only) */}
      {canProposeSchedule && (
        <Card className="border-blue-200 bg-blue-50/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="size-4 text-blue-600" />
              เสนอวันทำงาน
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {job.work_start_date && job.schedule_proposed_by === userId && !job.schedule_confirmed ? (
              // Already proposed by this student — only show waiting card, hide inputs
              <p className="text-sm text-yellow-700 bg-yellow-50 rounded p-3 border border-yellow-200">
                ⏳ คุณเสนอวัน {new Date(job.work_start_date).toLocaleDateString("th-TH")}
                {job.work_end_date && ` — ${new Date(job.work_end_date).toLocaleDateString("th-TH")}`} แล้ว — <strong>รอผู้ว่าจ้างยืนยัน</strong>
              </p>
            ) : canConfirmSchedule ? (
              // Employer proposed dates — student should confirm
              <Button onClick={handleConfirmSchedule} disabled={confirming} variant="outline" className="w-full border-green-300 text-green-700 hover:bg-green-50">
                {confirming ? <><Loader2 className="size-4 mr-1 animate-spin" />กำลังยืนยัน...</> : <><CheckCircle className="size-4 mr-1" />ยืนยันวันที่ผู้ว่าจ้างเสนอ → เริ่มงาน</>}
              </Button>
            ) : (
              // No proposal yet — student can propose
              <>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-muted-foreground">วันเริ่ม</label>
                    <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">วันสิ้นสุด</label>
                    <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                  </div>
                </div>
                <Button onClick={handleProposeSchedule} disabled={scheduling} className="w-full">
                  {scheduling ? <><Loader2 className="size-4 mr-1 animate-spin" />กำลังบันทึก...</> : <><Send className="size-4 mr-1" />เสนอวันทำงาน</>}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Initial site photos (job type) — read-only gallery */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Camera className="size-4 text-muted-foreground" />
            รูปที่ผู้ว่าจ้างแนบไว้ (ลักษณะงาน/เครื่อง)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ImageGallery jobId={id} imageType="job" showEmpty />
        </CardContent>
      </Card>

      {/* Progress photos */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Camera className="size-4 text-orange-600" />
            รูประหว่างทำงาน (ความคืบหน้า)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {canUploadImages ? (
            <>
              <Button
                onClick={() => setCameraType("progress")}
                className="w-full bg-sky-500 hover:bg-sky-600 text-white mb-3"
                size="lg"
              >
                <Camera className="size-5 mr-2" />
                📷 เปิดกล้อง — AI จะช่วยอธิบายรูปให้
              </Button>
              <ImageUpload
                jobId={id}
                imageType="progress"
                maxImages={8}
                existingImages={progressImages}
                onUploadComplete={() => load()}
                label="หรือเลือกจากคลังภาพ"
              />
            </>
          ) : (
            <ImageGallery jobId={id} imageType="progress" showEmpty />
          )}
          {canUploadImages && (
            <p className="text-xs text-muted-foreground mt-3">
              💡 อัปโหลดรูประหว่างทำงาน 3-4 รูป (ก่อน/ระหว่าง/หลัง) เพื่อบันทึกขั้นตอนการทำงาน
            </p>
          )}
        </CardContent>
      </Card>

      {/* Completion photos */}
      <Card className={cn(canSubmit && "border-green-300")}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <CheckCircle className="size-4 text-green-600" />
            รูปงานเสร็จ (ส่งมอบงาน)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {canUploadImages ? (
            <>
              <Button
                onClick={() => setCameraType("completion")}
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white mb-3"
                size="lg"
              >
                <Camera className="size-5 mr-2" />
                📷 ถ่ายรูปงานเสร็จ — AI จะตรวจสอบให้
              </Button>
              <ImageUpload
                jobId={id}
                imageType="completion"
                maxImages={6}
                existingImages={completionImages}
                onUploadComplete={() => load()}
                label="หรือเลือกจากคลังภาพ"
              />
            </>
          ) : (
            <ImageGallery jobId={id} imageType="completion" showEmpty />
          )}
          {canUploadImages && (
            <p className="text-xs text-muted-foreground mt-3">
              💡 อัปโหลดรูปงานเสร็จอย่างน้อย 1 รูป (ภาพรวม + รายละเอียดส่วนสำคัญ) เพื่อใช้เป็นหลักฐานการส่งมอบงาน
            </p>
          )}
        </CardContent>
      </Card>

      {/* Submit button (CONFIRMED or IN_PROGRESS) */}
      {canSubmit && (
        <Card className="border-green-300 bg-green-50/40">
          <CardContent className="pt-6 space-y-3">
            <div className="text-sm space-y-1">
              <p className="font-medium flex items-center gap-2">
                <Send className="size-4 text-green-600" />
                พร้อมส่งมอบงาน?
              </p>
              <p className="text-xs text-muted-foreground">
                ตรวจสอบให้ครบ: <strong>รูประหว่างทำงาน {progressImages.length} รูป</strong> · <strong>รูปงานเสร็จ {completionImages.length} รูป</strong>
              </p>
              <p className="text-xs text-muted-foreground">
                เมื่อกดส่งมอบงาน → ระบบจะแจ้งผู้ว่าจ้าง + คณะทำงานให้เข้ามาตรวจสอบและยืนยัน
              </p>
            </div>
            <Button
              onClick={handleSubmit}
              disabled={submitting || completionImages.length === 0}
              className="w-full bg-green-600 hover:bg-green-700"
              size="lg"
            >
              {submitting ? (
                <><Loader2 className="size-4 mr-2 animate-spin" />กำลังส่งมอบงาน...</>
              ) : (
                <><Send className="size-4 mr-2" />ส่งมอบงาน</>
              )}
            </Button>
            {completionImages.length === 0 && (
              <p className="text-xs text-red-600 text-center">⚠️ ต้องมีรูปงานเสร็จอย่างน้อย 1 รูป ก่อนส่งมอบงาน</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Status banner — readonly states */}
      {job.status === "ASSIGNED" && !canProposeSchedule && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="py-4 flex items-start gap-2 text-sm">
            <Hourglass className="size-4 text-blue-600 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium">รอเริ่มงาน</p>
              <p className="text-muted-foreground text-xs mt-0.5">
                คุณกับผู้ว่าจ้างต้องนัดวันทำงาน เมื่อยืนยันแล้วระบบจะเข้าสู่สถานะ "กำลังทำ"
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {job.status === "SUBMITTED" && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="py-4 flex items-start gap-2 text-sm">
            <Hourglass className="size-4 text-yellow-600 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium">ส่งงานแล้ว — รอตรวจสอบ</p>
              <p className="text-muted-foreground text-xs mt-0.5">
                <span className="inline-flex items-center gap-1">
                  {job.staff_confirmed_completion ? <CheckCircle className="size-3 text-green-600" /> : <Clock className="size-3" />}
                  คณะทำงาน
                </span>
                <span className="mx-2">·</span>
                <span className="inline-flex items-center gap-1">
                  {job.employer_confirmed_completion ? <CheckCircle className="size-3 text-green-600" /> : <Clock className="size-3" />}
                  ผู้ว่าจ้าง
                </span>
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {(job.status === "COMPLETED" || job.status === "IN_WARRANTY" || job.status === "CLOSED") && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="py-4 flex items-start gap-2 text-sm">
            <PartyPopper className="size-4 text-green-600 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium">งานเสร็จสมบูรณ์ 🎉</p>
              <p className="text-muted-foreground text-xs mt-0.5">
                ขอบคุณสำหรับการทำงาน — ตรวจสอบ Wallet เพื่อรับ TRPB / SkillCredit
              </p>
              {job.status === "IN_WARRANTY" && job.warranty_end_at && (
                <p className="text-xs text-purple-700 mt-1">
                  🛡️ อยู่ในประกัน — สิ้นสุด {new Date(job.warranty_end_at).toLocaleDateString("th-TH")}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Interim review (IN_PROGRESS) — นศ. ประเมินผู้ว่าจ้างระหว่างทำงาน */}
      {isMine && job.status === "IN_PROGRESS" && job.employer && job.employer_id && userId && (
        <StudentReviewForm
          jobId={job.id}
          studentId={userId}
          employerId={job.employer_id}
          employerName={job.employer.name}
          jobTitle={job.title}
          evalPhase="IN_PROGRESS"
          onSuccess={() => load()}
        />
      )}

      {/* Final review (COMPLETED+) — นศ. ประเมินผู้ว่าจ้างหลังงานเสร็จ */}
      {isMine && (job.status === "COMPLETED" || job.status === "IN_WARRANTY" || job.status === "CLOSED") && job.employer && job.employer_id && userId && (
        <StudentReviewForm
          jobId={job.id}
          studentId={userId}
          employerId={job.employer_id}
          employerName={job.employer.name}
          jobTitle={job.title}
          evalPhase="POST_WORK"
          onSuccess={() => load()}
        />
      )}

      {/* Read-only message for non-mine staff/admin viewing */}
      {!isMine && !isReadOnly && (
        <Card className="border-gray-200 bg-gray-50">
          <CardContent className="py-3 text-xs text-muted-foreground flex items-center gap-2">
            <AlertCircle className="size-3" />
            คุณกำลังดูงานในฐานะผู้ดูแล — ไม่สามารถอัปโหลดรูปหรือส่งงานแทนนักศึกษา
          </CardContent>
        </Card>
      )}
      {/* Camera fullscreen overlay */}
      {cameraType && (
        <CameraCapture
          open={!!cameraType}
          onClose={() => setCameraType(null)}
          jobId={id}
          imageType={cameraType}
          maxImages={cameraType === "completion" ? 6 : 8}
          jobTitle={job?.title}
          onUploaded={() => {
            setCameraType(null);
            load();
          }}
        />
      )}
    </div>
  );
}
