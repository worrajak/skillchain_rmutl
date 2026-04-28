"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  UserCheck, AlertTriangle, FileCheck, Briefcase, Users, Award, ClipboardCheck,
  GraduationCap, User, MapPin, Wallet, Shield, Eye,
} from "lucide-react";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  PENDING_REVIEW: { label: "รอพิจารณา", color: "bg-orange-100 text-orange-800" },
  CONFIRMED: { label: "ยืนยันแล้ว", color: "bg-cyan-100 text-cyan-800" },
  OPEN: { label: "เปิดรับ", color: "bg-green-100 text-green-800" },
  ASSIGNED: { label: "มอบหมายแล้ว", color: "bg-blue-100 text-blue-800" },
  IN_PROGRESS: { label: "กำลังทำ", color: "bg-cyan-100 text-cyan-800" },
  SUBMITTED: { label: "ส่งงานแล้ว", color: "bg-yellow-100 text-yellow-800" },
  COMPLETED: { label: "เสร็จสิ้น", color: "bg-green-100 text-green-800" },
  IN_WARRANTY: { label: "อยู่ในประกัน", color: "bg-purple-100 text-purple-800" },
  CLOSED: { label: "ปิดงาน", color: "bg-gray-100 text-gray-800" },
  CANCELLED: { label: "ยกเลิก", color: "bg-red-100 text-red-800" },
};

