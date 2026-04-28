"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  Briefcase, PlusCircle, CheckCircle, Clock, AlertTriangle,
  User, Shield, MapPin, Calendar, Wallet, ChevronRight, Edit3, MessageCircle,
} from "lucide-react";

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
  OPEN: "นศ. กำลังส่งคำขอเข้ามา รอคณะทำงานอนุมัติ",
  ASSIGNED: "นศ. รับงานแล้ว — รอนัดวันทำงาน",
  CONFIRMED: "ยืนยันวันแล้ว นศ. กำลังจะเริ่มทำงาน",
  IN_PROGRESS: "นศ. กำลังทำงาน — สามารถดูรูประหว่างทำได้",
  SUBMITTED: "นศ. ส่งงานแล้ว — กรุณาตรวจรูป + ยืนยันรับงาน",
  COMPLETED: "งานเสร็จสมบูรณ์ — ให้คะแนน นศ. ได้",
  IN_WARRANTY: "อยู่ในระยะประกัน 7 วัน",
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
        supabase.from("skc_jobs").select("id, title, status, type, pay_amount, deadline, location, work_start_date, work_end_date, approved_by_staff, student:skc_users!skc_jobs_student_id_fkey(name)").eq("employer_id", authUser.id).order("updated_at", { ascending: false }).limit(10),
        supabase.from("skc_jobs").select("*", { count: "exact", head: true }).eq("employer_id", authUser.id),
        supabase.from("skc_jobs").select("*", { count: "exact", head: true }).eq("employer_id", authUser.id).eq("status", "OPEN"),
        supabase.from("skc_jobs").select("*", { count: "exact", head: true }).eq("employer_id", authUser.id).eq("status", "COMPLETED"),
        supabase.from("skc_jobs").select("*", { count: "exact", head: true }).eq("employer_id", authUser.id).eq("status", "IN_PROGRESS"),
      ]);

      // Resolve supervisor names (separate query — approved_by_staff is not a FK)
      const list = myJobs ?? [];
      const supIds = [...new Set(list.map((j) => j.approved_by_staff).filter(Boolean) as string[])];
      let supMap: Record<string, string> = {};
      if (supIds.length > 0) {
        const { data: sups } = await supabase.from("skc_users").select("id, name").in("id", supIds);
        supMap = Object.fromEntries((sups ?? []).map((s) => [s.id, s.name]));
      }
      const enriched = list.map((j) => ({
        ...j,
        supervisor_name: j.approved_by_staff ? supMap[j.approved_by_staff as string] : null,
      }));

      setUser(profile);
      setJobs(enriched);
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
              {jobs.map((j) => {
                const status = STATUS_LABELS[String(j.status)] ?? { label: String(j.status), color: "bg-gray-100" };
                const studentName = (j.student as { name: string } | null)?.name;
                const supervisorName = (j as { supervisor_name?: string | null }).supervisor_name;
                const hint = STATUS_HINT[String(j.status)];
                const canEdit = ["PENDING_REVIEW", "OPEN", "ASSIGNED"].includes(String(j.status));
                const hasStudent = !!studentName;

                return (
                  <Link key={String(j.id)} href={`/employer/jobs/${String(j.id)}`} className="block">
                    <div className="rounded-lg border hover:border-green-300 hover:shadow-sm transition-all p-4 space-y-2">
                      {/* Header */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-foreground">{String(j.title)}</div>
                          <div className="flex flex-wrap items-center gap-1.5 mt-1">
                            <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium", status.color)}>
                              {status.label}
                            </span>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">{String(j.type)}</span>
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

                      {/* Details */}
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground pt-2 border-t">
                        <span className="flex items-center gap-1">
                          <User className="size-3 text-blue-600" />
                          นศ.: <strong className="text-foreground">{studentName ?? "ยังไม่มี"}</strong>
                        </span>
                        <span className="flex items-center gap-1">
                          <Shield className="size-3 text-amber-600" />
                          ผู้กำกับ: <strong className="text-foreground">{supervisorName ?? "(ยังไม่มี)"}</strong>
                        </span>
                        {Boolean(j.location) && (
                          <span className="flex items-center gap-1">
                            <MapPin className="size-3" />
                            {String(j.location)}
                          </span>
                        )}
                        {Boolean(j.work_start_date || j.deadline) && (
                          <span className="flex items-center gap-1">
                            <Calendar className="size-3" />
                            {j.work_start_date
                              ? `${new Date(String(j.work_start_date)).toLocaleDateString("th-TH")}${j.work_end_date ? ` — ${new Date(String(j.work_end_date)).toLocaleDateString("th-TH")}` : ""}`
                              : `กำหนดส่ง: ${new Date(String(j.deadline)).toLocaleDateString("th-TH")}`}
                          </span>
                        )}
                      </div>

                      {/* Status hint */}
                      {hint && (
                        <div className="text-xs text-blue-700 bg-blue-50 rounded p-2 mt-1">
                          💡 {hint}
                        </div>
                      )}

                      {/* Quick actions */}
                      <div className="flex flex-wrap gap-2 pt-1 text-xs">
                        <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-green-600 text-white font-medium">
                          ดูรายละเอียด + จัดการ
                        </span>
                        {canEdit && (
                          <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border bg-white text-foreground font-medium">
                            <Edit3 className="size-3" /> แก้ไขในหน้ารายละเอียด
                          </span>
                        )}
                        {hasStudent && (
                          <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border bg-white text-foreground font-medium">
                            <MessageCircle className="size-3" /> แชทกับ {studentName}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
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
