"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Users,
  Briefcase,
  CheckCircle,
  Clock,
  Award,
  Star,
  AlertTriangle,
  TrendingUp,
} from "lucide-react";

interface Stats {
  totalUsers: number;
  students: number;
  employers: number;
  teachers: number;
  donors: number;
  totalJobs: number;
  openJobs: number;
  completedJobs: number;
  inProgressJobs: number;
  disputedJobs: number;
  totalEvaluations: number;
  totalEmployerReviews: number;
  totalStudentReviews: number;
  totalMentorReviews: number;
  totalCredentials: number;
  recentUsers: { id: string; name: string; email: string; role: string; created_at: string }[];
  recentJobs: { id: string; title: string; status: string; type: string; created_at: string }[];
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const [
        { count: totalUsers },
        { count: students },
        { count: employers },
        { count: teachers },
        { count: donors },
        { count: totalJobs },
        { count: openJobs },
        { count: completedJobs },
        { count: inProgressJobs },
        { count: disputedJobs },
        { count: totalEvaluations },
        { count: totalEmployerReviews },
        { count: totalStudentReviews },
        { count: totalMentorReviews },
        { count: totalCredentials },
        { data: recentUsers },
        { data: recentJobs },
      ] = await Promise.all([
        supabase.from("users").select("*", { count: "exact", head: true }),
        supabase.from("users").select("*", { count: "exact", head: true }).eq("role", "student"),
        supabase.from("users").select("*", { count: "exact", head: true }).eq("role", "employer"),
        supabase.from("users").select("*", { count: "exact", head: true }).eq("role", "teacher"),
        supabase.from("users").select("*", { count: "exact", head: true }).eq("role", "donor"),
        supabase.from("jobs").select("*", { count: "exact", head: true }),
        supabase.from("jobs").select("*", { count: "exact", head: true }).eq("status", "OPEN"),
        supabase.from("jobs").select("*", { count: "exact", head: true }).eq("status", "COMPLETED"),
        supabase.from("jobs").select("*", { count: "exact", head: true }).eq("status", "IN_PROGRESS"),
        supabase.from("jobs").select("*", { count: "exact", head: true }).eq("status", "DISPUTED"),
        supabase.from("evaluations").select("*", { count: "exact", head: true }),
        supabase.from("employer_reviews").select("*", { count: "exact", head: true }),
        supabase.from("student_reviews").select("*", { count: "exact", head: true }),
        supabase.from("mentor_reviews").select("*", { count: "exact", head: true }),
        supabase.from("student_credentials").select("*", { count: "exact", head: true }),
        supabase.from("users").select("id, name, email, role, created_at").order("created_at", { ascending: false }).limit(5),
        supabase.from("jobs").select("id, title, status, type, created_at").order("created_at", { ascending: false }).limit(5),
      ]);