export default function ProjectStaffDashboardPage() {
  const [stats, setStats] = useState({
    pendingReviews: 0, pendingAssignments: 0, pendingDisputes: 0, pendingCancellations: 0,
    activeJobs: 0, totalStudents: 0, totalCredentials: 0, trainingCourses: 0,
    totalJobs: 0,
  });
  const [pendingJobs, setPendingJobs] = useState<any[]>([]);
  const [recentJobs, setRecentJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const [
        { count: pr }, { count: pa }, { count: pd }, { count: pc },
        { count: aj }, { count: ts }, { count: tc }, { count: trn },
        { count: tj },
      ] = await Promise.all([
        supabase.from("skc_jobs").select("*", { count: "exact", head: true }).eq("status", "PENDING_REVIEW"),
        supabase.from("skc_job_assignment_requests").select("*", { count: "exact", head: true }).eq("status", "PENDING"),
        supabase.from("skc_disputes").select("*", { count: "exact", head: true }).in("status", ["RAISED", "UNDER_REVIEW", "MEDIATION"]),
        supabase.from("skc_job_cancellation_requests").select("*", { count: "exact", head: true }).eq("status", "PENDING"),
        supabase.from("skc_jobs").select("*", { count: "exact", head: true }).in("status", ["ASSIGNED", "IN_PROGRESS"]),
        supabase.from("skc_users").select("*", { count: "exact", head: true }).eq("role", "student"),
        supabase.from("skc_student_credentials").select("*", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("skc_training_courses").select("*", { count: "exact", head: true }).in("status", ["OPEN_ENROLLMENT", "IN_PROGRESS"]),
        supabase.from("skc_jobs").select("*", { count: "exact", head: true }),
      ]);
      setStats({
        pendingReviews: pr ?? 0, pendingAssignments: pa ?? 0, pendingDisputes: pd ?? 0,
        pendingCancellations: pc ?? 0, activeJobs: aj ?? 0, totalStudents: ts ?? 0,
        totalCredentials: tc ?? 0, trainingCourses: trn ?? 0, totalJobs: tj ?? 0,
      });

      // Pending review jobs (with employer name)
      const { data: pendingData } = await supabase
        .from("skc_jobs")
        .select("id, title, status, location, campus, pay_amount, created_at, employer_id, employer:skc_users!skc_jobs_employer_id_fkey(name, email)")
        .eq("status", "PENDING_REVIEW")
        .order("created_at", { ascending: false })
        .limit(10);
      setPendingJobs(pendingData ?? []);

      // Recent jobs (all statuses)
      const { data: recentData } = await supabase
        .from("skc_jobs")
        .select("id, title, status, location, pay_amount, employer_id, student_id, approved_by_staff, created_at, updated_at, employer:skc_users!skc_jobs_employer_id_fkey(name), student:skc_users!skc_jobs_student_id_fkey(name)")
        .order("updated_at", { ascending: false })
        .limit(15);

      // Resolve supervisor names (approved_by_staff is not a FK)
      const supIds = [...new Set((recentData ?? []).map((j) => j.approved_by_staff).filter(Boolean))];
      let supMap: Record<string, string> = {};
      if (supIds.length > 0) {
        const { data: sups } = await supabase.from("skc_users").select("id, name").in("id", supIds);
        supMap = Object.fromEntries((sups ?? []).map((s) => [s.id, s.name]));
      }
      setRecentJobs(
        (recentData ?? []).map((j) => ({ ...j, supervisor_name: j.approved_by_staff ? supMap[j.approved_by_staff] : null }))
      );

      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin size-8 border-4 border-purple-500 border-t-transparent rounded-full" /></div>;

  const actions = [
    { label: "งานรอพิจารณา", value: stats.pendingReviews, icon: ClipboardCheck, color: "text-orange-600", bg: "bg-orange-100", href: "/project-staff/review-jobs", urgent: stats.pendingReviews > 0 },
    { label: "คำขอรับงานรอ", value: stats.pendingAssignments, icon: UserCheck, color: "text-blue-600", bg: "bg-blue-100", href: "/project-staff/approvals", urgent: stats.pendingAssignments > 0 },
    { label: "ข้อพิพาทรอ", value: stats.pendingDisputes, icon: AlertTriangle, color: "text-red-600", bg: "bg-red-100", href: "/project-staff/disputes", urgent: stats.pendingDisputes > 0 },
    { label: "ขอยกเลิกงานรอ", value: stats.pendingCancellations, icon: FileCheck, color: "text-yellow-600", bg: "bg-yellow-100", href: "/project-staff/cancellations", urgent: stats.pendingCancellations > 0 },
    { label: "งานกำลังทำ", value: stats.activeJobs, icon: Briefcase, color: "text-green-600", bg: "bg-green-100", href: "/project-staff/active-jobs", urgent: false },
    { label: "งานทั้งหมด", value: stats.totalJobs, icon: Briefcase, color: "text-cyan-600", bg: "bg-cyan-100", href: "/project-staff/active-jobs", urgent: false },
    { label: "นักศึกษาในระบบ", value: stats.totalStudents, icon: Users, color: "text-purple-600", bg: "bg-purple-100", href: "#", urgent: false },
    { label: "Credentials", value: stats.totalCredentials, icon: Award, color: "text-amber-600", bg: "bg-amber-100", href: "#", urgent: false },
    { label: "หลักสูตรอบรม", value: stats.trainingCourses, icon: GraduationCap, color: "text-indigo-600", bg: "bg-indigo-100", href: "/training", urgent: false },
  ];

  return (
    <div className="space-y-6">
      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {actions.map((a) => (
          <Link key={a.label} href={a.href}>
            <Card className={cn("hover:ring-2 transition-all cursor-pointer", a.urgent ? "ring-2 ring-red-200 bg-red-50/30" : "hover:ring-blue-200")}>
              <CardContent className="flex items-center gap-3 pt-4 pb-4">
                <div className={cn("flex size-10 items-center justify-center rounded-xl", a.bg)}>
                  <a.icon className={cn("size-5", a.color)} />
                </div>
                <div>
                  <div className="text-2xl font-bold text-foreground">{a.value}</div>
                  <div className="text-xs text-muted-foreground">{a.label}</div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Pending Review Jobs */}
      {pendingJobs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardCheck className="size-5 text-orange-600" />
              งานรอพิจารณา ({pendingJobs.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {pendingJobs.map((j: any) => (
              <Link key={j.id} href={`/project-staff/review-jobs`}>
                <div className="border rounded p-3 hover:bg-accent cursor-pointer">
                  <div className="flex items-start justify-between mb-1">
                    <div className="font-medium">{j.title}</div>
                    <Badge className={STATUS_LABELS[j.status]?.color ?? ""}>
                      {STATUS_LABELS[j.status]?.label ?? j.status}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <User className="size-3 text-green-600" />
                      ผู้ว่าจ้าง: <strong className="text-foreground">{j.employer?.name ?? "-"}</strong>
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin className="size-3" />
                      {j.location}
                    </span>
                    {j.pay_amount > 0 && (
                      <span className="flex items-center gap-1">
                        <Wallet className="size-3 text-green-600" />
                        {Number(j.pay_amount).toLocaleString()} TRPB
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Recent Jobs (all statuses) */}
      {recentJobs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Briefcase className="size-5 text-blue-600" />
              งานล่าสุด (ทุกสถานะ)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentJobs.map((j: any) => (
              <Link key={j.id} href={`/project-staff/jobs/${j.id}`}>
                <div className="border rounded p-3 hover:bg-accent cursor-pointer">
                  <div className="flex items-start justify-between mb-1">
                    <div className="font-medium flex items-center gap-2">
                      {j.title}
                      <Eye className="size-3 text-muted-foreground" />
                    </div>
                    <Badge className={STATUS_LABELS[j.status]?.color ?? "bg-gray-100"}>
                      {STATUS_LABELS[j.status]?.label ?? j.status}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <User className="size-3 text-green-600" />
                      {j.employer?.name ?? "-"}
                    </span>
                    {j.student?.name && (
                      <span className="flex items-center gap-1">
                        <User className="size-3 text-blue-600" />
                        นศ.: {j.student.name}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Shield className="size-3 text-amber-600" />
                      {j.supervisor_name ?? "(ยังไม่มี)"}
                    </span>
                    {j.pay_amount > 0 && (
                      <span className="flex items-center gap-1">
                        <Wallet className="size-3" />
                        {Number(j.pay_amount).toLocaleString()} TRPB
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
