"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { UserCheck, AlertTriangle, FileCheck, Briefcase, Users, Award, ClipboardCheck, GraduationCap } from "lucide-react";

export default function ProjectStaffDashboardPage() {
  const [stats, setStats] = useState({ pendingReviews: 0, pendingAssignments: 0, pendingDisputes: 0, pendingCancellations: 0, activeJobs: 0, totalStudents: 0, totalCredentials: 0, trainingCourses: 0 });
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const [
        { count: pr }, { count: pa }, { count: pd }, { count: pc },
        { count: aj }, { count: ts }, { count: tc }, { count: trn },
      ] = await Promise.all([
        supabase.from("skc_jobs").select("*", { count: "exact", head: true }).eq("status", "PENDING_REVIEW"),
        supabase.from("skc_job_assignment_requests").select("*", { count: "exact", head: true }).eq("status", "PENDING"),
        supabase.from("skc_disputes").select("*", { count: "exact", head: true }).in("status", ["RAISED", "UNDER_REVIEW", "MEDIATION"]),
        supabase.from("skc_job_cancellation_requests").select("*", { count: "exact", head: true }).eq("status", "PENDING"),
        supabase.from("skc_jobs").select("*", { count: "exact", head: true }).in("status", ["ASSIGNED", "IN_PROGRESS"]),
        supabase.from("skc_users").select("*", { count: "exact", head: true }).eq("role", "student"),
        supabase.from("skc_student_credentials").select("*", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("skc_training_courses").select("*", { count: "exact", head: true }).in("status", ["OPEN_ENROLLMENT", "IN_PROGRESS"]),
      ]);
      setStats({
        pendingReviews: pr ?? 0, pendingAssignments: pa ?? 0, pendingDisputes: pd ?? 0, pendingCancellations: pc ?? 0,
        activeJobs: aj ?? 0, totalStudents: ts ?? 0, totalCredentials: tc ?? 0, trainingCourses: trn ?? 0,
      });
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
    { label: "งานกำลังทำ", value: stats.activeJobs, icon: Briefcase, color: "text-green-600", bg: "bg-green-100", href: "#", urgent: false },
    { label: "นักศึกษาในระบบ", value: stats.totalStudents, icon: Users, color: "text-purple-600", bg: "bg-purple-100", href: "#", urgent: false },
    { label: "Credentials", value: stats.totalCredentials, icon: Award, color: "text-amber-600", bg: "bg-amber-100", href: "#", urgent: false },
    { label: "หลักสูตรอบรม", value: stats.trainingCourses, icon: GraduationCap, color: "text-indigo-600", bg: "bg-indigo-100", href: "/training", urgent: false },
  ];

  return (
    <div className="space-y-6">
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
    </div>
  );
}
