"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  Briefcase,
  CheckCircle,
  Clock,
  Star,
  Award,
  Shield,
  GraduationCap,
  Crown,
  UserCheck,
  AlertTriangle,
  ArrowRight,
  Calendar,
  Send,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { StaffSupervisorBadge } from "@/components/staff-supervisor-badge";
import { StudentReviewForm } from "@/components/reviews/student-review-form";
import { ImageUpload } from "@/components/image-upload";
import { ImageGallery } from "@/components/image-gallery";

const CREDENTIAL_CONFIG: Record<string, { num: number; name: string; color: string; gradient: string; icon: typeof Award }> = {
  LEVEL_1: { num: 1, name: "ลงทะเบียน", color: "text-gray-600", gradient: "from-gray-400 to-gray-500", icon: UserCheck },
  LEVEL_2: { num: 2, name: "ผ่านฝึกอบรม", color: "text-amber-700", gradient: "from-amber-500 to-orange-600", icon: Shield },
  LEVEL_3: { num: 3, name: "อาจารย์รับรอง", color: "text-blue-700", gradient: "from-blue-500 to-indigo-600", icon: GraduationCap },
  LEVEL_4: { num: 4, name: "สถาบันชาติรับรอง", color: "text-yellow-700", gradient: "from-yellow-400 to-amber-500", icon: Award },
  LEVEL_5: { num: 5, name: "ช่างชำนาญการ", color: "text-purple-700", gradient: "from-purple-500 to-fuchsia-600", icon: Crown },
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  PENDING_REVIEW: { label: "รอพิจารณา", color: "bg-orange-100 text-orange-800" },
  OPEN: { label: "เปิดรับ", color: "bg-green-100 text-green-800" },
  ASSIGNED: { label: "มอบหมาย", color: "bg-blue-100 text-blue-800" },
  IN_PROGRESS: { label: "กำลังทำ", color: "bg-cyan-100 text-cyan-800" },
  SUBMITTED: { label: "ส่งงาน", color: "bg-yellow-100 text-yellow-800" },
  COMPLETED: { label: "เสร็จ", color: "bg-green-100 text-green-800" },
  CANCELLED: { label: "ยกเลิก", color: "bg-gray-100 text-gray-800" },
  DISPUTED: { label: "พิพาท", color: "bg-red-100 text-red-800" },
};

