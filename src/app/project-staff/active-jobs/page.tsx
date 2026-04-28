"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  Briefcase, CheckCircle, XCircle, Calendar, User, Wallet, Loader2,
  ExternalLink, Eye, Shield, Search, Image as ImageIcon, Camera,
} from "lucide-react";
import { toast } from "sonner";
import { ImageGallery } from "@/components/image-gallery";

const STATUS_TH: Record<string, { label: string; color: string }> = {
  PENDING_REVIEW: { label: "รอพิจารณา", color: "bg-orange-100 text-orange-800" },
  CONFIRMED: { label: "ยืนยันแล้ว", color: "bg-cyan-100 text-cyan-800" },
  OPEN: { label: "เปิดรับ", color: "bg-green-100 text-green-800" },
  ASSIGNED: { label: "มอบหมายแล้ว", color: "bg-blue-100 text-blue-800" },
  IN_PROGRESS: { label: "กำลังทำ", color: "bg-cyan-100 text-cyan-800" },
  SUBMITTED: { label: "ส่งงานแล้ว", color: "bg-yellow-100 text-yellow-800" },
  COMPLETED: { label: "เสร็จสิ้น", color: "bg-green-100 text-green-800" },
  IN_WARRANTY: { label: "อยู่ในประกัน", color: "bg-purple-100 text-purple-800" },
  CLOSED: { label: "ปิดงาน", color: "bg-gray-100 text-gray-800" },
};

const FILTERS = [
  { key: "all", label: "ทั้งหมด", statuses: [] as string[] },
  { key: "pending", label: "🟠 รอพิจารณา", statuses: ["PENDING_REVIEW"] },
  { key: "open", label: "🟢 เปิดรับ", statuses: ["OPEN"] },
  { key: "in_progress", label: "🔵 กำลังทำ", statuses: ["ASSIGNED", "CONFIRMED", "IN_PROGRESS"] },
  { key: "submitted", label: "🟡 ส่งงาน", statuses: ["SUBMITTED"] },
  { key: "done", label: "✅ เสร็จ", statuses: ["COMPLETED"] },
  { key: "warranty", label: "🟣 ในประกัน", statuses: ["IN_WARRANTY"] },
  { key: "mine", label: "👤 ที่ฉันกำกับ", statuses: [] },
];

