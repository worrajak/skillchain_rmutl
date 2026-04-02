"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  Briefcase,
  CheckCircle,
  Clock,
  Star,
  Award,
  Shield,
  GraduationCap,
  Crown,
  UserCheck,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";

const CREDENTIAL_CONFIG: Record<string, { num: number; name: string; color: string; gradient: string; icon: typeof Award }> = {
  LEVEL_1: { num: 1, name: "ลงทะเบียน", color: "text-gray-600", gradient: "from-gray-400 to-gray-500", icon: UserCheck },
  LEVEL_2: { num: 2, name: "ผ่านฝึกอบรม", color: "text-amber-700", gradient: "from-amber-500 to-orange-600", icon: Shield },
  LEVEL_3: { num: 3, name: "อาจารย์รับรอง", color: "text-blue-700", gradient: "from-blue-500 to-indigo-600", icon: GraduationCap },
  LEVEL_4: { num: 4, name: "สถาบันชาติรับรอง", color: "text-yellow-700", gradient: "from-yellow-400 to-amber-500", icon: Award },
  LEVEL_5: { num: 5, name: "ช่างชำนาญการ", color: "text-purple-700", gradient: "from-purple-500 to-fuchsia-600", icon: Crown },
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  OPEN: { label: "เปิดรับ", color: "bg-green-100 text-green-800" },
  ASSIGNED: { label: "มอบหมาย", color: "bg-blue-100 text-blue-800" },
  IN_PROGRESS: { label: "กำลังทำ", color: "bg-cyan-100 text-cyan-800" },
  SUBMITTED: { label: "ส่งงาน", color: "bg-yellow-100 text-yellow-800" },
  COMPLETED: { label: "เสร็จ", color: "bg-green-100 text-green-800" },
  CANCELLED: { label: "ยกเลิก", color: "bg-gray-100 text-gray-800" },
  DISPUTED: { label: "พิพาท", color: "bg-red-100 text-red-800" },
};