export default function StudentDashboardPage() {
  const [user, setUser] = useState<Record<string, unknown> | null>(null);
  const [credential, setCredential] = useState<string>("LEVEL_1");
  const [myJobs, setMyJobs] = useState<Record<string, unknown>[]>([]);
  const [stats, setStats] = useState({ total: 0, completed: 0, inProgress: 0, avgScore: 0, reviewCount: 0 });
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  const supabase = createClient();

  async function loadData() {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return;
    const { data: jobs } = await supabase
      .from("jobs")
      .select("id, title, status, type, pay_amount, deadline, created_at, employer_id, work_start_date, work_end_date, schedule_proposed_by, schedule_confirmed, approved_by_staff, staff_confirmed_completion, employer_confirmed_completion")
      .eq("student_id", authUser.id)
      .order("created_at", { ascending: false })
      .limit(5);
    const jobList = jobs ?? [];
    // Fetch staff names separately
    const staffIds = [...new Set(jobList.filter((j) => j.approved_by_staff).map((j) => j.approved_by_staff as string))];
    if (staffIds.length > 0) {
      const { data: staffUsers } = await supabase.from("users").select("id, name").in("id", staffIds);
      const staffMap = new Map((staffUsers ?? []).map((s) => [s.id, s.name]));
      for (const j of jobList) {
        (j as Record<string, unknown>).staff_supervisor = j.approved_by_staff ? { name: staffMap.get(j.approved_by_staff as string) ?? null } : null;
      }
    }
    setMyJobs(jobList);
  }

  useEffect(() => {
    async function load() {
      // Get current user
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) { setLoading(false); return; }
      setUserId(authUser.id);

      // Get user profile
      const { data: profile } = await supabase
        .from("users")
        .select("*")
        .eq("id", authUser.id)
        .single();
      setUser(profile);

      // Get credential
      const { data: cred } = await supabase
        .from("student_credentials")
        .select("credential_level")
        .eq("student_id", authUser.id)
        .eq("is_active", true)
        .order("credential_level", { ascending: false })
        .limit(1)
        .single();
      if (cred) setCredential(cred.credential_level);

      // Get my jobs (with schedule fields)
      const { data: jobs } = await supabase
        .from("jobs")
        .select("id, title, status, type, pay_amount, deadline, created_at, employer_id, work_start_date, work_end_date, schedule_proposed_by, schedule_confirmed, approved_by_staff, staff_confirmed_completion, employer_confirmed_completion")
        .eq("student_id", authUser.id)
        .order("created_at", { ascending: false })
        .limit(5);
      const jobList = jobs ?? [];
      const sIds = [...new Set(jobList.filter((j) => j.approved_by_staff).map((j) => j.approved_by_staff as string))];
      if (sIds.length > 0) {
        const { data: su } = await supabase.from("users").select("id, name").in("id", sIds);
        const sm = new Map((su ?? []).map((s) => [s.id, s.name]));
        for (const j of jobList) (j as Record<string, unknown>).staff_supervisor = j.approved_by_staff ? { name: sm.get(j.approved_by_staff as string) ?? null } : null;
      }
      setMyJobs(jobList);

      // Get stats
      const [
        { count: total },
        { count: completed },
        { count: inProgress },
        { data: ratings },
      ] = await Promise.all([
        supabase.from("jobs").select("*", { count: "exact", head: true }).eq("student_id", authUser.id),
        supabase.from("jobs").select("*", { count: "exact", head: true }).eq("student_id", authUser.id).eq("status", "COMPLETED"),
        supabase.from("jobs").select("*", { count: "exact", head: true }).eq("student_id", authUser.id).eq("status", "IN_PROGRESS"),
        supabase.from("student_rating_summary").select("combined_score, teacher_review_count, employer_review_count, mentor_review_count").eq("student_id", authUser.id).single(),
      ]);

      const reviewCount = (ratings?.teacher_review_count ?? 0) + (ratings?.employer_review_count ?? 0) + (ratings?.mentor_review_count ?? 0);

      setStats({
        total: total ?? 0,
        completed: completed ?? 0,
        inProgress: inProgress ?? 0,
        avgScore: Number(ratings?.combined_score ?? 0),
        reviewCount,
      });

      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin size-8 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) {
    return (
      <Card className="max-w-md mx-auto mt-10 text-center">
        <CardContent className="py-10 space-y-4">
          <AlertTriangle className="size-12 mx-auto text-yellow-500" />
          <p className="font-medium text-foreground">กรุณาเข้าสู่ระบบ</p>
          <Link href="/login"><Button>เข้าสู่ระบบ</Button></Link>
        </CardContent>
      </Card>
    );
  }

  const credConfig = CREDENTIAL_CONFIG[credential] ?? CREDENTIAL_CONFIG.LEVEL_1;
  const CredIcon = credConfig.icon;

  const statCards = [
    { label: "งานทั้งหมด", value: stats.total, icon: Briefcase, color: "text-blue-600", bg: "bg-blue-100" },
    { label: "กำลังทำ", value: stats.inProgress, icon: Clock, color: "text-cyan-600", bg: "bg-cyan-100" },
    { label: "สำเร็จ", value: stats.completed, icon: CheckCircle, color: "text-green-600", bg: "bg-green-100" },
    { label: "คะแนนเฉลี่ย", value: stats.avgScore > 0 ? stats.avgScore.toFixed(1) : "-", icon: Star, color: "text-yellow-600", bg: "bg-yellow-100" },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome + Credential */}
      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardContent className="flex items-center gap-4 pt-4 pb-4">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-blue-100 text-blue-700 font-bold text-xl">
              {(user.name as string)?.charAt(0) ?? "?"}
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-foreground">สวัสดี, {user.name as string}</h2>
              <p className="text-sm text-muted-foreground">{user.email as string} — {user.campus as string}</p>
            </div>
          </CardContent>
        </Card>

        {/* Credential Card */}
        <Card className={cn("overflow-hidden text-white bg-gradient-to-br", credConfig.gradient)}>
          <CardContent className="flex items-center gap-3 pt-4 pb-4 relative">
            <div className="absolute inset-0 opacity-10">
              <div className="absolute -right-4 -top-4 size-20 rounded-full border-2 border-white" />
            </div>
            <CredIcon className="size-10 relative" />
            <div className="relative">
              <div className="font-bold text-lg">Level {credConfig.num}</div>
              <div className="text-sm opacity-90">{credConfig.name}</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map((s) => (
          <Card key={s.label}>
            <CardContent className="flex items-center gap-3 pt-4 pb-4">
              <div className={cn("flex size-10 items-center justify-center rounded-xl", s.bg)}>
                <s.icon className={cn("size-5", s.color)} />
              </div>
              <div>
                <div className="text-2xl font-bold text-foreground">{s.value}</div>
                <div className="text-xs text-muted-foreground">{s.label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Credential Progress */}
      <Card>
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
            <Award className="size-5" />
            เส้นทาง Credential
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-3">
            {Object.entries(CREDENTIAL_CONFIG).map(([level, c]) => {
              const Icon = c.icon;
              const isActive = c.num <= credConfig.num;
              const isCurrent = c.num === credConfig.num;
              return (
                <div key={level} className="flex flex-col items-center gap-1">
                  <div className={cn(
                    "flex size-10 items-center justify-center rounded-full transition-all",
                    isCurrent ? cn("bg-gradient-to-br text-white shadow-lg", c.gradient) :
                    isActive ? "bg-blue-100 text-blue-700" : "bg-muted text-muted-foreground"
                  )}>
                    <Icon className="size-5" />
                  </div>
                  <span className={cn("text-[10px] font-medium", isCurrent ? c.color : "text-muted-foreground")}>
                    Lv.{c.num}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
            <div
              className={cn("h-full rounded-full bg-gradient-to-r transition-all", credConfig.gradient)}
              style={{ width: `${(credConfig.num / 5) * 100}%` }}
            />
          </div>
          {credConfig.num < 5 && (
            <p className="text-xs text-muted-foreground mt-2">
              ถัดไป: Level {credConfig.num + 1} — {CREDENTIAL_CONFIG[`LEVEL_${credConfig.num + 1}`]?.name}
            </p>
          )}
        </CardContent>
      </Card>

      {/* My Jobs */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-foreground flex items-center gap-2">
              <Briefcase className="size-5" />
              งานของฉัน
            </CardTitle>
            <Link href="/student/jobs">
              <Button variant="outline" size="sm">ดูทั้งหมด <ArrowRight className="size-4 ml-1" /></Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {myJobs.length > 0 ? (
            <div className="space-y-3">
              {myJobs.map((job) => {
                const staffSup = job.staff_supervisor as { name: string } | null;
                return (
                  <div key={job.id as string} className="rounded-lg border p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-sm text-foreground">{job.title as string}</div>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium", STATUS_LABELS[job.status as string]?.color ?? "bg-gray-100")}>
                            {STATUS_LABELS[job.status as string]?.label ?? job.status}
                          </span>
                          <StaffSupervisorBadge name={staffSup?.name} />
                          {(job.pay_amount as number) > 0 && (
                            <span className="text-xs text-green-700 font-medium">{(job.pay_amount as number).toLocaleString()} TRPB</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Work dates */}
                    {String(job.work_start_date ?? "") !== "" && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Calendar className="size-3" />
                        <span>{new Date(String(job.work_start_date)).toLocaleDateString("th-TH")} — {new Date(String(job.work_end_date)).toLocaleDateString("th-TH")}</span>
                      </div>
                    )}

                    {/* Action: ASSIGNED — เสนอ/รอวันทำงาน */}
                    {job.status === "ASSIGNED" && (
                      <JobScheduleAction jobId={job.id as string} job={job} userId={userId} onUpdate={loadData} />
                    )}

                    {/* Action: IN_PROGRESS — อัปโหลดรูป + ส่งงาน */}
                    {job.status === "IN_PROGRESS" && (
                      <div className="space-y-2">
                        <ImageGallery jobId={job.id as string} imageType="job" label="รูปจากผู้ว่าจ้าง" />
                        <ImageUpload jobId={job.id as string} imageType="progress" maxImages={4} label="รูประหว่างทำงาน" />
                        <JobSubmitAction jobId={job.id as string} onUpdate={loadData} />
                      </div>
                    )}

                    {/* Action: SUBMITTED — รอยืนยัน */}
                    {job.status === "SUBMITTED" && (
                      <div className="flex items-center gap-3 text-xs rounded-lg bg-yellow-50 p-2">
                        <span className="text-yellow-800 font-medium">รอยืนยัน:</span>
                        <span className="flex items-center gap-1">
                          {job.staff_confirmed_completion ? <CheckCircle className="size-3 text-green-600" /> : <XCircle className="size-3 text-gray-300" />}
                          Staff
                        </span>
                        <span className="flex items-center gap-1">
                          {job.employer_confirmed_completion ? <CheckCircle className="size-3 text-green-600" /> : <XCircle className="size-3 text-gray-300" />}
                          ผู้ว่าจ้าง
                        </span>
                      </div>
                    )}

                    {/* COMPLETED */}
                    {job.status === "COMPLETED" && userId && (
                      <>
                        <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 rounded-lg p-2">
                          <CheckCircle className="size-3" />เสร็จสมบูรณ์ — ให้คะแนนผู้ว่าจ้าง
                        </div>
                        <StudentReviewForm
                          jobId={job.id as string}
                          studentId={userId}
                          employerId={job.employer_id as string}
                          employerName={(job.employer as { name?: string } | null)?.name ?? "ผู้ว่าจ้าง"}
                          jobTitle={job.title as string}
                        />
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8">
              <Briefcase className="size-10 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">ยังไม่มีงาน</p>
              <Link href="/student/jobs">
                <Button variant="outline" size="sm" className="mt-3">ค้นหางาน</Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Sub-component: Propose/Confirm work schedule
function JobScheduleAction({ jobId, job, userId, onUpdate }: { jobId: string; job: Record<string, unknown>; userId: string | null; onUpdate: () => void }) {
  const [startDate, setStartDate] = useState(job.work_start_date as string ?? "");
  const [endDate, setEndDate] = useState(job.work_end_date as string ?? "");
  const [submitting, setSubmitting] = useState(false);
  const isProposedByMe = job.schedule_proposed_by === userId;
  const isProposedByOther = job.schedule_proposed_by && !isProposedByMe;

  async function propose() {
    if (!startDate || !endDate) { toast.error("เลือกวันเริ่มและวันจบ"); return; }
    setSubmitting(true);
    const res = await fetch(`/api/jobs/${jobId}/schedule`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ start_date: startDate, end_date: endDate }) });
    const data = await res.json();
    setSubmitting(false);
    if (res.ok) { toast.success(data.message); onUpdate(); } else toast.error(data.error);
  }
  async function confirm() {
    setSubmitting(true);
    const res = await fetch(`/api/jobs/${jobId}/schedule`, { method: "PATCH" });
    const data = await res.json();
    setSubmitting(false);
    if (res.ok) { toast.success(data.message); onUpdate(); } else toast.error(data.error);
  }

  if (isProposedByOther && job.work_start_date) {
    return (
      <div className="rounded-lg bg-blue-50 p-2 space-y-2">
        <p className="text-xs text-blue-800">ผู้ว่าจ้างเสนอวัน: <strong>{new Date(job.work_start_date as string).toLocaleDateString("th-TH")} — {new Date(job.work_end_date as string).toLocaleDateString("th-TH")}</strong></p>
        <Button size="sm" onClick={confirm} disabled={submitting} className="w-full">
          <CheckCircle className="size-3 mr-1" />{submitting ? "กำลังยืนยัน..." : "ยืนยันวันทำงาน"}
        </Button>
      </div>
    );
  }
  if (isProposedByMe) {
    return <p className="text-xs text-yellow-700 bg-yellow-50 rounded-lg p-2">คุณเสนอวันทำงานแล้ว — รอผู้ว่าจ้างยืนยัน</p>;
  }
  return (
    <div className="rounded-lg bg-muted/50 p-2 space-y-2">
      <p className="text-xs text-muted-foreground">กำหนดวันทำงาน:</p>
      <div className="flex gap-2">
        <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="text-xs h-8" />
        <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="text-xs h-8" />
      </div>
      <Button size="sm" onClick={propose} disabled={submitting} className="w-full">
        <Send className="size-3 mr-1" />{submitting ? "กำลังส่ง..." : "เสนอวันทำงาน"}
      </Button>
    </div>
  );
}

// Sub-component: Submit work (with completion image upload)
function JobSubmitAction({ jobId, onUpdate }: { jobId: string; onUpdate: () => void }) {
  const [submitting, setSubmitting] = useState(false);
  const [showUpload, setShowUpload] = useState(false);

  async function handleSubmit() {
    setSubmitting(true);
    const res = await fetch(`/api/jobs/${jobId}/submit`, { method: "POST" });
    const data = await res.json();
    setSubmitting(false);
    if (res.ok) { toast.success(data.message); onUpdate(); } else toast.error(data.error);
  }

  if (!showUpload) {
    return (
      <Button size="sm" variant="outline" onClick={() => setShowUpload(true)} className="w-full border-cyan-300 text-cyan-700 hover:bg-cyan-50">
        <Send className="size-3 mr-1" />เตรียมส่งงาน
      </Button>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border border-cyan-200 bg-cyan-50/50 p-3">
      <p className="text-xs font-medium text-cyan-800">ถ่ายรูปงานเสร็จ (2-4 รูป) แล้วกดส่ง</p>
      <ImageUpload jobId={jobId} imageType="completion" maxImages={4} label="รูปงานเสร็จ" />
      <Button size="sm" onClick={handleSubmit} disabled={submitting} className="w-full bg-cyan-600 hover:bg-cyan-700">
        <Send className="size-3 mr-1" />{submitting ? "กำลังส่ง..." : "ส่งงาน"}
      </Button>
    </div>
  );
}
