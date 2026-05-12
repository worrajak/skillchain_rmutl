"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  UserCheck, AlertTriangle, FileCheck, Briefcase, Users, Award, ClipboardCheck,
  GraduationCap, ChevronRight,
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

interface DashCardProps {
  title: string;
  count: number;
  icon: React.ElementType;
  color: string;
  bg: string;
  href: string;
  urgent?: boolean;
  items?: { id: string; primary: string; secondary?: string; badge?: string; badgeColor?: string }[];
}

function DashCard({ title, count, icon: Icon, color, bg, href, urgent, items }: DashCardProps) {
  return (
    <Link href={href}>
      <Card className={cn("hover:ring-2 transition-all cursor-pointer h-full", urgent ? "ring-2 ring-red-200 bg-red-50/30" : "hover:ring-blue-200")}>
        <CardContent className="pt-4 pb-3 space-y-2">
          {/* Header: icon + count + title */}
          <div className="flex items-center gap-3">
            <div className={cn("flex size-10 items-center justify-center rounded-xl shrink-0", bg)}>
              <Icon className={cn("size-5", color)} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-2xl font-bold text-foreground">{count}</div>
              <div className="text-xs text-muted-foreground">{title}</div>
            </div>
          </div>

          {/* Mini list of items */}
          {items && items.length > 0 && (
            <div className="border-t pt-2 space-y-1.5">
              {items.slice(0, 3).map((item) => (
                <div key={item.id} className="text-xs">
                  <div className="flex items-start justify-between gap-1">
                    <div className="font-medium truncate flex-1">{item.primary}</div>
                    {item.badge && (
                      <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full whitespace-nowrap", item.badgeColor ?? "bg-gray-100")}>
                        {item.badge}
                      </span>
                    )}
                  </div>
                  {item.secondary && (
                    <div className="text-[11px] text-muted-foreground truncate">{item.secondary}</div>
                  )}
                </div>
              ))}
              {items.length > 3 && (
                <div className="flex items-center justify-end text-[11px] text-blue-600 font-medium pt-1">
                  ดูทั้งหมด ({items.length}) <ChevronRight className="size-3" />
                </div>
              )}
            </div>
          )}

          {(!items || items.length === 0) && count > 0 && (
            <div className="border-t pt-2 flex items-center justify-end text-[11px] text-blue-600 font-medium">
              ดูรายการ <ChevronRight className="size-3" />
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

export default function ProjectStaffDashboardPage() {
  const [data, setData] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      // Pending Review jobs
      const { data: pendingJobs, count: pendingJobsCount } = await supabase
        .from("skc_jobs")
        .select("id, title, status, employer:skc_users!skc_jobs_employer_id_fkey(name)", { count: "exact" })
        .eq("status", "PENDING_REVIEW")
        .order("created_at", { ascending: false })
        .limit(10);

      // Pending assignment requests
      const { data: pendingAssignments, count: pendingAssignmentsCount } = await supabase
        .from("skc_job_assignment_requests")
        .select(`
          id, status, created_at,
          job:skc_jobs(title),
          student:skc_users!skc_job_assignment_requests_student_id_fkey(name)
        `, { count: "exact" })
        .eq("status", "PENDING")
        .order("created_at", { ascending: false })
        .limit(10);

      // Disputes
      const { data: disputes, count: disputesCount } = await supabase
        .from("skc_disputes")
        .select("id, status, description, created_at, job:skc_jobs(title)", { count: "exact" })
        .in("status", ["RAISED", "UNDER_REVIEW", "MEDIATION"])
        .order("created_at", { ascending: false })
        .limit(10);

      // Cancellation requests
      const { data: cancellations, count: cancellationsCount } = await supabase
        .from("skc_job_cancellation_requests")
        .select("id, status, reason, job:skc_jobs(title)", { count: "exact" })
        .eq("status", "PENDING")
        .order("created_at", { ascending: false })
        .limit(10);

      // Active jobs (working)
      const { data: activeJobs, count: activeJobsCount } = await supabase
        .from("skc_jobs")
        .select("id, title, status, student:skc_users!skc_jobs_student_id_fkey(name), employer:skc_users!skc_jobs_employer_id_fkey(name)", { count: "exact" })
        .in("status", ["ASSIGNED", "IN_PROGRESS", "SUBMITTED"])
        .order("updated_at", { ascending: false })
        .limit(10);

      // All jobs total
      const { count: totalJobs } = await supabase
        .from("skc_jobs")
        .select("*", { count: "exact", head: true });

      const { data: allJobs } = await supabase
        .from("skc_jobs")
        .select("id, title, status, employer:skc_users!skc_jobs_employer_id_fkey(name)")
        .order("updated_at", { ascending: false })
        .limit(10);

      // Students
      const { data: students, count: studentsCount } = await supabase
        .from("skc_users")
        .select("id, name, email, faculty, campus, approval_status", { count: "exact" })
        .eq("role", "student")
        .order("created_at", { ascending: false })
        .limit(10);

      // Credentials
      const { data: credentials, count: credentialsCount } = await supabase
        .from("skc_student_credentials")
        .select("id, credential_level, issued_at, student:skc_users!skc_student_credentials_student_id_fkey(name)", { count: "exact" })
        .eq("is_active", true)
        .order("issued_at", { ascending: false })
        .limit(10);

      // Training courses
      const { data: courses, count: coursesCount } = await supabase
        .from("skc_training_courses")
        .select("id, title, status", { count: "exact" })
        .in("status", ["OPEN_ENROLLMENT", "IN_PROGRESS"])
        .order("created_at", { ascending: false })
        .limit(10);

      setData({
        pendingJobs: pendingJobs ?? [],
        pendingJobsCount: pendingJobsCount ?? 0,
        pendingAssignments: pendingAssignments ?? [],
        pendingAssignmentsCount: pendingAssignmentsCount ?? 0,
        disputes: disputes ?? [],
        disputesCount: disputesCount ?? 0,
        cancellations: cancellations ?? [],
        cancellationsCount: cancellationsCount ?? 0,
        activeJobs: activeJobs ?? [],
        activeJobsCount: activeJobsCount ?? 0,
        totalJobs: totalJobs ?? 0,
        allJobs: allJobs ?? [],
        students: students ?? [],
        studentsCount: studentsCount ?? 0,
        credentials: credentials ?? [],
        credentialsCount: credentialsCount ?? 0,
        courses: courses ?? [],
        coursesCount: coursesCount ?? 0,
      });
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin size-8 border-4 border-purple-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {/* 1. งานรอพิจารณา */}
        <DashCard
          title="งานรอพิจารณา"
          count={data.pendingJobsCount}
          icon={ClipboardCheck}
          color="text-orange-600"
          bg="bg-orange-100"
          href="/project-staff/review-jobs"
          urgent={data.pendingJobsCount > 0}
          items={data.pendingJobs.map((j: any) => ({
            id: j.id,
            primary: j.title,
            secondary: `ผู้จ้าง: ${j.employer?.name ?? "-"}`,
            badge: STATUS_LABELS[j.status]?.label,
            badgeColor: STATUS_LABELS[j.status]?.color,
          }))}
        />

        {/* 2. คำขอรับงานรอ */}
        <DashCard
          title="คำขอรับงานรอ"
          count={data.pendingAssignmentsCount}
          icon={UserCheck}
          color="text-blue-600"
          bg="bg-blue-100"
          href="/project-staff/approvals"
          urgent={data.pendingAssignmentsCount > 0}
          items={data.pendingAssignments.map((a: any) => ({
            id: a.id,
            primary: a.student?.name ?? "-",
            secondary: `งาน: ${a.job?.title ?? "-"}`,
            badge: "รอ",
            badgeColor: "bg-blue-100 text-blue-800",
          }))}
        />

        {/* 3. ข้อพิพาท */}
        <DashCard
          title="ข้อพิพาทรอ"
          count={data.disputesCount}
          icon={AlertTriangle}
          color="text-red-600"
          bg="bg-red-100"
          href="/project-staff/disputes"
          urgent={data.disputesCount > 0}
          items={data.disputes.map((d: any) => ({
            id: d.id,
            primary: d.job?.title ?? "-",
            secondary: d.description?.slice(0, 60),
            badge: d.status,
            badgeColor: "bg-red-100 text-red-800",
          }))}
        />

        {/* 4. ขอยกเลิก */}
        <DashCard
          title="ขอยกเลิกงาน"
          count={data.cancellationsCount}
          icon={FileCheck}
          color="text-yellow-600"
          bg="bg-yellow-100"
          href="/project-staff/cancellations"
          urgent={data.cancellationsCount > 0}
          items={data.cancellations.map((c: any) => ({
            id: c.id,
            primary: c.job?.title ?? "-",
            secondary: c.reason?.slice(0, 60),
            badge: "รอ",
            badgeColor: "bg-yellow-100 text-yellow-800",
          }))}
        />

        {/* 5. งานกำลังทำ */}
        <DashCard
          title="งานกำลังทำ"
          count={data.activeJobsCount}
          icon={Briefcase}
          color="text-green-600"
          bg="bg-green-100"
          href="/project-staff/active-jobs"
          items={data.activeJobs.map((j: any) => ({
            id: j.id,
            primary: j.title,
            secondary: `${j.student?.name ?? "-"} • ${j.employer?.name ?? "-"}`,
            badge: STATUS_LABELS[j.status]?.label,
            badgeColor: STATUS_LABELS[j.status]?.color,
          }))}
        />

        {/* 6. งานทั้งหมด */}
        <DashCard
          title="งานทั้งหมด"
          count={data.totalJobs}
          icon={Briefcase}
          color="text-cyan-600"
          bg="bg-cyan-100"
          href="/project-staff/active-jobs"
          items={data.allJobs.map((j: any) => ({
            id: j.id,
            primary: j.title,
            secondary: `ผู้จ้าง: ${j.employer?.name ?? "-"}`,
            badge: STATUS_LABELS[j.status]?.label,
            badgeColor: STATUS_LABELS[j.status]?.color,
          }))}
        />

        {/* 7. นักศึกษา */}
        <DashCard
          title="นักศึกษาในระบบ"
          count={data.studentsCount}
          icon={Users}
          color="text-purple-600"
          bg="bg-purple-100"
          href="/project-staff/students"
          items={data.students.map((s: any) => ({
            id: s.id,
            primary: s.name,
            secondary: `${s.faculty ?? ""} • ${s.campus ?? ""}`.trim().replace(/^•/, ""),
            badge: s.approval_status === "APPROVED" ? "Approved" : s.approval_status,
            badgeColor: s.approval_status === "APPROVED" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800",
          }))}
        />

        {/* 8. Credentials */}
        <DashCard
          title="Credentials"
          count={data.credentialsCount}
          icon={Award}
          color="text-amber-600"
          bg="bg-amber-100"
          href="/project-staff/credentials"
          items={data.credentials.map((c: any) => ({
            id: c.id,
            primary: c.student?.name ?? "-",
            secondary: c.issued_at ? new Date(c.issued_at).toLocaleDateString("th-TH") : "",
            badge: c.credential_level,
            badgeColor: "bg-amber-100 text-amber-800",
          }))}
        />

        {/* 9. หลักสูตรอบรม */}
        <DashCard
          title="หลักสูตรอบรม"
          count={data.coursesCount}
          icon={GraduationCap}
          color="text-indigo-600"
          bg="bg-indigo-100"
          href="/training"
          items={data.courses.map((c: any) => ({
            id: c.id,
            primary: c.title,
            badge: c.status,
            badgeColor: "bg-indigo-100 text-indigo-800",
          }))}
        />
      </div>
    </div>
  );
}
