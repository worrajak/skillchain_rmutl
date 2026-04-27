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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Search, Edit2, Trash2, Eye } from "lucide-react";
import { toast } from "sonner";
import { getCampusLabel } from "@/types/database";

interface Job {
  id: string;
  title: string;
  description: string;
  type: string;
  job_category: string;
  status: string;
  hiring_mode: string;
  location: string;
  campus: string;
  pay_amount: number;
  deadline: string;
  employer_id: string;
  student_id: string | null;
  created_at: string;
  employer?: { name: string };
  student?: { name: string } | null;
}

const STATUS_OPTIONS = [
  { value: "PENDING_REVIEW", label: "รอพิจารณา", color: "bg-orange-100 text-orange-800" },
  { value: "OPEN", label: "เปิดรับ", color: "bg-green-100 text-green-800" },
  { value: "ASSIGNED", label: "มอบหมาย", color: "bg-blue-100 text-blue-800" },
  { value: "CONFIRMED", label: "ยืนยัน", color: "bg-indigo-100 text-indigo-800" },
  { value: "IN_PROGRESS", label: "กำลังทำ", color: "bg-cyan-100 text-cyan-800" },
  { value: "SUBMITTED", label: "ส่งงาน", color: "bg-yellow-100 text-yellow-800" },
  { value: "COMPLETED", label: "เสร็จ", color: "bg-green-100 text-green-800" },
  { value: "CANCELLED", label: "ยกเลิก", color: "bg-gray-100 text-gray-800" },
  { value: "DISPUTED", label: "พิพาท", color: "bg-red-100 text-red-800" },
];

const TYPE_LABELS: Record<string, string> = {
  PAID: "งานจ้าง", VOLUNTEER: "จิตอาสา", TRAINING: "ฝึกทักษะ", EXEMPTED: "ยกเว้นค่าบริการ",
};

const CATEGORY_LABELS: Record<string, string> = {
  electrical: "ไฟฟ้า", hvac: "แอร์/เครื่องเย็น", automotive: "ยานยนต์", general: "ทั่วไป",
};

