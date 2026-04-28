"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { getCampusLabel } from "@/types/database";
import { Briefcase, PlusCircle, Trash2, MessageCircle, User, Shield, MapPin, Calendar, Wallet, ChevronRight, Edit3 } from "lucide-react";
import { toast } from "sonner";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  PENDING_REVIEW: { label: "รอพิจารณา", color: "bg-orange-100 text-orange-800" },
  OPEN: { label: "เปิดรับสมัคร", color: "bg-green-100 text-green-800" },
  ASSIGNED: { label: "ได้รับมอบหมาย", color: "bg-blue-100 text-blue-800" },
  CONFIRMED: { label: "ยืนยันวันแล้ว", color: "bg-cyan-100 text-cyan-800" },
  IN_PROGRESS: { label: "กำลังทำงาน", color: "bg-cyan-100 text-cyan-800" },
  SUBMITTED: { label: "ส่งมอบงานแล้ว", color: "bg-yellow-100 text-yellow-800" },
  COMPLETED: { label: "เสร็จสมบูรณ์", color: "bg-green-100 text-green-800" },
  IN_WARRANTY: { label: "อยู่ในประกัน", color: "bg-purple-100 text-purple-800" },
  CLOSED: { label: "ปิดงาน", color: "bg-gray-100 text-gray-800" },
  CANCELLED: { label: "ยกเลิก", color: "bg-gray-100 text-gray-800" },
  DISPUTED: { label: "มีข้อพิพาท", color: "bg-red-100 text-red-800" },
};

const STATUS_HINT: Record<string, string> = {
  PENDING_REVIEW: "รอคณะทำงานพิจารณาก่อนเปิดรับสมัคร",
  OPEN: "นศ. กำลังส่งคำขอเข้ามา",
  ASSIGNED: "นศ. รับงานแล้ว — รอนัดวันทำงาน",
  CONFIRMED: "ยืนยันวันแล้ว นศ. กำลังจะเริ่มทำงาน",
  IN_PROGRESS: "นศ. กำลังทำงาน — ดูรูประหว่างทำได้",
  SUBMITTED: "🎉 นศ. ส่งงานแล้ว — กรุณาตรวจรูป + ยืนยันรับงาน",
  COMPLETED: "งานเสร็จสมบูรณ์ — ให้คะแนน นศ. ได้",
  IN_WARRANTY: "อยู่ในระยะประกัน 7 วัน",
};

