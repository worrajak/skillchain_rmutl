"use client";

/**
 * /admin/jobs — Admin Jobs Console (cards, context-aware)
 *
 * Replaces the flat-table version. Admin = staff++ with FULL powers:
 *   - Approve jobs (PENDING_REVIEW → OPEN)
 *   - Approve / reject student applications
 *   - Confirm completion (SUBMITTED → COMPLETED)
 *   - Release escrow (COMPLETED → on-chain TRPB transfer)
 *   - Edit status manually
 *   - Delete
 *
 * Each card also surfaces a tri-perspective "ใครค้างที่ขั้นไหน":
 *   👀 ผู้ว่าจ้าง / 👀 คณะทำงาน / 👀 นักศึกษา — so admin knows whose mailbox is blocked.
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Briefcase,
  CheckCircle2,
  XCircle,
  Loader2,
  Search,
  Wallet,
  UserCheck,
  Sparkles,
  Eye,
  Edit2,
  Trash2,
  Plus,
  ExternalLink,
  Calendar,
  ShieldCheck,
  Hourglass,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { UserAvatar } from "@/components/user-avatar";

const STATUS_INFO: Record<string, { label: string; color: string; emoji: string }> = {
  PENDING_REVIEW: { label: "รอ staff อนุมัติ", color: "bg-orange-100 text-orange-800 border-orange-200", emoji: "🟠" },
  OPEN: { label: "เปิดรับ นศ.", color: "bg-green-100 text-green-800 border-green-200", emoji: "🟢" },
  ASSIGNED: { label: "มอบหมายแล้ว", color: "bg-blue-100 text-blue-800 border-blue-200", emoji: "🔵" },
  CONFIRMED: { label: "ยืนยัน", color: "bg-indigo-100 text-indigo-800 border-indigo-200", emoji: "🔷" },
  IN_PROGRESS: { label: "กำลังทำ", color: "bg-cyan-100 text-cyan-800 border-cyan-200", emoji: "⚙️" },
  SUBMITTED: { label: "นศ. ส่งงาน", color: "bg-yellow-100 text-yellow-800 border-yellow-200", emoji: "🟡" },
  COMPLETED: { label: "เสร็จ", color: "bg-emerald-100 text-emerald-800 border-emerald-200", emoji: "✅" },
  IN_WARRANTY: { label: "อยู่ในประกัน", color: "bg-purple-100 text-purple-800 border-purple-200", emoji: "🛡️" },
  CLOSED: { label: "ปิดงาน", color: "bg-slate-100 text-slate-700 border-slate-200", emoji: "🔒" },
  CANCELLED: { label: "ยกเลิก", color: "bg-gray-100 text-gray-600 border-gray-200", emoji: "⛔" },
  DISPUTED: { label: "พิพาท", color: "bg-red-100 text-red-700 border-red-200", emoji: "⚠️" },
};

const TYPE_LABELS: Record<string, string> = {
  PAID: "งานจ้าง",
  VOLUNTEER: "จิตอาสา",
  TRAINING: "ฝึกทักษะ",
  EXEMPTED: "ยกเว้นค่าบริการ",
};

const FILTERS = [
  { key: "all", label: "ทั้งหมด", statuses: [] as string[] },
  { key: "pending", label: "🟠 รอ staff อนุมัติ", statuses: ["PENDING_REVIEW"] },
  { key: "applications", label: "👥 มี นศ. รอ approve", statuses: [] }, // computed
  { key: "open", label: "🟢 เปิดรับ", statuses: ["OPEN"] },
  { key: "in_progress", label: "⚙️ กำลังทำ", statuses: ["ASSIGNED", "CONFIRMED", "IN_PROGRESS"] },
  { key: "submitted", label: "🟡 รอตรวจ", statuses: ["SUBMITTED"] },
  { key: "pay", label: "💰 รอจ่ายเงิน", statuses: [] }, // computed
  { key: "done", label: "✅ เสร็จ", statuses: ["COMPLETED", "CLOSED"] },
];

interface Job {
  id: string;
  title: string;
  description?: string | null;
  type: string;
  job_category?: string | null;
  status: string;
  location?: string | null;
  pay_amount: number | null;
  pay_per_person?: number | null;
  required_workers?: number | null;
  engagement_mode?: string | null;
  deadline?: string | null;
  event_date?: string | null;
  created_at: string;
  updated_at?: string | null;
  employer_id: string;
  student_id: string | null;
  approved_by_staff?: string | null;
  staff_confirmed_completion?: boolean | null;
  employer_confirmed_completion?: boolean | null;
  escrow_tx?: string | null;
  warranty_status?: string | null;
  employer?: { name: string | null } | null;
  student?: { name: string | null } | null;
}

interface PendingApplication {
  id: string;
  job_id: string;
  student_id: string;
  status: string;
  created_at: string;
  // Supabase typegen reports this join as an array — unwrap with first element when reading.
  student?:
    | { name: string | null; avatar_url: string | null; faculty?: string | null }
    | { name: string | null; avatar_url: string | null; faculty?: string | null }[]
    | null;
}

function unwrap<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null;
  return Array.isArray(v) ? v[0] ?? null : v;
}

export default function AdminJobsPage() {
  const supabase = createClient();

  const [jobs, setJobs] = useState<Job[]>([]);
  const [pendingApps, setPendingApps] = useState<Record<string, PendingApplication[]>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState<string | null>(null); // jobId-action
  const [editJob, setEditJob] = useState<Job | null>(null);
  const [reviewJobOpen, setReviewJobOpen] = useState<Job | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [adjustedPay, setAdjustedPay] = useState<string>("");

  async function load() {
    setLoading(true);
    const [jobsRes, appsRes] = await Promise.all([
      supabase
        .from("skc_jobs")
        .select(
          "*, employer:skc_users!skc_jobs_employer_id_fkey(name), student:skc_users!skc_jobs_student_id_fkey(name)",
        )
        // เรียงงานที่เพิ่งโพสต์อยู่บนสุด (created_at DESC)
        .order("created_at", { ascending: false }),
      supabase
        .from("skc_job_assignment_requests")
        .select("id, job_id, student_id, status, created_at, student:skc_users!skc_job_assignment_requests_student_id_fkey(name, avatar_url, faculty)")
        .eq("status", "PENDING"),
    ]);
    setJobs((jobsRes.data as unknown as Job[]) ?? []);
    const byJob: Record<string, PendingApplication[]> = {};
    for (const a of ((appsRes.data ?? []) as unknown) as PendingApplication[]) {
      (byJob[a.job_id] ||= []).push(a);
    }
    setPendingApps(byJob);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // === Filtering ===
  const filteredJobs = useMemo(() => {
    let list = jobs;
    if (filter === "applications") {
      list = list.filter((j) => (pendingApps[j.id]?.length ?? 0) > 0);
    } else if (filter === "pay") {
      list = list.filter(
        (j) =>
          j.status === "COMPLETED" &&
          j.type === "PAID" &&
          Number(j.pay_amount ?? 0) > 0 &&
          !j.escrow_tx,
      );
    } else if (filter !== "all") {
      const target = FILTERS.find((f) => f.key === filter);
      if (target) list = list.filter((j) => target.statuses.includes(j.status));
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (j) =>
          j.title?.toLowerCase().includes(q) ||
          j.employer?.name?.toLowerCase().includes(q) ||
          j.student?.name?.toLowerCase().includes(q),
      );
    }
    return list;
  }, [jobs, filter, search, pendingApps]);

  const counts = useMemo(() => {
    const map: Record<string, number> = { all: jobs.length };
    map.applications = Object.values(pendingApps).reduce((sum, arr) => sum + arr.length, 0);
    map.pay = jobs.filter(
      (j) =>
        j.status === "COMPLETED" &&
        j.type === "PAID" &&
        Number(j.pay_amount ?? 0) > 0 &&
        !j.escrow_tx,
    ).length;
    for (const f of FILTERS) {
      if (["all", "applications", "pay"].includes(f.key)) continue;
      map[f.key] = jobs.filter((j) => f.statuses.includes(j.status)).length;
    }
    return map;
  }, [jobs, pendingApps]);

  // === Actions ===
  async function approveJob(job: Job, action: "APPROVE" | "REJECT") {
    setBusy(`${job.id}-review`);
    const body: Record<string, unknown> = { action, note: reviewNote || undefined };
    if (action === "APPROVE" && adjustedPay && !Number.isNaN(Number(adjustedPay))) {
      body.adjusted_pay = Number(adjustedPay);
    }
    const res = await fetch(`/api/jobs/${job.id}/review-job`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setBusy(null);
    if (res.ok) {
      toast.success(data.message);
      setReviewJobOpen(null);
      setReviewNote("");
      setAdjustedPay("");
      load();
    } else {
      toast.error(data.error);
    }
  }

  async function approveApplication(req: PendingApplication, jobId: string, action: "APPROVED" | "REJECTED") {
    setBusy(`${req.id}-app`);
    const res = await fetch(`/api/jobs/${jobId}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ request_id: req.id, action }),
    });
    const data = await res.json();
    setBusy(null);
    if (res.ok) {
      toast.success(action === "APPROVED" ? "อนุมัติ นศ. แล้ว" : "ปฏิเสธแล้ว");
      load();
    } else {
      toast.error(data.error);
    }
  }

  async function confirmCompletion(job: Job) {
    setBusy(`${job.id}-confirm`);
    const res = await fetch(`/api/jobs/${job.id}/confirm-completion`, { method: "POST" });
    const data = await res.json();
    setBusy(null);
    if (res.ok) {
      toast.success(data.message ?? "ยืนยันแล้ว");
      load();
    } else {
      toast.error(data.error);
    }
  }

  async function releaseEscrow(job: Job) {
    if (!confirm(`ปล่อย ${job.pay_amount?.toLocaleString()} TRPB ให้ ${job.student?.name ?? "นศ."}?`)) return;
    setBusy(`${job.id}-pay`);
    const res = await fetch(`/api/jobs/${job.id}/release-escrow`, { method: "POST" });
    const data = await res.json();
    setBusy(null);
    if (res.ok) {
      toast.success(`✅ จ่าย TRPB แล้ว (TX: ${data.tx_hash?.slice(0, 12)}...)`);
      load();
    } else {
      toast.error(data.error);
    }
  }

  async function editStatus(job: Job, newStatus: string) {
    setBusy(`${job.id}-status`);
    const { error } = await supabase.from("skc_jobs").update({ status: newStatus }).eq("id", job.id);
    setBusy(null);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(`เปลี่ยนสถานะเป็น ${STATUS_INFO[newStatus]?.label ?? newStatus}`);
      setEditJob(null);
      load();
    }
  }

  async function deleteJob(job: Job) {
    if (!confirm(`ลบงาน "${job.title}" จริงหรือไม่? (ลบถาวร)`)) return;
    const { error } = await supabase.from("skc_jobs").delete().eq("id", job.id);
    if (error) toast.error(error.message);
    else {
      toast.success("ลบแล้ว");
      load();
    }
  }

  // === Render ===
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Briefcase className="size-6 text-blue-600" />
            Console งาน
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Admin: อนุมัติงาน · อนุมัติ นศ. · ตรวจสอบ · จ่าย TRPB — ทำได้ทุกอย่าง
          </p>
        </div>
        <Link href="/admin/jobs/new">
          <Button className="gap-2">
            <Plus className="size-4" />
            สร้างงานใหม่
          </Button>
        </Link>
      </div>

      {/* Filter chips */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const active = filter === f.key;
          const count = counts[f.key] ?? 0;
          const hot = (f.key === "pending" || f.key === "applications" || f.key === "submitted" || f.key === "pay") && count > 0;
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
                active
                  ? "bg-blue-600 text-white border-blue-600"
                  : hot
                    ? "bg-amber-50 text-amber-800 border-amber-300 hover:border-amber-400"
                    : "bg-white text-foreground border-gray-200 hover:border-blue-300",
              )}
            >
              {f.label}
              {count > 0 && (
                <span className={cn("ml-1", active ? "opacity-80" : "text-muted-foreground")}>
                  ({count})
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="ค้นหา: ชื่องาน / นศ. / ผู้จ้าง..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Cards grid */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="size-8 animate-spin text-blue-500" />
        </div>
      ) : filteredJobs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Briefcase className="size-12 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-foreground font-medium">ไม่พบงาน</p>
            <p className="text-xs text-muted-foreground mt-1">ลองเปลี่ยนตัวกรอง หรือล้างคำค้นหา</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filteredJobs.map((job) => (
            <JobAdminCard
              key={job.id}
              job={job}
              pendingApps={pendingApps[job.id] ?? []}
              busy={busy}
              onReviewJob={() => {
                setReviewJobOpen(job);
                setAdjustedPay(String(job.pay_amount ?? ""));
              }}
              onApproveApp={(req, action) => approveApplication(req, job.id, action)}
              onConfirmCompletion={() => confirmCompletion(job)}
              onReleaseEscrow={() => releaseEscrow(job)}
              onEditStatus={() => setEditJob(job)}
              onDelete={() => deleteJob(job)}
            />
          ))}
        </div>
      )}

      {/* Edit status dialog */}
      <Dialog open={!!editJob} onOpenChange={(o) => !o && setEditJob(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-foreground">เปลี่ยนสถานะงาน</DialogTitle>
          </DialogHeader>
          {editJob && (
            <div className="space-y-3">
              <p className="text-sm font-medium text-foreground">{editJob.title}</p>
              <p className="text-xs text-muted-foreground">
                ปัจจุบัน: {STATUS_INFO[editJob.status]?.label ?? editJob.status}
              </p>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(STATUS_INFO).map(([s, info]) => (
                  <Button
                    key={s}
                    variant={editJob.status === s ? "default" : "outline"}
                    size="sm"
                    disabled={editJob.status === s || busy === `${editJob.id}-status`}
                    onClick={() => editStatus(editJob, s)}
                  >
                    {info.emoji} {info.label}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Review job dialog (PENDING_REVIEW) */}
      <Dialog open={!!reviewJobOpen} onOpenChange={(o) => !o && setReviewJobOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-foreground">พิจารณางาน</DialogTitle>
          </DialogHeader>
          {reviewJobOpen && (
            <div className="space-y-3">
              <p className="text-sm font-medium text-foreground">{reviewJobOpen.title}</p>
              {reviewJobOpen.description && (
                <p className="text-xs text-muted-foreground whitespace-pre-wrap line-clamp-6">
                  {reviewJobOpen.description}
                </p>
              )}
              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground">ค่าจ้าง (TRPB)</label>
                <Input
                  type="number"
                  value={adjustedPay}
                  onChange={(e) => setAdjustedPay(e.target.value)}
                  placeholder="ปรับได้ถ้าจำเป็น"
                />
              </div>
              <Textarea
                placeholder="หมายเหตุ (ไม่บังคับ)"
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
                rows={2}
              />
              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  disabled={busy === `${reviewJobOpen.id}-review`}
                  onClick={() => approveJob(reviewJobOpen, "APPROVE")}
                >
                  <CheckCircle2 className="size-4 mr-1" />
                  อนุมัติ
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 text-red-600"
                  disabled={busy === `${reviewJobOpen.id}-review`}
                  onClick={() => approveJob(reviewJobOpen, "REJECT")}
                >
                  <XCircle className="size-4 mr-1" />
                  ปฏิเสธ
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ============================================================
 *  JobAdminCard — single card per job
 * ============================================================ */

function JobAdminCard({
  job,
  pendingApps,
  busy,
  onReviewJob,
  onApproveApp,
  onConfirmCompletion,
  onReleaseEscrow,
  onEditStatus,
  onDelete,
}: {
  job: Job;
  pendingApps: PendingApplication[];
  busy: string | null;
  onReviewJob: () => void;
  onApproveApp: (req: PendingApplication, action: "APPROVED" | "REJECTED") => void;
  onConfirmCompletion: () => void;
  onReleaseEscrow: () => void;
  onEditStatus: () => void;
  onDelete: () => void;
}) {
  const status = STATUS_INFO[job.status] ?? { label: job.status, color: "bg-gray-100 text-gray-700 border-gray-200", emoji: "?" };

  // === Tri-perspective summary ===
  // Who is waiting on whom? Computed from status.
  const perspectives: { role: string; emoji: string; msg: string; tone: "wait" | "do" | "ok" }[] = [];

  switch (job.status) {
    case "PENDING_REVIEW":
      perspectives.push({ role: "ผู้ว่าจ้าง", emoji: "👔", msg: "รอ staff อนุมัติงาน", tone: "wait" });
      perspectives.push({ role: "Staff", emoji: "🛡️", msg: "ต้องอนุมัติ/ปฏิเสธ", tone: "do" });
      perspectives.push({ role: "นักศึกษา", emoji: "🎓", msg: "ยังไม่เห็นงานนี้ (รอเปิดรับ)", tone: "wait" });
      break;
    case "OPEN":
      perspectives.push({ role: "ผู้ว่าจ้าง", emoji: "👔", msg: "รอ นศ. สมัคร", tone: "wait" });
      perspectives.push({
        role: "Staff",
        emoji: "🛡️",
        msg: pendingApps.length > 0 ? `มี ${pendingApps.length} คำขอ — ต้อง approve` : "เปิดรับสมัคร — รอ นศ.",
        tone: pendingApps.length > 0 ? "do" : "wait",
      });
      perspectives.push({ role: "นักศึกษา", emoji: "🎓", msg: "สมัครรับงานได้", tone: "do" });
      break;
    case "ASSIGNED":
    case "CONFIRMED":
      perspectives.push({ role: "ผู้ว่าจ้าง", emoji: "👔", msg: "นัดเวลาเริ่มงานกับ นศ.", tone: "do" });
      perspectives.push({ role: "Staff", emoji: "🛡️", msg: "กำกับ/ติดตาม", tone: "wait" });
      perspectives.push({ role: "นักศึกษา", emoji: "🎓", msg: "เตรียมเริ่มงาน — ติดต่อผู้จ้าง", tone: "do" });
      break;
    case "IN_PROGRESS":
      perspectives.push({ role: "ผู้ว่าจ้าง", emoji: "👔", msg: "ติดตามรูประหว่างทำ", tone: "wait" });
      perspectives.push({ role: "Staff", emoji: "🛡️", msg: "กำกับ — ประเมินระหว่างทำ", tone: "do" });
      perspectives.push({ role: "นักศึกษา", emoji: "🎓", msg: "อัปโหลดรูประหว่างทำ + ส่งงาน", tone: "do" });
      break;
    case "SUBMITTED":
      perspectives.push({
        role: "ผู้ว่าจ้าง",
        emoji: "👔",
        msg: job.employer_confirmed_completion ? "ยืนยันแล้ว ✓" : "ต้องตรวจ + ยืนยันงาน",
        tone: job.employer_confirmed_completion ? "ok" : "do",
      });
      perspectives.push({
        role: "Staff",
        emoji: "🛡️",
        msg: job.staff_confirmed_completion ? "ยืนยันแล้ว ✓" : "ต้องยืนยันงานเสร็จ",
        tone: job.staff_confirmed_completion ? "ok" : "do",
      });
      perspectives.push({ role: "นักศึกษา", emoji: "🎓", msg: "รอผลตรวจ", tone: "wait" });
      break;
    case "COMPLETED":
      if (job.type === "PAID" && Number(job.pay_amount ?? 0) > 0 && !job.escrow_tx) {
        perspectives.push({ role: "ผู้ว่าจ้าง", emoji: "👔", msg: "งานเสร็จ — รอจ่าย TRPB", tone: "wait" });
        perspectives.push({ role: "Staff", emoji: "🛡️", msg: "ต้องปล่อยเงิน escrow", tone: "do" });
        perspectives.push({ role: "นักศึกษา", emoji: "🎓", msg: "รอรับ TRPB", tone: "wait" });
      } else {
        perspectives.push({ role: "ผู้ว่าจ้าง", emoji: "👔", msg: "งานเสร็จเรียบร้อย", tone: "ok" });
        perspectives.push({ role: "Staff", emoji: "🛡️", msg: "ปิดงานแล้ว", tone: "ok" });
        perspectives.push({ role: "นักศึกษา", emoji: "🎓", msg: "ได้ใบรับรอง + คะแนน", tone: "ok" });
      }
      break;
    case "CANCELLED":
    case "DISPUTED":
      perspectives.push({ role: "ทุกฝ่าย", emoji: "⚠️", msg: STATUS_INFO[job.status]?.label ?? job.status, tone: "wait" });
      break;
    default:
      perspectives.push({ role: "ทุกฝ่าย", emoji: "ℹ️", msg: status.label, tone: "wait" });
  }

  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow">
      <CardHeader className="pb-2 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base text-foreground line-clamp-2">{job.title}</CardTitle>
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              <Badge className={cn("border", status.color)}>
                {status.emoji} {status.label}
              </Badge>
              <span className="text-[10px] text-muted-foreground">
                {TYPE_LABELS[job.type] ?? job.type}
              </span>
              {Number(job.pay_amount ?? 0) > 0 && (
                <span className="text-xs text-emerald-700 font-semibold inline-flex items-center gap-0.5">
                  <Wallet className="size-3" />
                  {Number(job.pay_amount).toLocaleString()} TRPB
                </span>
              )}
              {job.escrow_tx && (
                <a
                  href={`https://nile.tronscan.org/#/transaction/${job.escrow_tx}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-0.5 text-[10px] text-blue-600 hover:underline"
                >
                  <ExternalLink className="size-2.5" /> จ่ายแล้ว
                </a>
              )}
              {job.warranty_status === "ACTIVE" && (
                <Badge variant="outline" className="text-[10px] border-purple-300 text-purple-700">
                  <ShieldCheck className="size-3 mr-0.5" /> ในประกัน
                </Badge>
              )}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 pb-3">
        {/* Trio: employer / staff / student */}
        <div className="flex items-center justify-between text-[11px] bg-muted/40 rounded-lg p-2">
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <UserAvatar userId={job.employer_id} size="xs" />
            <div className="min-w-0">
              <p className="text-[9px] text-muted-foreground">ผู้จ้าง</p>
              <p className="font-medium truncate">{job.employer?.name ?? "-"}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 min-w-0 flex-1 border-x px-2">
            {job.approved_by_staff ? (
              <UserAvatar userId={job.approved_by_staff} size="xs" />
            ) : (
              <div className="size-5 rounded-full bg-amber-100 flex items-center justify-center">
                <Hourglass className="size-3 text-amber-600" />
              </div>
            )}
            <div className="min-w-0">
              <p className="text-[9px] text-muted-foreground">ผู้กำกับ</p>
              <p className="font-medium truncate">{job.approved_by_staff ? "Staff" : "(ยังไม่มี)"}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            {job.student_id ? (
              <UserAvatar userId={job.student_id} size="xs" />
            ) : (
              <div className="size-5 rounded-full bg-slate-100 flex items-center justify-center text-[9px]">?</div>
            )}
            <div className="min-w-0">
              <p className="text-[9px] text-muted-foreground">นศ.</p>
              <p className="font-medium truncate">{job.student?.name ?? "(ยังไม่มี)"}</p>
            </div>
          </div>
        </div>

        {/* Date */}
        {(job.deadline || job.event_date) && (
          <div className="text-[11px] text-muted-foreground flex items-center gap-1">
            <Calendar className="size-3" />
            {job.event_date
              ? `วันงาน: ${new Date(job.event_date).toLocaleDateString("th-TH")}`
              : `กำหนดส่ง: ${new Date(job.deadline!).toLocaleDateString("th-TH")}`}
          </div>
        )}

        {/* Tri-perspective panel */}
        <div className="rounded-lg border bg-slate-50/50 p-2 space-y-1">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
            ใครค้างที่ขั้นไหน
          </p>
          {perspectives.map((p, i) => (
            <div key={i} className="flex items-center gap-2 text-[11px]">
              <span>{p.emoji}</span>
              <span className="font-medium text-foreground w-16 shrink-0">{p.role}</span>
              <span
                className={cn(
                  "flex-1",
                  p.tone === "do" && "text-amber-700 font-medium",
                  p.tone === "wait" && "text-muted-foreground",
                  p.tone === "ok" && "text-emerald-700",
                )}
              >
                {p.tone === "do" && "▶ "}
                {p.msg}
              </span>
            </div>
          ))}
        </div>

        {/* Pending applications (only if any) */}
        {pendingApps.length > 0 && (
          <div className="rounded-lg border-2 border-amber-300 bg-amber-50 p-2 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-medium text-amber-800">
              <UserCheck className="size-3.5" />
              คำขอรับงาน ({pendingApps.length} คน)
            </div>
            {pendingApps.map((req) => {
              const stu = unwrap(req.student);
              return (
              <div key={req.id} className="flex items-center gap-2 bg-white rounded p-1.5">
                <UserAvatar userId={req.student_id} size="xs" />
                <div className="flex-1 min-w-0 text-[11px]">
                  <p className="font-medium text-foreground truncate">{stu?.name ?? "-"}</p>
                  {stu?.faculty && (
                    <p className="text-[9px] text-muted-foreground truncate">{stu.faculty}</p>
                  )}
                </div>
                <Button
                  size="sm"
                  className="h-6 px-2 text-[10px] gap-0.5"
                  disabled={busy === `${req.id}-app`}
                  onClick={() => onApproveApp(req, "APPROVED")}
                >
                  <CheckCircle2 className="size-3" /> Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 px-2 text-[10px] text-red-600"
                  disabled={busy === `${req.id}-app`}
                  onClick={() => onApproveApp(req, "REJECTED")}
                >
                  <XCircle className="size-3" />
                </Button>
              </div>
              );
            })}
          </div>
        )}

        {/* Admin actions bar */}
        <div className="flex flex-wrap gap-1.5 pt-1 border-t">
          {/* Status-specific big action */}
          {job.status === "PENDING_REVIEW" && (
            <Button size="sm" className="gap-1" disabled={busy === `${job.id}-review`} onClick={onReviewJob}>
              <ShieldCheck className="size-3.5" />
              พิจารณา
            </Button>
          )}
          {job.status === "SUBMITTED" && !job.staff_confirmed_completion && (
            <Button
              size="sm"
              className="gap-1"
              disabled={busy === `${job.id}-confirm`}
              onClick={onConfirmCompletion}
            >
              {busy === `${job.id}-confirm` ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="size-3.5" />
              )}
              ยืนยันงานเสร็จ
            </Button>
          )}
          {job.status === "COMPLETED" &&
            job.type === "PAID" &&
            Number(job.pay_amount ?? 0) > 0 &&
            !job.escrow_tx && (
              <Button
                size="sm"
                className="bg-amber-600 hover:bg-amber-700 gap-1"
                disabled={busy === `${job.id}-pay`}
                onClick={onReleaseEscrow}
              >
                {busy === `${job.id}-pay` ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Sparkles className="size-3.5" />
                )}
                💰 จ่าย TRPB
              </Button>
            )}

          {/* Generic actions */}
          <Link href={`/jobs/${job.id}`}>
            <Button size="sm" variant="outline" className="gap-1">
              <Eye className="size-3.5" />
              ดู
            </Button>
          </Link>
          <Button size="sm" variant="ghost" className="gap-1" onClick={onEditStatus}>
            <Edit2 className="size-3.5" />
            สถานะ
          </Button>
          <Button size="sm" variant="ghost" className="text-red-600 gap-1 ml-auto" onClick={onDelete}>
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
