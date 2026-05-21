"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  Search, MapPin, Clock, Wallet, Briefcase, CheckCircle, User, Shield, Eye, Flame, Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { ImageGallery } from "@/components/image-gallery";
import { JobCardCover, DeadlineUrgency } from "@/components/job-card-cover";
import { UserAvatar } from "@/components/user-avatar";
import { TeamStrip } from "@/components/team-strip";
import { getCampusLabel } from "@/types/database";
import { partitionByRank } from "@/lib/job-rank";

const TYPE_LABELS: Record<string, string> = { PAID: "งานจ้าง", VOLUNTEER: "จิตอาสา", TRAINING: "ฝึกทักษะ", EXEMPTED: "ยกเว้นค่าบริการ" };
const CATEGORY_LABELS: Record<string, string> = { electrical: "ไฟฟ้า", hvac: "แอร์/เครื่องเย็น", automotive: "ยานยนต์", general: "ทั่วไป" };
const BADGE_COLORS: Record<string, string> = { PAID: "bg-green-100 text-green-800", VOLUNTEER: "bg-blue-100 text-blue-800", TRAINING: "bg-yellow-100 text-yellow-800", EXEMPTED: "bg-purple-100 text-purple-800" };
const CATEGORY_COLORS: Record<string, string> = { electrical: "bg-amber-100 text-amber-800", hvac: "bg-cyan-100 text-cyan-800", automotive: "bg-red-100 text-red-800", general: "bg-gray-100 text-gray-800" };

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  OPEN: { label: "เปิดรับ", color: "bg-green-100 text-green-800" },
  ASSIGNED: { label: "ได้รับมอบหมาย", color: "bg-blue-100 text-blue-800" },
  CONFIRMED: { label: "ยืนยันวันแล้ว", color: "bg-cyan-100 text-cyan-800" },
  IN_PROGRESS: { label: "กำลังทำ", color: "bg-cyan-100 text-cyan-800" },
  SUBMITTED: { label: "ส่งงานแล้ว", color: "bg-yellow-100 text-yellow-800" },
  COMPLETED: { label: "เสร็จสิ้น", color: "bg-green-100 text-green-800" },
  IN_WARRANTY: { label: "อยู่ในประกัน", color: "bg-purple-100 text-purple-800" },
  CLOSED: { label: "ปิดงาน", color: "bg-gray-100 text-gray-800" },
};

