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
  Search, MapPin, Clock, Wallet, Briefcase, CheckCircle, User, Shield, Eye,
} from "lucide-react";
import { toast } from "sonner";
import { ImageGallery } from "@/components/image-gallery";
import { JobCardCover, DeadlineUrgency } from "@/components/job-card-cover";
import { UserAvatar } from "@/components/user-avatar";
import { TeamStrip } from "@/components/team-strip";
import { getCampusLabel } from "@/types/database";

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

    const { error } = await supabase
      .from("skc_job_assignment_requests")
      .insert({ job_id: jobId, student_id: userId });

    if (error) {
      if (error.code === "23505") toast.error("คุณส่งคำขอรับงานนี้ไปแล้ว");
      else toast.error("ส่งคำขอไม่สำเร็จ: " + error.message);
    } else {
      toast.success("ส่งคำขอรับงานแล้ว — รอคณะทำงานอนุมัติ");
      // Optimistic UI: append the new request so the button flips immediately
      setPendingRequests((prev) => [...prev, { id: `tmp-${jobId}`, job_id: jobId, status: "PENDING" }]);
      const { data: staffUsers } = await supabase.from("skc_users").select("id")
        .in("role", ["project_staff", "admin", "superadmin"]).eq("approval_status", "APPROVED");
      if (staffUsers) {
        await supabase.from("skc_notifications").insert(
          staffUsers.map((s: any) => ({ user_id: s.id, type: "assignment_request", title: "คำขอรับงานใหม่", body: "นักศึกษาส่งคำขอรับงาน รอการอนุมัติ", link: "/project-staff/approvals" }))
        );
      }
    }
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
        // === งานเปิดรับ ===
        openJobs.length > 0 ? (
          <div className="grid md:grid-cols-2 gap-4">
            {openJobs.map((job: any) => (
              <Card key={job.id} className="overflow-hidden hover:ring-2 hover:ring-sky-200 transition-all p-0">
                <JobCardCover jobId={job.id} category={job.job_category} />
                <CardHeader className="pb-3 pt-4">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base text-foreground line-clamp-2 flex-1">{job.title}</CardTitle>
                    <DeadlineUrgency deadline={job.deadline} />
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium", BADGE_COLORS[job.type] ?? "")}>
                      {TYPE_LABELS[job.type] ?? job.type}
                    </span>
                    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium", CATEGORY_COLORS[job.job_category] ?? "")}>
                      {CATEGORY_LABELS[job.job_category] ?? job.job_category}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground line-clamp-2">{job.description}</p>
                  <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><MapPin className="size-3" />{job.location} ({getCampusLabel(job.campus)})</span>
                    <span className="flex items-center gap-1"><Clock className="size-3" />กำหนดส่ง: {new Date(job.deadline).toLocaleDateString("th-TH")}</span>
                    {job.pay_amount > 0 && (
                      <span className="flex items-center gap-1 text-green-700 font-semibold text-sm"><Wallet className="size-3.5" />{job.pay_amount.toLocaleString()} TRPB</span>
                    )}
                  </div>
                  {/* Team strip — show filled spots vs required */}
                  {job.required_workers > 1 && (
                    <div className="pt-2 border-t">
                      <TeamStrip jobId={job.id} requiredWorkers={job.required_workers} compact />
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-2 border-t">
                    <span className="text-xs text-muted-foreground">โดย: {job.employer?.name ?? "-"}</span>
                    {pendingJobIds.has(job.id) ? (
                      <Button size="sm" variant="secondary" disabled className="opacity-70">
                        ⏳ ส่งคำขอแล้ว
                      </Button>
                    ) : (
                      <Button size="sm" onClick={() => handleApply(job.id)}>ส่งคำขอรับงาน</Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
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