      setStats({
        totalUsers: totalUsers ?? 0,
        students: students ?? 0,
        employers: employers ?? 0,
        teachers: teachers ?? 0,
        donors: donors ?? 0,
        totalJobs: totalJobs ?? 0,
        openJobs: openJobs ?? 0,
        completedJobs: completedJobs ?? 0,
        inProgressJobs: inProgressJobs ?? 0,
        disputedJobs: disputedJobs ?? 0,
        totalEvaluations: totalEvaluations ?? 0,
        totalEmployerReviews: totalEmployerReviews ?? 0,
        totalStudentReviews: totalStudentReviews ?? 0,
        totalMentorReviews: totalMentorReviews ?? 0,
        totalCredentials: totalCredentials ?? 0,
        recentUsers: recentUsers ?? [],
        recentJobs: recentJobs ?? [],
      });
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin size-8 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!stats) return null;

  const statCards = [
    { label: "ผู้ใช้ทั้งหมด", value: stats.totalUsers, icon: Users, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "นักศึกษา", value: stats.students, icon: Users, color: "text-green-600", bg: "bg-green-50" },
    { label: "ผู้ว่าจ้าง", value: stats.employers, icon: Users, color: "text-purple-600", bg: "bg-purple-50" },
    { label: "อาจารย์", value: stats.teachers, icon: Users, color: "text-orange-600", bg: "bg-orange-50" },
    { label: "งานทั้งหมด", value: stats.totalJobs, icon: Briefcase, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "งานเปิดรับ", value: stats.openJobs, icon: Clock, color: "text-yellow-600", bg: "bg-yellow-50" },
    { label: "กำลังทำ", value: stats.inProgressJobs, icon: TrendingUp, color: "text-cyan-600", bg: "bg-cyan-50" },
    { label: "งานสำเร็จ", value: stats.completedJobs, icon: CheckCircle, color: "text-green-600", bg: "bg-green-50" },
    { label: "มีข้อพิพาท", value: stats.disputedJobs, icon: AlertTriangle, color: "text-red-600", bg: "bg-red-50" },
    { label: "ประเมินอาจารย์", value: stats.totalEvaluations, icon: Star, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "รีวิวผู้จ้าง→นศ.", value: stats.totalEmployerReviews, icon: Star, color: "text-green-600", bg: "bg-green-50" },
    { label: "Credentials", value: stats.totalCredentials, icon: Award, color: "text-purple-600", bg: "bg-purple-50" },
  ];

  const roleLabels: Record<string, string> = {
    student: "นักศึกษา",
    employer: "ผู้ว่าจ้าง",
    teacher: "อาจารย์",
    donor: "ผู้บริจาค",
    admin: "แอดมิน",
    superadmin: "Super Admin",
  };

  const statusLabels: Record<string, { label: string; color: string }> = {
    OPEN: { label: "เปิดรับ", color: "bg-green-100 text-green-800" },
    ASSIGNED: { label: "มอบหมาย", color: "bg-blue-100 text-blue-800" },
    IN_PROGRESS: { label: "กำลังทำ", color: "bg-cyan-100 text-cyan-800" },
    COMPLETED: { label: "เสร็จ", color: "bg-green-100 text-green-800" },
    CANCELLED: { label: "ยกเลิก", color: "bg-gray-100 text-gray-800" },
    DISPUTED: { label: "พิพาท", color: "bg-red-100 text-red-800" },
  };

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {statCards.map((s) => (
          <Card key={s.label}>
            <CardContent className="flex items-center gap-3 pt-4 pb-4">
              <div className={`flex size-10 items-center justify-center rounded-lg ${s.bg}`}>
                <s.icon className={`size-5 ${s.color}`} />
              </div>
              <div>
                <div className="text-2xl font-bold text-foreground">{s.value}</div>
                <div className="text-xs text-muted-foreground">{s.label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Activity */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent Users */}
        <Card>
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <Users className="size-5" />
              ผู้ใช้ล่าสุด
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.recentUsers.length > 0 ? (
              <div className="space-y-3">
                {stats.recentUsers.map((u) => (
                  <div key={u.id} className="flex items-center justify-between text-sm">
                    <div>
                      <div className="font-medium text-foreground">{u.name}</div>
                      <div className="text-xs text-muted-foreground">{u.email}</div>
                    </div>
                    <div className="text-right">
                      <span className="inline-flex rounded-full bg-blue-100 text-blue-800 px-2 py-0.5 text-xs font-medium">
                        {roleLabels[u.role] ?? u.role}
                      </span>
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        {new Date(u.created_at).toLocaleDateString("th-TH")}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">ยังไม่มีผู้ใช้</p>
            )}
          </CardContent>
        </Card>

        {/* Recent Jobs */}
        <Card>
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <Briefcase className="size-5" />
              งานล่าสุด
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.recentJobs.length > 0 ? (
              <div className="space-y-3">
                {stats.recentJobs.map((j) => (
                  <div key={j.id} className="flex items-center justify-between text-sm">
                    <div>
                      <div className="font-medium text-foreground">{j.title}</div>
                      <div className="text-xs text-muted-foreground">{j.type}</div>
                    </div>
                    <div className="text-right">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusLabels[j.status]?.color ?? "bg-gray-100"}`}>
                        {statusLabels[j.status]?.label ?? j.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">ยังไม่มีงาน</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