export default function StudentJobsPage() {
  const [openJobs, setOpenJobs] = useState<any[]>([]);
  const [myJobs, setMyJobs] = useState<any[]>([]);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [userId, setUserId] = useState<string | null>(null);
  const [view, setView] = useState<"mine" | "open">("mine");

  const supabase = createClient();

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setUserId(user.id);
    }
    init();
  }, []);

  useEffect(() => {
    if (!userId) return;

    async function load() {
      setLoading(true);

      if (view === "mine") {
        // งานของฉัน — ทุก status ที่ student_id = userId
        const { data: jobsData } = await supabase
          .from("skc_jobs")
          .select("*, employer:skc_users!skc_jobs_employer_id_fkey(name, email)")
          .eq("student_id", userId)
          .order("updated_at", { ascending: false });

        const list = jobsData ?? [];
        const supIds = [...new Set(list.map((j: any) => j.approved_by_staff).filter(Boolean))];
        let supMap: Record<string, string> = {};
        if (supIds.length > 0) {
          const { data: sups } = await supabase.from("skc_users").select("id, name").in("id", supIds);
          supMap = Object.fromEntries((sups ?? []).map((s: any) => [s.id, s.name]));
        }
        setMyJobs(list.map((j: any) => ({ ...j, supervisor_name: j.approved_by_staff ? supMap[j.approved_by_staff] : null })));

        // Pending assignment requests (rooms that I applied + waiting)
        const { data: reqs } = await supabase
          .from("skc_job_assignment_requests")
          .select("id, status, created_at, job:skc_jobs(id, title, status, location, pay_amount, employer_id)")
          .eq("student_id", userId)
          .in("status", ["PENDING"])
          .order("created_at", { ascending: false });
        setPendingRequests(reqs ?? []);
      } else {
        // งานเปิดรับ
        let query = supabase
          .from("skc_jobs")
          .select("*, employer:skc_users!skc_jobs_employer_id_fkey(name)")
          .eq("status", "OPEN")
          .order("created_at", { ascending: false });

        if (filterType !== "all") query = query.eq("type", filterType);
        if (search) query = query.ilike("title", `%${search}%`);

        const { data } = await query;
        setOpenJobs(data ?? []);

        // Also load pending requests so the apply button knows which jobs already requested
        const { data: reqs } = await supabase
          .from("skc_job_assignment_requests")
          .select("id, job_id, status")
          .eq("student_id", userId)
          .in("status", ["PENDING"]);
        setPendingRequests(reqs ?? []);
      }
      setLoading(false);
    }
    load();
  }, [userId, view, filterType, search]);

  async function handleApply(jobId: string) {
    if (!userId) { toast.error("กรุณาเข้าสู่ระบบ"); return; }

    const res = await fetch(`/api/jobs/${jobId}/apply`, { method: "POST" });
    const data = await res.json();

    if (!res.ok) {
      toast.error(data.error || "สมัครไม่สำเร็จ");
      return;
    }

    if (data.mode === "ACTIVITY_FCFS") {
      toast.success(`✅ ลงทะเบียนกิจกรรมสำเร็จ — ${data.registered}/${data.capacity} คน${data.full ? " (เต็มแล้ว)" : ""}`);
    } else {
      toast.success("ส่งคำขอรับงานแล้ว — รอคณะทำงานอนุมัติ");
    }
    // Optimistic UI: flip the button locally
    setPendingRequests((prev) => [...prev, { id: `tmp-${jobId}`, job_id: jobId, status: "PENDING" }]);
  }

  // Set of job IDs the student already requested (and is still pending)
  const pendingJobIds = new Set(pendingRequests.map((r: any) => r.job_id || r.job?.id).filter(Boolean));

  return (
    <div className="space-y-4">
      {/* Tab toggle */}
      <div className="flex gap-2 border-b">
        <button
          onClick={() => setView("mine")}
          className={cn(
            "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
            view === "mine"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          📌 งานของฉัน {myJobs.length > 0 && `(${myJobs.length})`}
        </button>
        <button
          onClick={() => setView("open")}
          className={cn(
            "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
            view === "open"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          🔍 หางานทำ
        </button>
      </div>

      {/* Filters — only on "open" tab */}
      {view === "open" && (
        <Card>
          <CardContent className="flex flex-wrap gap-3 pt-4 pb-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input placeholder="ค้นหางาน..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Select value={filterType} onValueChange={(v) => v && setFilterType(v)}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="ทุกประเภท" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทุกประเภท</SelectItem>
                {Object.entries(TYPE_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin size-8 border-4 border-blue-500 border-t-transparent rounded-full" />
        </div>
      ) : view === "mine" ? (
        // === งานของฉัน ===
        <div className="space-y-4">
          {/* Pending requests */}
          {pendingRequests.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="size-4 text-yellow-600" />
                  คำขอรับงานที่รออนุมัติ ({pendingRequests.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {pendingRequests.map((r) => (
                  <div key={r.id} className="border rounded p-3 bg-yellow-50/50">
                    <div className="font-medium">{r.job?.title}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      📍 {r.job?.location} {r.job?.pay_amount > 0 && `· 💰 ${r.job.pay_amount.toLocaleString()} TRPB`}
                    </div>
                    <Badge variant="outline" className="mt-1 text-xs">รอ staff อนุมัติ</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* My jobs */}
          {myJobs.length === 0 ? (
            <Card className="text-center py-12">
              <CardContent>
                <Briefcase className="size-12 mx-auto text-muted-foreground/40 mb-4" />
                <p className="text-lg font-medium text-foreground">ยังไม่มีงาน</p>
                <p className="text-sm text-muted-foreground mt-1">ไปแถบ "หางานทำ" เพื่อเริ่มต้น</p>
                <Button className="mt-4" onClick={() => setView("open")}>🔍 หางานทำ</Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3">
              {myJobs.map((job: any) => {
                const status = STATUS_LABELS[job.status] ?? { label: job.status, color: "bg-gray-100" };
                return (
                  <Link key={job.id} href={`/student/jobs/${job.id}`}>
                    <Card className="hover:ring-2 hover:ring-blue-200 transition-all cursor-pointer">
                      <CardContent className="pt-4 pb-3">
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium flex items-center gap-2 flex-wrap">
                              {job.title}
                              <Eye className="size-3 text-muted-foreground" />
                            </div>
                            <div className="flex flex-wrap gap-1.5 mt-1">
                              <Badge className={cn("text-[10px]", status.color)}>{status.label}</Badge>
                              <Badge className={cn("text-[10px]", BADGE_COLORS[job.type] ?? "")}>{TYPE_LABELS[job.type] ?? job.type}</Badge>
                              <Badge className={cn("text-[10px]", CATEGORY_COLORS[job.job_category] ?? "")}>{CATEGORY_LABELS[job.job_category] ?? job.job_category}</Badge>
                            </div>
                          </div>
                          {job.pay_amount > 0 && (
                            <div className="text-right shrink-0">
                              <div className="text-lg font-bold text-green-700">{job.pay_amount.toLocaleString()}</div>
                              <div className="text-[10px] text-muted-foreground">TRPB</div>
                            </div>
                          )}
                        </div>

                        {/* Actor trio: employer · supervisor (student is current user, implicit) */}
                        <div className="flex items-center gap-3 mt-2 pt-2 border-t text-xs text-muted-foreground">
                          {job.employer_id && (
                            <span className="inline-flex items-center gap-1.5">
                              <UserAvatar userId={job.employer_id} size="xs" />
                              <span className="truncate max-w-[100px]">{job.employer?.name ?? "ผู้จ้าง"}</span>
                            </span>
                          )}
                          {job.approved_by_staff && (
                            <span className="inline-flex items-center gap-1.5">
                              <UserAvatar userId={job.approved_by_staff} size="xs" />
                              <span className="truncate max-w-[100px]">{job.supervisor_name ?? "ผู้กำกับ"}</span>
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mt-2">
                          <span className="flex items-center gap-1">
                            <MapPin className="size-3" />
                            {job.location}
                          </span>
                          {job.work_start_date && (
                            <span className="flex items-center gap-1">
                              <Clock className="size-3" />
                              {new Date(job.work_start_date).toLocaleDateString("th-TH")}
                              {job.work_end_date && ` - ${new Date(job.work_end_date).toLocaleDateString("th-TH")}`}
                            </span>
                          )}
                        </div>

                        {/* Quick action hints */}
                        {job.status === "ASSIGNED" && (
                          <div className="mt-2 text-xs text-blue-700 bg-blue-50 rounded p-2">
                            ✅ <strong>ได้รับมอบหมายแล้ว</strong> — รอวันเริ่มงาน หรือสแกน QR ที่หน้างาน
                          </div>
                        )}
                        {job.status === "CONFIRMED" && (
                          <div className="mt-2 text-xs text-cyan-700 bg-cyan-50 rounded p-2">
                            📅 <strong>ยืนยันวันแล้ว</strong> — เริ่มงาน {job.work_start_date ? new Date(job.work_start_date).toLocaleDateString("th-TH") : "TBD"}
                          </div>
                        )}
                        {job.status === "IN_PROGRESS" && (
                          <div className="mt-2 text-xs text-orange-700 bg-orange-50 rounded p-2">
                            🚧 <strong>กำลังทำงาน</strong> — อย่าลืมอัปโหลดรูประหว่างทำ
                          </div>
                        )}
                        {job.status === "SUBMITTED" && (
                          <div className="mt-2 text-xs text-yellow-700 bg-yellow-50 rounded p-2">
                            ⏳ <strong>ส่งงานแล้ว</strong> — รอผู้จ้าง + staff ยืนยัน
                          </div>
                        )}
                        {job.status === "COMPLETED" && (
                          <div className="mt-2 text-xs text-green-700 bg-green-50 rounded p-2">
                            🎉 <strong>งานเสร็จสมบูรณ์!</strong> — รอประเมินและจ่ายค่าจ้าง
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        // === งานเปิดรับ — Hero (Top 10) + List below ===
        openJobs.length > 0 ? (
          <OpenJobsLayout
            jobs={openJobs}
            pendingJobIds={pendingJobIds}
            onApply={handleApply}
          />
        ) : (
          <Card className="text-center py-12">
            <CardContent>
              <Briefcase className="size-12 mx-auto text-muted-foreground/40 mb-4" />
              <p className="text-lg font-medium text-foreground">ไม่พบงานที่เปิดรับ</p>
              <p className="text-sm text-muted-foreground mt-1">ลองเปลี่ยนตัวกรองหรือค้นหาใหม่</p>
            </CardContent>
          </Card>
        )
      )}
    </div>
  );
}

/* ============================================================
 *  OpenJobsLayout — Hero (Top 10) + List below
 * ============================================================
 *  - Mobile (<sm):   Hero = horizontal snap-scroll carousel (each card 80% viewport)
 *                    List = 1 col compact rows
 *  - Tablet (sm-lg): Hero = 2-3 col grid · List = 2 col
 *  - Desktop (lg+):  Hero = 5 col × 2 rows = 10 featured · List = 3 col compact
 */
function OpenJobsLayout({
  jobs,
  pendingJobIds,
  onApply,
}: {
  jobs: any[];
  pendingJobIds: Set<string>;
  onApply: (jobId: string) => void;
}) {
  const { featured, more } = partitionByRank(jobs, 10);

  return (
    <div className="space-y-6">
      {/* === Hero: Featured Top 10 === */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Flame className="size-5 text-amber-500" />
          <h2 className="text-base sm:text-lg font-bold text-foreground">งานเด่น (Top {featured.length})</h2>
          <span className="text-[10px] sm:text-xs text-muted-foreground">ค่าจ้างสูง + ใกล้กำหนด</span>
        </div>

        {/* Mobile: horizontal snap-scroll · Desktop: grid 5×2 */}
        <div
          className="
            flex sm:grid gap-3
            overflow-x-auto sm:overflow-visible
            snap-x snap-mandatory sm:snap-none
            sm:grid-cols-3 lg:grid-cols-5
            -mx-4 px-4 sm:mx-0 sm:px-0
            pb-2 sm:pb-0
          "
        >
          {featured.map((job: any) => (
            <HeroJobCard
              key={job.id}
              job={job}
              pending={pendingJobIds.has(job.id)}
              onApply={onApply}
            />
          ))}
        </div>
      </section>

      {/* === More: compact list === */}
      {more.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3 mt-6">
            <Briefcase className="size-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              งานเพิ่มเติม ({more.length})
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {more.map((job: any) => (
              <ListJobCard
                key={job.id}
                job={job}
                pending={pendingJobIds.has(job.id)}
                onApply={onApply}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/* ============================================================
 *  HeroJobCard — large featured card for Top 10
 * ============================================================ */
function HeroJobCard({
  job,
  pending,
  onApply,
}: {
  job: any;
  pending: boolean;
  onApply: (id: string) => void;
}) {
  const pay = Number(job.pay_amount ?? 0);
  return (
    <Card
      className="
        overflow-hidden hover:ring-2 hover:ring-sky-300 transition-all p-0 group
        snap-start shrink-0
        w-[80%] sm:w-auto
      "
    >
      {/* Cover image / gradient — tall enough to be striking */}
      <div className="relative">
        <JobCardCover
          jobId={job.id}
          category={job.job_category}
          className="!max-h-32 sm:!max-h-28 lg:!max-h-32 !aspect-[4/3] sm:!aspect-[5/3] object-cover"
        />
        {/* Floating pay badge — bottom-right of cover */}
        {pay > 0 && (
          <div className="absolute top-2 right-2 rounded-full bg-emerald-500 text-white px-2.5 py-1 text-[11px] font-bold shadow-lg backdrop-blur">
            💰 {pay.toLocaleString()} TRPB
          </div>
        )}
        {/* Urgency pill — top-left */}
        <div className="absolute top-2 left-2">
          <DeadlineUrgency deadline={job.deadline} />
        </div>
      </div>

      <CardContent className="p-3 space-y-2">
        <h3 className="font-semibold text-foreground line-clamp-2 leading-snug min-h-[2.5rem]">
          {job.title}
        </h3>

        <div className="flex flex-wrap gap-1">
          <span className={cn("inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-medium", BADGE_COLORS[job.type] ?? "")}>
            {TYPE_LABELS[job.type] ?? job.type}
          </span>
          <span className={cn("inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-medium", CATEGORY_COLORS[job.job_category] ?? "")}>
            {CATEGORY_LABELS[job.job_category] ?? job.job_category}
          </span>
        </div>

        <div className="flex items-center gap-1 text-[11px] text-muted-foreground truncate">
          <MapPin className="size-3 shrink-0" />
          <span className="truncate">{job.location}</span>
        </div>

        {/* Team progress strip — only if multi-worker */}
        {job.required_workers > 1 && (
          <TeamStrip jobId={job.id} requiredWorkers={job.required_workers} compact />
        )}

        {pending ? (
          <Button size="sm" variant="secondary" disabled className="w-full opacity-70 text-[11px] h-7">
            ⏳ ส่งคำขอแล้ว
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={() => onApply(job.id)}
            className="w-full h-7 text-[11px] bg-sky-600 hover:bg-sky-700"
          >
            ส่งคำขอรับงาน →
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

/* ============================================================
 *  ListJobCard — compact row for "more jobs" below the hero
 * ============================================================ */
function ListJobCard({
  job,
  pending,
  onApply,
}: {
  job: any;
  pending: boolean;
  onApply: (id: string) => void;
}) {
  const pay = Number(job.pay_amount ?? 0);
  return (
    <Card className="overflow-hidden hover:ring-1 hover:ring-sky-200 transition-all">
      <CardContent className="p-3">
        <div className="flex items-start gap-3">
          {/* Tiny category color dot/icon */}
          <div
            className={cn(
              "shrink-0 size-9 rounded-lg flex items-center justify-center",
              CATEGORY_COLORS[job.job_category] ?? "bg-slate-100 text-slate-600",
            )}
          >
            <Briefcase className="size-4" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h4 className="font-medium text-sm text-foreground line-clamp-1 flex-1">
                {job.title}
              </h4>
              {pay > 0 && (
                <span className="text-xs font-bold text-emerald-700 shrink-0">
                  {pay.toLocaleString()} TRPB
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
              <span className="truncate">{CATEGORY_LABELS[job.job_category] ?? job.job_category}</span>
              <span>·</span>
              <span className="truncate flex items-center gap-0.5">
                <MapPin className="size-2.5" />
                {job.location}
              </span>
              <DeadlineUrgency deadline={job.deadline} />
            </div>

            <div className="flex items-center justify-between mt-2">
              <span className="text-[10px] text-muted-foreground truncate">
                {job.employer?.name ?? "-"}
              </span>
              {pending ? (
                <Button size="sm" variant="secondary" disabled className="h-6 px-2 text-[10px] opacity-70">
                  ส่งแล้ว
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={() => onApply(job.id)}
                  className="h-6 px-2 text-[10px]"
                >
                  สมัคร
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