export default function EmployerJobsPage() {
  const [jobs, setJobs] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  async function loadJobs() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data } = await supabase.from("skc_jobs")
      .select("*, student:skc_users!skc_jobs_student_id_fkey(name)")
      .eq("employer_id", user.id)
      .order("created_at", { ascending: false });

    // Fetch staff supervisor names separately
    const jobList = data ?? [];
    const staffIds = [...new Set(jobList.filter((j) => j.approved_by_staff).map((j) => j.approved_by_staff as string))];
    if (staffIds.length > 0) {
      const { data: staffUsers } = await supabase.from("skc_users").select("id, name").in("id", staffIds);
      const staffMap = new Map((staffUsers ?? []).map((s) => [s.id, s.name]));
      for (const j of jobList) {
        (j as Record<string, unknown>).staff_supervisor = j.approved_by_staff ? { name: staffMap.get(j.approved_by_staff as string) ?? null } : null;
      }
    }
    setJobs(jobList);
    setLoading(false);
  }

  useEffect(() => { loadJobs(); }, []);

  async function handleDelete(jobId: string, hasStudent: boolean) {
    if (hasStudent) {
      toast.error("งานนี้มีนักศึกษารับแล้ว ต้องส่งคำร้องขอยกเลิกแทน");
      return;
    }
    if (!confirm("ต้องการลบงานนี้?")) return;
    const res = await fetch(`/api/jobs/${jobId}`, { method: "DELETE" });
    if (res.ok) { toast.success("ลบแล้ว"); loadJobs(); }
    else { const err = await res.json(); toast.error(err.error); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-foreground">งานของฉัน ({jobs.length})</h2>
        <Link href="/employer/jobs/new"><Button><PlusCircle className="size-4 mr-1" />ลงงานใหม่</Button></Link>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin size-8 border-4 border-green-500 border-t-transparent rounded-full" /></div>
      ) : jobs.length > 0 ? (
        <div className="space-y-3">
          {jobs.map((j) => {
            const hasStudent = !!j.student_id;
            const status = STATUS_LABELS[String(j.status)] ?? { label: String(j.status), color: "bg-gray-100" };
            const studentName = (j.student as { name: string } | null)?.name;
            const supervisorName = (j.staff_supervisor as { name: string } | null)?.name;
            const hint = STATUS_HINT[String(j.status)];
            const canEdit = ["PENDING_REVIEW", "OPEN", "ASSIGNED"].includes(String(j.status));

            return (
              <Card key={String(j.id)} className="overflow-hidden">
                <Link href={`/employer/jobs/${j.id}`} className="block hover:bg-accent/30 transition-colors">
                  <CardContent className="pt-4 pb-4 space-y-2">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-foreground">{String(j.title)}</div>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                          <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium", status.color)}>
                            {status.label}
                          </span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">{String(j.type)}</span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">{String(j.job_category)}</span>
                          {Number(j.pay_amount) > 0 && (
                            <span className="text-xs text-green-700 font-medium inline-flex items-center gap-1">
                              <Wallet className="size-3" />
                              {Number(j.pay_amount).toLocaleString()} TRPB
                            </span>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="size-4 text-muted-foreground shrink-0 mt-1" />
                    </div>

                    {/* Details row */}
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground pt-2 border-t">
                      <span className="flex items-center gap-1">
                        <User className="size-3 text-blue-600" />
                        นศ.: <strong className="text-foreground">{studentName ?? "ยังไม่มี"}</strong>
                      </span>
                      <span className="flex items-center gap-1">
                        <Shield className="size-3 text-amber-600" />
                        ผู้กำกับ: <strong className="text-foreground">{supervisorName ?? "(ยังไม่มี)"}</strong>
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="size-3" />
                        {getCampusLabel(String(j.campus))}
                      </span>
                      {Boolean(j.deadline) && (
                        <span className="flex items-center gap-1">
                          <Calendar className="size-3" />
                          กำหนดส่ง: {new Date(String(j.deadline)).toLocaleDateString("th-TH")}
                        </span>
                      )}
                    </div>

                    {/* Status hint */}
                    {hint && (
                      <div className={cn(
                        "text-xs rounded p-2 mt-1",
                        String(j.status) === "SUBMITTED"
                          ? "bg-orange-50 text-orange-800 border border-orange-200 font-medium"
                          : "bg-blue-50 text-blue-700"
                      )}>
                        {String(j.status) === "SUBMITTED" ? hint : `💡 ${hint}`}
                      </div>
                    )}

                    {/* Action chips (visual only — whole card is clickable) */}
                    <div className="flex flex-wrap gap-2 pt-1 text-xs">
                      <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-green-600 text-white font-medium">
                        ดูรายละเอียด + จัดการ
                      </span>
                      {canEdit && (
                        <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border bg-white text-foreground font-medium">
                          <Edit3 className="size-3" /> แก้ไขงาน
                        </span>
                      )}
                      {hasStudent && String(j.status) !== "CANCELLED" && (
                        <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border bg-white text-foreground font-medium">
                          <MessageCircle className="size-3" /> แชทกับ {studentName}
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Link>

                {/* Delete — separated, prevents accidental click on card */}
                <div className="border-t bg-muted/30 px-4 py-2 flex justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-600 h-7 text-xs"
                    onClick={() => handleDelete(String(j.id), hasStudent)}
                  >
                    <Trash2 className="size-3 mr-1" />ลบงาน
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="text-center py-12">
          <CardContent>
            <Briefcase className="size-12 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-foreground font-medium">ยังไม่มีงาน</p>
            <Link href="/employer/jobs/new"><Button className="mt-3">ลงงานแรก</Button></Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
