"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Briefcase, PlusCircle, CheckCircle, Clock, AlertTriangle } from "lucide-react";

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

export default function EmployerDashboardPage() {
  const [user, setUser] = useState<Record<string, unknown> | null>(null);
  const [jobs, setJobs] = useState<Record<string, unknown>[]>([]);
  const [stats, setStats] = useState({ total: 0, open: 0, completed: 0, inProgress: 0 });
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) { setLoading(false); return; }

      const [{ data: profile }, { data: myJobs }, { count: total }, { count: open }, { count: completed }, { count: inProgress }] = await Promise.all([
        supabase.from("skc_users").select("*").eq("id", authUser.id).single(),
        supabase.from("skc_jobs").select("id, title, status, type, pay_amount, deadline, student:skc_users!skc_jobs_student_id_fkey(name)").eq("employer_id", authUser.id).order("created_at", { ascending: false }).limit(10),
        supabase.from("skc_jobs").select("*", { count: "exact", head: true }).eq("employer_id", authUser.id),
        supabase.from("skc_jobs").select("*", { count: "exact", head: true }).eq("employer_id", authUser.id).eq("status", "OPEN"),
        supabase.from("skc_jobs").select("*", { count: "exact", head: true }).eq("employer_id", authUser.id).eq("status", "COMPLETED"),
        supabase.from("skc_jobs").select("*", { count: "exact", head: true }).eq("employer_id", authUser.id).eq("status", "IN_PROGRESS"),
      ]);

      setUser(profile);
      setJobs(myJobs ?? []);
      setStats({ total: total ?? 0, open: open ?? 0, completed: completed ?? 0, inProgress: inProgress ?? 0 });
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin size-8 border-4 border-green-500 border-t-transparent rounded-full" /></div>;

  if (!user) return (
    <Card className="max-w-md mx-auto mt-10 text-center">
      <CardContent className="py-10 space-y-4">
        <AlertTriangle className="size-12 mx-auto text-yellow-500" />
        <p className="font-medium text-foreground">กรุณาเข้าสู่ระบบ</p>
        <Link href="/login"><Button>เข้าสู่ระบบ</Button></Link>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <Card>
        <CardContent className="flex items-center justify-between pt-4 pb-4">
          <div className="flex items-center gap-4">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-green-100 text-green-700 font-bold text-xl">
              {String(user.name).charAt(0)}
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">สวัสดี, {String(user.name)}</h2>
              <p className="text-sm text-muted-foreground">{String(user.organization || user.email)}</p>
            </div>
          </div>
          <Link href="/employer/jobs/new">
            <Button><PlusCircle className="size-4 mr-2" />ลงงานใหม่</Button>
          </Link>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "งานทั้งหมด", value: stats.total, icon: Briefcase, color: "text-blue-600", bg: "bg-blue-100" },
          { label: "เปิดรับ", value: stats.open, icon: Clock, color: "text-yellow-600", bg: "bg-yellow-100" },
          { label: "กำลังทำ", value: stats.inProgress, icon: Briefcase, color: "text-cyan-600", bg: "bg-cyan-100" },
          { label: "สำเร็จ", value: stats.completed, icon: CheckCircle, color: "text-green-600", bg: "bg-green-100" },
        ].map((s) => (
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

      {/* My Jobs */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-foreground">งานของฉัน</CardTitle>
            <Link href="/employer/jobs/new"><Button size="sm" variant="outline"><PlusCircle className="size-4 mr-1" />ลงงานใหม่</Button></Link>
          </div>
        </CardHeader>
        <CardContent>
          {jobs.length > 0 ? (
            <div className="space-y-3">
              {jobs.map((j) => (
                <div key={String(j.id)} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <div className="font-medium text-sm text-foreground">{String(j.title)}</div>
                    <div className="text-xs text-muted-foreground">
                      นศ.: {(j.student as { name: string })?.name ? String((j.student as { name: string }).name) : "ยังไม่มี"}
                      {" · "}{String(j.type)}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium", STATUS_LABELS[String(j.status)]?.color ?? "bg-gray-100")}>
                      {STATUS_LABELS[String(j.status)]?.label ?? j.status}
                    </span>
                    {Number(j.pay_amount) > 0 && (
                      <div className="text-xs text-green-700 font-medium mt-0.5">{Number(j.pay_amount).toLocaleString()} TRPB</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Briefcase className="size-10 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">ยังไม่มีงาน</p>
              <Link href="/employer/jobs/new"><Button size="sm" className="mt-3">ลงงานแรก</Button></Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
