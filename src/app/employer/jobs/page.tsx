"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { getCampusLabel } from "@/types/database";
import { Briefcase, PlusCircle, Eye, Trash2, MessageCircle, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { StaffSupervisorBadge } from "@/components/staff-supervisor-badge";

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
            return (
              <Card key={String(j.id)}>
                <CardContent className="flex items-center justify-between pt-4 pb-4">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-foreground">{String(j.title)}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {String(j.type)} · {String(j.job_category)} · {getCampusLabel(String(j.campus))}
                      {hasStudent && ` · นศ.: ${String((j.student as Record<string, unknown>)?.name)}`}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium", STATUS_LABELS[String(j.status)]?.color ?? "")}>
                        {STATUS_LABELS[String(j.status)]?.label ?? j.status}
                      </span>
                      {Number(j.pay_amount) > 0 && <span className="text-xs text-green-700 font-medium">{Number(j.pay_amount).toLocaleString()} TRPB</span>}
                      <StaffSupervisorBadge name={(j.staff_supervisor as { name: string } | null)?.name} />
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Link href={`/employer/jobs/${j.id}`}>
                      <Button variant="ghost" size="sm" title="ดูรายละเอียด">👁️</Button>
                    </Link>
                    {["PENDING_REVIEW", "OPEN", "ASSIGNED"].includes(String(j.status)) && (
                      <Link href={`/employer/jobs/${j.id}/edit`}>
                        <Button variant="ghost" size="sm" title="แก้ไขงาน">✏️</Button>
                      </Link>
                    )}
                    {hasStudent && String(j.status) !== "CANCELLED" && (
                      <Link href={`/employer/jobs/${j.id}`}>
                        <Button variant="ghost" size="sm" title="แชท"><MessageCircle className="size-4" /></Button>
                      </Link>
                    )}
                    <Button variant="ghost" size="sm" className="text-red-600" onClick={() => handleDelete(String(j.id), hasStudent)} title="ลบ">
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </CardContent>
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