export default function AdminJobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [editJob, setEditJob] = useState<Job | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [detailJob, setDetailJob] = useState<Job | null>(null);

  const supabase = createClient();

  async function loadJobs() {
    setLoading(true);
    let query = supabase
      .from("skc_jobs")
      .select("*, employer:skc_users!skc_jobs_employer_id_fkey(name), student:skc_users!skc_jobs_student_id_fkey(name)")
      .order("created_at", { ascending: false });

    if (filterStatus !== "all") query = query.eq("status", filterStatus);
    if (search) query = query.ilike("title", `%${search}%`);

    const { data } = await query;
    setJobs((data as Job[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { loadJobs(); }, [filterStatus, search]);

  async function handleUpdateStatus(jobId: string, newStatus: string) {
    const { error } = await supabase
      .from("skc_jobs")
      .update({ status: newStatus })
      .eq("id", jobId);

    if (!error) {
      toast.success(`เปลี่ยนสถานะเป็น ${STATUS_OPTIONS.find((s) => s.value === newStatus)?.label}`);
      loadJobs();
      setEditOpen(false);
    } else {
      toast.error(error.message);
    }
  }

  async function handleDelete(job: Job) {
    if (!confirm(`ต้องการลบงาน "${job.title}" จริงหรือไม่?`)) return;
    const { error } = await supabase.from("skc_jobs").delete().eq("id", job.id);
    if (!error) {
      toast.success("ลบสำเร็จ");
      loadJobs();
    } else {
      toast.error(error.message);
    }
  }

  const statusInfo = (status: string) => STATUS_OPTIONS.find((s) => s.value === status);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card>
        <CardContent className="flex flex-wrap gap-3 pt-4 pb-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="ค้นหาชื่องาน..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={filterStatus} onValueChange={(v) => v && setFilterStatus(v)}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="ทุกสถานะ" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทุกสถานะ</SelectItem>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Jobs Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-foreground">งานทั้งหมด ({jobs.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin size-6 border-4 border-blue-500 border-t-transparent rounded-full" />
            </div>
          ) : jobs.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ชื่องาน</TableHead>
                    <TableHead>ประเภท</TableHead>
                    <TableHead>หมวด</TableHead>
                    <TableHead>สถานะ</TableHead>
                    <TableHead>ค่าจ้าง</TableHead>
                    <TableHead>ผู้ว่าจ้าง</TableHead>
                    <TableHead>นักศึกษา</TableHead>
                    <TableHead className="text-right">จัดการ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobs.map((job) => (
                    <TableRow key={job.id}>
                      <TableCell className="font-medium text-foreground max-w-[200px] truncate">
                        {job.title}
                      </TableCell>
                      <TableCell>
                        <span className="text-xs">{TYPE_LABELS[job.type] ?? job.type}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs">{CATEGORY_LABELS[job.job_category] ?? job.job_category}</span>
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusInfo(job.status)?.color ?? ""}`}>
                          {statusInfo(job.status)?.label ?? job.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm">
                        {job.pay_amount > 0 ? `${job.pay_amount.toLocaleString()} TRPB` : "-"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {job.employer?.name ?? "-"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {job.student?.name ?? "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => setDetailJob(job)}>
                            <Eye className="size-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => { setEditJob(job); setEditOpen(true); }}>
                            <Edit2 className="size-4" />
                          </Button>
                          <Button variant="ghost" size="sm" className="text-red-600" onClick={() => handleDelete(job)}>
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">ไม่พบงาน</p>
          )}
        </CardContent>
      </Card>

      {/* Edit Status Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-foreground">เปลี่ยนสถานะงาน</DialogTitle>
          </DialogHeader>
          {editJob && (
            <div className="space-y-4">
              <p className="text-sm text-foreground font-medium">{editJob.title}</p>
              <p className="text-xs text-muted-foreground">สถานะปัจจุบัน: {statusInfo(editJob.status)?.label}</p>
              <div className="space-y-2">
                <Label className="text-foreground">เปลี่ยนเป็น</Label>
                <div className="grid grid-cols-2 gap-2">
                  {STATUS_OPTIONS.map((s) => (
                    <Button
                      key={s.value}
                      variant={editJob.status === s.value ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleUpdateStatus(editJob.id, s.value)}
                      disabled={editJob.status === s.value}
                    >
                      {s.label}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={!!detailJob} onOpenChange={() => setDetailJob(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-foreground">รายละเอียดงาน</DialogTitle>
          </DialogHeader>
          {detailJob && (
            <div className="space-y-3 text-sm">
              <div><span className="text-muted-foreground">ชื่องาน:</span> <span className="text-foreground font-medium">{detailJob.title}</span></div>
              <div><span className="text-muted-foreground">รายละเอียด:</span> <span className="text-foreground">{detailJob.description}</span></div>
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-muted-foreground">ประเภท:</span> {TYPE_LABELS[detailJob.type]}</div>
                <div><span className="text-muted-foreground">หมวด:</span> {CATEGORY_LABELS[detailJob.job_category]}</div>
                <div><span className="text-muted-foreground">สถานที่:</span> {detailJob.location}</div>
                <div><span className="text-muted-foreground">วิทยาเขต:</span> {getCampusLabel(String(detailJob.campus))}</div>
                <div><span className="text-muted-foreground">ค่าจ้าง:</span> {detailJob.pay_amount > 0 ? `${detailJob.pay_amount} TRPB` : "-"}</div>
                <div><span className="text-muted-foreground">กำหนดส่ง:</span> {new Date(detailJob.deadline).toLocaleDateString("th-TH")}</div>
                <div><span className="text-muted-foreground">ผู้ว่าจ้าง:</span> {detailJob.employer?.name ?? "-"}</div>
                <div><span className="text-muted-foreground">นักศึกษา:</span> {detailJob.student?.name ?? "-"}</div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
