"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  Search,
  MapPin,
  Clock,
  Wallet,
  Briefcase,
  CheckCircle,
} from "lucide-react";
import { toast } from "sonner";
import { ImageGallery } from "@/components/image-gallery";
import { getCampusLabel } from "@/types/database";

const TYPE_LABELS: Record<string, string> = { PAID: "งานจ้าง", VOLUNTEER: "จิตอาสา", TRAINING: "ฝึกทักษะ", EXEMPTED: "ยกเว้นค่าบริการ" };
const CATEGORY_LABELS: Record<string, string> = { electrical: "ไฟฟ้า", hvac: "แอร์/เครื่องเย็น", automotive: "ยานยนต์", general: "ทั่วไป" };
const BADGE_COLORS: Record<string, string> = { PAID: "bg-green-100 text-green-800", VOLUNTEER: "bg-blue-100 text-blue-800", TRAINING: "bg-yellow-100 text-yellow-800", EXEMPTED: "bg-purple-100 text-purple-800" };
const CATEGORY_COLORS: Record<string, string> = { electrical: "bg-amber-100 text-amber-800", hvac: "bg-cyan-100 text-cyan-800", automotive: "bg-red-100 text-red-800", general: "bg-gray-100 text-gray-800" };

export default function StudentJobsPage() {
  const [jobs, setJobs] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [userId, setUserId] = useState<string | null>(null);

  const supabase = createClient();

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setUserId(user.id);
    }
    init();
  }, []);

  useEffect(() => {
    async function load() {
      setLoading(true);
      let query = supabase
        .from("skc_jobs")
        .select("*, employer:skc_users!skc_jobs_employer_id_fkey(name)")
        .eq("status", "OPEN")
        .order("created_at", { ascending: false });

      if (filterType !== "all") query = query.eq("type", filterType);
      if (search) query = query.ilike("title", `%${search}%`);

      const { data } = await query;
      setJobs(data ?? []);
      setLoading(false);
    }
    load();
  }, [filterType, search]);

  async function handleApply(jobId: string) {
    if (!userId) { toast.error("กรุณาเข้าสู่ระบบ"); return; }

    // ส่งคำขอรับงาน → รอ project_staff อนุมัติ (ไม่ได้ assign ตรง)
    const { error } = await supabase
      .from("skc_job_assignment_requests")
      .insert({ job_id: jobId, student_id: userId });

    if (error) {
      if (error.code === "23505") {
        toast.error("คุณส่งคำขอรับงานนี้ไปแล้ว");
      } else {
        toast.error("ส่งคำขอไม่สำเร็จ: " + error.message);
      }
    } else {
      toast.success("ส่งคำขอรับงานแล้ว — รอคณะทำงานอนุมัติ");
      // แจ้ง staff
      const { data: staffUsers } = await supabase.from("skc_users").select("id")
        .in("role", ["project_staff", "admin", "superadmin"]).eq("approval_status", "APPROVED");
      if (staffUsers) {
        await supabase.from("skc_notifications").insert(
          staffUsers.map((s) => ({ user_id: s.id, type: "assignment_request", title: "คำขอรับงานใหม่", body: "นักศึกษาส่งคำขอรับงาน รอการอนุมัติ", link: "/project-staff/approvals" }))
        );
      }
    }
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
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

      {/* Job List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin size-8 border-4 border-blue-500 border-t-transparent rounded-full" />
        </div>
      ) : jobs.length > 0 ? (
        <div className="grid md:grid-cols-2 gap-4">
          {jobs.map((job) => (
            <Card key={job.id as string} className="hover:ring-2 hover:ring-blue-200 transition-all">
              <CardHeader className="pb-3">
                <CardTitle className="text-base text-foreground">{job.title as string}</CardTitle>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium", BADGE_COLORS[job.type as string] ?? "")}>
                    {TYPE_LABELS[job.type as string] ?? job.type}
                  </span>
                  <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium", CATEGORY_COLORS[job.job_category as string] ?? "")}>
                    {CATEGORY_LABELS[job.job_category as string] ?? job.job_category}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground line-clamp-2">{job.description as string}</p>
                <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><MapPin className="size-3" />{job.location as string} ({getCampusLabel(job.campus as string)})</span>
                  <span className="flex items-center gap-1"><Clock className="size-3" />กำหนดส่ง: {new Date(job.deadline as string).toLocaleDateString("th-TH")}</span>
                  {(job.pay_amount as number) > 0 && (
                    <span className="flex items-center gap-1 text-green-700 font-medium"><Wallet className="size-3" />{(job.pay_amount as number).toLocaleString()} TRPB</span>
                  )}
                </div>
                <ImageGallery jobId={job.id as string} imageType="job" />
                <div className="flex items-center justify-between pt-2 border-t">
                  <span className="text-xs text-muted-foreground">
                    โดย: {(job.employer as { name: string })?.name ?? "ไม่ระบุ"}
                  </span>
                  <Button size="sm" onClick={() => handleApply(job.id as string)}>
                    ส่งคำขอรับงาน
                  </Button>
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
      )}
    </div>
  );
}
