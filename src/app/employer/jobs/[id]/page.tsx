"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StaffSupervisorBadge } from "@/components/staff-supervisor-badge";
import { cn } from "@/lib/utils";
import {
  Briefcase, MapPin, Clock, Wallet, User, Calendar, CheckCircle, XCircle, Send, ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

const STATUS_TH: Record<string, { label: string; color: string }> = {
  OPEN: { label: "เปิดรับ", color: "bg-green-100 text-green-800" },
  ASSIGNED: { label: "มอบหมายแล้ว", color: "bg-blue-100 text-blue-800" },
  IN_PROGRESS: { label: "กำลังทำ", color: "bg-cyan-100 text-cyan-800" },
  SUBMITTED: { label: "ส่งงานแล้ว", color: "bg-yellow-100 text-yellow-800" },
  COMPLETED: { label: "เสร็จสิ้น", color: "bg-green-100 text-green-800" },
  CANCELLED: { label: "ยกเลิก", color: "bg-gray-100 text-gray-800" },
  DISPUTED: { label: "มีข้อพิพาท", color: "bg-red-100 text-red-800" },
};

export default function EmployerJobDetailPage() {
  const { id } = useParams<{ id: string }>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [job, setJob] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

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

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setUserId(user.id);
    }
    init();
    loadJob();
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

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/employer/jobs">
          <Button variant="ghost" size="sm"><ArrowLeft className="size-4 mr-1" />กลับ</Button>
        </Link>
      </div>

      {/* Job Info */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <span className={cn("inline-flex rounded-full px-3 py-1 text-sm font-medium", status.color)}>{status.label}</span>
            <StaffSupervisorBadge name={staffName} />
          </div>
          <CardTitle className="text-foreground">{job.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">{job.description}</p>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2"><MapPin className="size-4 text-muted-foreground" /><span>{job.location} ({job.campus})</span></div>
            <div className="flex items-center gap-2"><Clock className="size-4 text-muted-foreground" /><span>กำหนด: {new Date(job.deadline).toLocaleDateString("th-TH")}</span></div>
            {job.pay_amount > 0 && <div className="flex items-center gap-2"><Wallet className="size-4 text-green-600" /><span className="text-green-700 font-bold">{job.pay_amount.toLocaleString()} TRPB</span></div>}
            {studentName && <div className="flex items-center gap-2"><User className="size-4 text-blue-600" /><span className="font-medium">{studentName}</span></div>}
          </div>
        </CardContent>
      </Card>

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

      {/* Confirm Completion — SUBMITTED */}
      {job.status === "SUBMITTED" && (
        <Card className="border-yellow-200">
          <CardHeader>
            <CardTitle className="text-foreground text-sm">ยืนยันงานเสร็จ</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">นักศึกษาส่งงานแล้ว — ต้องการให้ทั้ง Staff ผู้กำกับ และ ผู้ว่าจ้าง ยืนยัน</p>
            <div className="flex gap-4">
              <div className="flex items-center gap-2 text-sm">
                {job.staff_confirmed_completion
                  ? <CheckCircle className="size-4 text-green-600" />
                  : <XCircle className="size-4 text-gray-300" />}
                <span className={job.staff_confirmed_completion ? "text-green-700" : "text-muted-foreground"}>Staff: {staffName ?? "-"}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                {job.employer_confirmed_completion
                  ? <CheckCircle className="size-4 text-green-600" />
                  : <XCircle className="size-4 text-gray-300" />}
                <span className={job.employer_confirmed_completion ? "text-green-700" : "text-muted-foreground"}>ผู้ว่าจ้าง</span>
              </div>
            </div>
            {!job.employer_confirmed_completion && (
              <Button onClick={handleConfirmCompletion} disabled={submitting} className="w-full">
                <CheckCircle className="size-4 mr-2" />{submitting ? "กำลังยืนยัน..." : "ยืนยันงานเสร็จ"}
              </Button>
            )}
            {job.employer_confirmed_completion && !job.staff_confirmed_completion && (
              <p className="text-sm text-yellow-700 text-center">คุณยืนยันแล้ว — รอ Staff ยืนยัน</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Completed */}
      {job.status === "COMPLETED" && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="flex items-center gap-3 pt-4 pb-4">
            <CheckCircle className="size-6 text-green-600" />
            <div>
              <p className="font-medium text-green-800">งานเสร็จสมบูรณ์</p>
              <p className="text-xs text-green-700">พร้อมเข้าสู่ระบบประเมิน</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