export default function StudentDashboardPage() {
  const [user, setUser] = useState<Record<string, unknown> | null>(null);
  const [credential, setCredential] = useState<string>("LEVEL_1");
  const [myJobs, setMyJobs] = useState<Record<string, unknown>[]>([]);
  const [stats, setStats] = useState({ total: 0, completed: 0, inProgress: 0, avgScore: 0, reviewCount: 0 });
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  useEffect(() => {
    async function load() {
      // Get current user
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) { setLoading(false); return; }

      // Get user profile
      const { data: profile } = await supabase
        .from("users")
        .select("*")
        .eq("id", authUser.id)
        .single();
      setUser(profile);

      // Get credential
      const { data: cred } = await supabase
        .from("student_credentials")
        .select("credential_level")
        .eq("student_id", authUser.id)
        .eq("is_active", true)
        .order("credential_level", { ascending: false })
        .limit(1)
        .single();
      if (cred) setCredential(cred.credential_level);

      // Get my jobs
      const { data: jobs } = await supabase
        .from("jobs")
        .select("id, title, status, type, pay_amount, deadline, created_at")
        .eq("student_id", authUser.id)
        .order("created_at", { ascending: false })
        .limit(5);
      setMyJobs(jobs ?? []);

      // Get stats
      const [
        { count: total },
        { count: completed },
        { count: inProgress },
        { data: ratings },
      ] = await Promise.all([
        supabase.from("jobs").select("*", { count: "exact", head: true }).eq("student_id", authUser.id),
        supabase.from("jobs").select("*", { count: "exact", head: true }).eq("student_id", authUser.id).eq("status", "COMPLETED"),
        supabase.from("jobs").select("*", { count: "exact", head: true }).eq("student_id", authUser.id).eq("status", "IN_PROGRESS"),
        supabase.from("student_rating_summary").select("combined_score, teacher_review_count, employer_review_count, mentor_review_count").eq("student_id", authUser.id).single(),
      ]);

      const reviewCount = (ratings?.teacher_review_count ?? 0) + (ratings?.employer_review_count ?? 0) + (ratings?.mentor_review_count ?? 0);

      setStats({
        total: total ?? 0,
        completed: completed ?? 0,
        inProgress: inProgress ?? 0,
        avgScore: Number(ratings?.combined_score ?? 0),
        reviewCount,
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

  if (!user) {
    return (
      <Card className="max-w-md mx-auto mt-10 text-center">
        <CardContent className="py-10 space-y-4">
          <AlertTriangle className="size-12 mx-auto text-yellow-500" />
          <p className="font-medium text-foreground">กรุณาเข้าสู่ระบบ</p>
          <Link href="/login"><Button>เข้าสู่ระบบ</Button></Link>
        </CardContent>
      </Card>
    );
  }

  const credConfig = CREDENTIAL_CONFIG[credential] ?? CREDENTIAL_CONFIG.LEVEL_1;
  const CredIcon = credConfig.icon;

  const statCards = [
    { label: "งานทั้งหมด", value: stats.total, icon: Briefcase, color: "text-blue-600", bg: "bg-blue-100" },
    { label: "กำลังทำ", value: stats.inProgress, icon: Clock, color: "text-cyan-600", bg: "bg-cyan-100" },
    { label: "สำเร็จ", value: stats.completed, icon: CheckCircle, color: "text-green-600", bg: "bg-green-100" },
    { label: "คะแนนเฉลี่ย", value: stats.avgScore > 0 ? stats.avgScore.toFixed(1) : "-", icon: Star, color: "text-yellow-600", bg: "bg-yellow-100" },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome + Credential */}
      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardContent className="flex items-center gap-4 pt-4 pb-4">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-blue-100 text-blue-700 font-bold text-xl">
              {(user.name as string)?.charAt(0) ?? "?"}
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-foreground">สวัสดี, {user.name as string}</h2>
              <p className="text-sm text-muted-foreground">{user.email as string} — {user.campus as string}</p>
            </div>
          </CardContent>
        </Card>

        {/* Credential Card */}
        <Card className={cn("overflow-hidden text-white bg-gradient-to-br", credConfig.gradient)}>
          <CardContent className="flex items-center gap-3 pt-4 pb-4 relative">
            <div className="absolute inset-0 opacity-10">
              <div className="absolute -right-4 -top-4 size-20 rounded-full border-2 border-white" />
            </div>
            <CredIcon className="size-10 relative" />
            <div className="relative">
              <div className="font-bold text-lg">Level {credConfig.num}</div>
              <div className="text-sm opacity-90">{credConfig.name}</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map((s) => (
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

      {/* Credential Progress */}
      <Card>
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
            <Award className="size-5" />
            เส้นทาง Credential
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-3">
            {Object.entries(CREDENTIAL_CONFIG).map(([level, c]) => {
              const Icon = c.icon;
              const isActive = c.num <= credConfig.num;
              const isCurrent = c.num === credConfig.num;
              return (
                <div key={level} className="flex flex-col items-center gap-1">
                  <div className={cn(
                    "flex size-10 items-center justify-center rounded-full transition-all",
                    isCurrent ? cn("bg-gradient-to-br text-white shadow-lg", c.gradient) :
                    isActive ? "bg-blue-100 text-blue-700" : "bg-muted text-muted-foreground"
                  )}>
                    <Icon className="size-5" />
                  </div>
                  <span className={cn("text-[10px] font-medium", isCurrent ? c.color : "text-muted-foreground")}>
                    Lv.{c.num}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
            <div
              className={cn("h-full rounded-full bg-gradient-to-r transition-all", credConfig.gradient)}
              style={{ width: `${(credConfig.num / 5) * 100}%` }}
            />
          </div>
          {credConfig.num < 5 && (
            <p className="text-xs text-muted-foreground mt-2">
              ถัดไป: Level {credConfig.num + 1} — {CREDENTIAL_CONFIG[`LEVEL_${credConfig.num + 1}`]?.name}
            </p>
          )}
        </CardContent>
      </Card>

      {/* My Jobs */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-foreground flex items-center gap-2">
              <Briefcase className="size-5" />
              งานของฉัน
            </CardTitle>
            <Link href="/student/jobs">
              <Button variant="outline" size="sm">ดูทั้งหมด <ArrowRight className="size-4 ml-1" /></Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {myJobs.length > 0 ? (
            <div className="space-y-3">
              {myJobs.map((job) => (
                <div key={job.id as string} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <div className="font-medium text-sm text-foreground">{job.title as string}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {job.type as string} — กำหนดส่ง {new Date(job.deadline as string).toLocaleDateString("th-TH")}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={cn(
                      "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                      STATUS_LABELS[job.status as string]?.color ?? "bg-gray-100"
                    )}>
                      {STATUS_LABELS[job.status as string]?.label ?? job.status}
                    </span>
                    {(job.pay_amount as number) > 0 && (
                      <div className="text-xs text-green-700 font-medium mt-0.5">
                        {(job.pay_amount as number).toLocaleString()} TRPB
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Briefcase className="size-10 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">ยังไม่มีงาน</p>
              <Link href="/student/jobs">
                <Button variant="outline" size="sm" className="mt-3">ค้นหางาน</Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