export default function StaffActiveJobsPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [releasing, setReleasing] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const supabase = createClient();

  async function loadJobs() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    setCurrentUserId(user.id);

    // Always load ALL jobs (exclude CANCELLED) — filter client-side via chips
    const { data } = await supabase
      .from("skc_jobs")
      .select("*, student:skc_users!skc_jobs_student_id_fkey(name), employer:skc_users!skc_jobs_employer_id_fkey(name)")
      .neq("status", "CANCELLED")
      .order("updated_at", { ascending: false });

    // Resolve supervisor names (separate query — approved_by_staff is not a FK)
    const supIds = [...new Set((data ?? []).map((j) => j.approved_by_staff).filter(Boolean))];
    let supMap: Record<string, string> = {};
    if (supIds.length > 0) {
      const { data: sups } = await supabase
        .from("skc_users")
        .select("id, name")
        .in("id", supIds);
      supMap = Object.fromEntries((sups ?? []).map((s) => [s.id, s.name]));
    }

    // Count images per job (for thumbnail hint)
    const jobIds = (data ?? []).map((j) => j.id);
    let imgCount: Record<string, number> = {};
    if (jobIds.length > 0) {
      const { data: imgs } = await supabase
        .from("skc_job_images")
        .select("job_id")
        .in("job_id", jobIds);
      imgCount = (imgs ?? []).reduce((acc: Record<string, number>, img: { job_id: string }) => {
        acc[img.job_id] = (acc[img.job_id] || 0) + 1;
        return acc;
      }, {});
    }

    setJobs(
      (data ?? []).map((j) => ({
        ...j,
        supervisor: j.approved_by_staff ? { id: j.approved_by_staff, name: supMap[j.approved_by_staff] } : null,
        image_count: imgCount[j.id] || 0,
      }))
    );
    setLoading(false);
  }

  useEffect(() => { loadJobs(); }, []);

  const filteredJobs = useMemo(() => {
    let list = jobs;
    if (filter === "mine") {
      list = list.filter((j) => j.approved_by_staff === currentUserId);
    } else if (filter !== "all") {
      const target = FILTERS.find((f) => f.key === filter);
      if (target) list = list.filter((j) => target.statuses.includes(j.status));
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (j) =>
          j.title?.toLowerCase().includes(q) ||
          j.student?.name?.toLowerCase().includes(q) ||
          j.employer?.name?.toLowerCase().includes(q),
      );
    }
    return list;
  }, [jobs, filter, search, currentUserId]);

  const counts = useMemo(() => {
    const map: Record<string, number> = { all: jobs.length };
    for (const f of FILTERS) {
      if (f.key === "all") continue;
      if (f.key === "mine") map[f.key] = jobs.filter((j) => j.approved_by_staff === currentUserId).length;
      else map[f.key] = jobs.filter((j) => f.statuses.includes(j.status)).length;
    }
    return map;
  }, [jobs, currentUserId]);

  async function handleConfirm(jobId: string) {
    setConfirming(jobId);
    const res = await fetch(`/api/jobs/${jobId}/confirm-completion`, { method: "POST" });
    const data = await res.json();
    setConfirming(null);
    if (res.ok) { toast.success(data.message); loadJobs(); }
    else toast.error(data.error);
  }

  return (
    <div className="space-y-4">
      {/* Filter chips */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const active = filter === f.key;
          const count = counts[f.key] ?? 0;
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
                active
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-foreground border-gray-200 hover:border-blue-300"
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

      <Card>
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
            <Briefcase className="size-5" />
            งาน ({filteredJobs.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="size-8 animate-spin text-blue-500" />
            </div>
          ) : filteredJobs.length > 0 ? (
            <div className="space-y-3">
              {filteredJobs.map((job) => {
                const status = STATUS_TH[job.status] ?? { label: job.status, color: "bg-gray-100" };
                const isMine = job.supervisor?.id === currentUserId;
                return (
                  <div
                    key={job.id}
                    className={cn(
                      "rounded-lg border p-4 space-y-2",
                      isMine && "border-amber-300 bg-amber-50/30"
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-foreground">{job.title}</span>
                          {isMine && (
                            <Badge variant="outline" className="text-[10px] border-amber-400 text-amber-700">
                              <Shield className="size-3 mr-0.5" /> คุณกำกับ
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium", status.color)}>
                            {status.label}
                          </span>
                          {job.pay_amount > 0 && (
                            <span className="text-xs text-green-700 font-medium inline-flex items-center gap-1">
                              <Wallet className="size-3" />
                              {job.pay_amount.toLocaleString()} TRPB
                            </span>
                          )}
                          {job.warranty_status === "ACTIVE" && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 text-purple-800 px-2 py-0.5 text-xs">
                              <Shield className="size-3" />
                              ในประกัน
                            </span>
                          )}
                          {job.image_count > 0 && (
                            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                              <ImageIcon className="size-3" /> {job.image_count}
                            </span>
                          )}
                        </div>
                      </div>
                      <Link href={`/project-staff/jobs/${job.id}`}>
                        <Button size="sm" variant="outline" className="gap-1 shrink-0">
                          <Eye className="size-4" /> ดูรายละเอียด
                        </Button>
                      </Link>
                    </div>

                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground pt-1 border-t">
                      <span className="flex items-center gap-1">
                        <User className="size-3 text-blue-600" />
                        นศ.: <strong>{job.student?.name ?? "-"}</strong>
                      </span>
                      <span className="flex items-center gap-1">
                        <User className="size-3 text-green-600" />
                        ผู้จ้าง: <strong>{job.employer?.name ?? "-"}</strong>
                      </span>
                      <span className="flex items-center gap-1">
                        <Shield className="size-3 text-amber-600" />
                        ผู้กำกับ: <strong>{job.supervisor?.name ?? "(ยังไม่มี)"}</strong>
                        {isMine && <span className="text-blue-600 font-medium ml-0.5">(คุณ)</span>}
                      </span>
                      {job.work_start_date && (
                        <span className="flex items-center gap-1">
                          <Calendar className="size-3" />
                          {new Date(job.work_start_date).toLocaleDateString("th-TH")}
                          {job.work_end_date && ` — ${new Date(job.work_end_date).toLocaleDateString("th-TH")}`}
                        </span>
                      )}
                      {job.deadline && !job.work_start_date && (
                        <span className="flex items-center gap-1">
                          <Calendar className="size-3" /> กำหนดส่ง: {new Date(job.deadline).toLocaleDateString("th-TH")}
                        </span>
                      )}
                    </div>

                    {/* Stage hints */}
                    {job.status === "PENDING_REVIEW" && (
                      <div className="text-xs text-orange-700 bg-orange-50 rounded p-2 flex items-center gap-2">
                        <span>🟠</span>
                        <span>
                          รอ Staff พิจารณาก่อนเปิดรับสมัคร —{" "}
                          <Link href="/project-staff/review-jobs" className="underline">ไปหน้าพิจารณา</Link>
                        </span>
                      </div>
                    )}
                    {job.status === "OPEN" && (
                      <div className="text-xs text-green-700 bg-green-50 rounded p-2 flex items-center gap-2">
                        <span>🟢</span>
                        <span>เปิดรับสมัคร — รอ นศ. ส่งคำขอ</span>
                      </div>
                    )}
                    {job.status === "ASSIGNED" && (
                      <div className="text-xs text-blue-700 bg-blue-50 rounded p-2 flex items-center gap-2">
                        <span>🔵</span>
                        <span>มอบหมายแล้ว — รอ นศ. + ผู้จ้าง นัดวันทำงาน</span>
                      </div>
                    )}
                    {job.status === "IN_PROGRESS" && (
                      <div className="text-xs text-cyan-700 bg-cyan-50 rounded p-2 flex items-center gap-2">
                        <Camera className="size-3" />
                        <span>กำลังทำงาน — นศ. ควรอัปโหลดรูประหว่างทำเป็นระยะ</span>
                      </div>
                    )}

                    {/* รูปภาพ — SUBMITTED/COMPLETED/IN_WARRANTY */}
                    {(job.status === "SUBMITTED" || job.status === "COMPLETED" || job.status === "IN_WARRANTY") && (
                      <div className="space-y-1">
                        <ImageGallery jobId={job.id} imageType="completion" label="รูปงานเสร็จ (นศ.)" />
                        <ImageGallery jobId={job.id} imageType="progress" label="รูประหว่างทำงาน" />
                      </div>
                    )}

                    {/* SUBMITTED — ปุ่มยืนยัน */}
                    {job.status === "SUBMITTED" && (
                      <div className="space-y-2 pt-1">
                        <div className="flex gap-4 text-xs">
                          <span className="flex items-center gap-1">
                            {job.staff_confirmed_completion
                              ? <CheckCircle className="size-3 text-green-600" />
                              : <XCircle className="size-3 text-gray-300" />}
                            Staff
                          </span>
                          <span className="flex items-center gap-1">
                            {job.employer_confirmed_completion
                              ? <CheckCircle className="size-3 text-green-600" />
                              : <XCircle className="size-3 text-gray-300" />}
                            ผู้ว่าจ้าง
                          </span>
                        </div>
                        {!job.staff_confirmed_completion && isMine && (
                          <Button size="sm" onClick={() => handleConfirm(job.id)} disabled={confirming === job.id} className="w-full">
                            <CheckCircle className="size-4 mr-1" />
                            {confirming === job.id ? "กำลังยืนยัน..." : "ยืนยันงานเสร็จ"}
                          </Button>
                        )}
                        {!job.staff_confirmed_completion && !isMine && (
                          <p className="text-xs text-muted-foreground text-center">
                            ⚠️ คุณไม่ใช่ผู้กำกับ — ให้ {job.supervisor?.name ?? "supervisor"} ยืนยันแทน
                          </p>
                        )}
                        {job.staff_confirmed_completion && !job.employer_confirmed_completion && (
                          <p className="text-xs text-yellow-700 text-center">Staff ยืนยันแล้ว — รอผู้ว่าจ้างยืนยัน</p>
                        )}
                      </div>
                    )}

                    {job.status === "COMPLETED" && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 rounded-lg p-2">
                          <CheckCircle className="size-3" />เสร็จสมบูรณ์
                        </div>
                        {job.type === "PAID" && job.pay_amount > 0 && !job.escrow_tx && isMine && (
                          <Button
                            size="sm"
                            onClick={async () => {
                              setReleasing(job.id);
                              const res = await fetch(`/api/jobs/${job.id}/release-escrow`, { method: "POST" });
                              const data = await res.json();
                              setReleasing(null);
                              if (res.ok) {
                                toast.success(`${data.message} — TX: ${data.tx_hash?.slice(0, 12)}...`);
                                loadJobs();
                              } else {
                                toast.error(data.error);
                              }
                            }}
                            disabled={releasing === job.id}
                            className="w-full bg-amber-600 hover:bg-amber-700"
                          >
                            {releasing === job.id
                              ? <><Loader2 className="size-4 mr-1 animate-spin" />กำลังจ่ายค่าจ้าง on-chain...</>
                              : <><Wallet className="size-4 mr-1" />จ่ายค่าจ้าง {job.pay_amount.toLocaleString()} TRPB</>}
                          </Button>
                        )}
                        {job.escrow_tx && (
                          <a
                            href={`https://nile.tronscan.org/#/transaction/${job.escrow_tx}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
                          >
                            <ExternalLink className="size-3" />จ่ายแล้ว — ดู TX บน TronScan
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <Briefcase className="size-12 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-foreground font-medium">ไม่พบงานในเงื่อนไขนี้</p>
              <p className="text-xs text-muted-foreground mt-1">
                ลองเปลี่ยนตัวกรอง หรือล้างคำค้นหา
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
