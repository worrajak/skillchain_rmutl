"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
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
  UserCheck,
  Shield,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

const ROLE_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  student: { label: "นักศึกษา", color: "text-blue-600", bg: "bg-blue-100" },
  employer: { label: "ผู้ว่าจ้าง", color: "text-green-600", bg: "bg-green-100" },
  teacher: { label: "อาจารย์", color: "text-orange-600", bg: "bg-orange-100" },
  project_staff: { label: "คณะทำงานใต้ร่มฯ", color: "text-purple-600", bg: "bg-purple-100" },
  rmutl_staff: { label: "คณะทำงาน มทร.", color: "text-indigo-600", bg: "bg-indigo-100" },
  donor: { label: "ผู้บริจาค", color: "text-yellow-600", bg: "bg-yellow-100" },
  admin: { label: "แอดมิน", color: "text-red-600", bg: "bg-red-100" },
  superadmin: { label: "Super Admin", color: "text-red-600", bg: "bg-red-100" },
};

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

export default function AdminDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [roleCounts, setRoleCounts] = useState<Record<string, number>>({});
  const [jobStatusCounts, setJobStatusCounts] = useState<Record<string, number>>({});
  const [pendingApprovals, setPendingApprovals] = useState(0);
  const [totalEvals, setTotalEvals] = useState(0);
  const [totalCreds, setTotalCreds] = useState(0);
  const [recentUsers, setRecentUsers] = useState<Record<string, unknown>[]>([]);
  const [recentJobs, setRecentJobs] = useState<Record<string, unknown>[]>([]);

  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const [
        { data: allUsers },
        { data: allJobs },
        { count: pending },
        { count: evals },
        { count: creds },
        { data: rUsers },
        { data: rJobs },
      ] = await Promise.all([
        supabase.from("users").select("role"),
        supabase.from("jobs").select("status"),
        supabase.from("users").select("*", { count: "exact", head: true }).eq("approval_status", "PENDING"),
        supabase.from("evaluations").select("*", { count: "exact", head: true }),
        supabase.from("student_credentials").select("*", { count: "exact", head: true }),
        supabase.from("users").select("id, name, email, role, approval_status, created_at").order("created_at", { ascending: false }).limit(8),
        supabase.from("jobs").select("id, title, status, type, created_at").order("created_at", { ascending: false }).limit(5),
      ]);

      // นับ role
      const rc: Record<string, number> = {};
      (allUsers ?? []).forEach((u) => { rc[u.role] = (rc[u.role] ?? 0) + 1; });
      setRoleCounts(rc);

      // นับ job status
      const jc: Record<string, number> = {};
      (allJobs ?? []).forEach((j) => { jc[j.status] = (jc[j.status] ?? 0) + 1; });
      setJobStatusCounts(jc);

      setPendingApprovals(pending ?? 0);
      setTotalEvals(evals ?? 0);
      setTotalCreds(creds ?? 0);
      setRecentUsers(rUsers ?? []);
      setRecentJobs(rJobs ?? []);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center py-20"><div className="animate-spin size-8 border-4 border-blue-500 border-t-transparent rounded-full" /></div>;
  }

  const totalUsers = Object.values(roleCounts).reduce((a, b) => a + b, 0);
  const totalJobs = Object.values(jobStatusCounts).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6">
      {/* Pending Alert */}
      {pendingApprovals > 0 && (
        <Link href="/admin/approvals">
          <Card className="border-yellow-300 bg-yellow-50 hover:bg-yellow-100 transition-colors cursor-pointer">
            <CardContent className="flex items-center gap-3 pt-4 pb-4">
              <UserCheck className="size-6 text-yellow-600" />
              <div>
                <span className="font-bold text-yellow-800">{pendingApprovals} คน</span>
                <span className="text-yellow-700 ml-1">รอยืนยัน</span>
              </div>
              <Button size="sm" className="ml-auto">ไปยืนยัน</Button>
            </CardContent>
          </Card>
        </Link>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="flex items-center gap-3 pt-4 pb-4">
            <div className="flex size-10 items-center justify-center rounded-xl bg-blue-100"><Users className="size-5 text-blue-600" /></div>
            <div><div className="text-2xl font-bold text-foreground">{totalUsers}</div><div className="text-xs text-muted-foreground">ผู้ใช้ทั้งหมด</div></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-4 pb-4">
            <div className="flex size-10 items-center justify-center rounded-xl bg-green-100"><Briefcase className="size-5 text-green-600" /></div>
            <div><div className="text-2xl font-bold text-foreground">{totalJobs}</div><div className="text-xs text-muted-foreground">งานทั้งหมด</div></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-4 pb-4">
            <div className="flex size-10 items-center justify-center rounded-xl bg-purple-100"><Star className="size-5 text-purple-600" /></div>
            <div><div className="text-2xl font-bold text-foreground">{totalEvals}</div><div className="text-xs text-muted-foreground">การประเมิน</div></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-4 pb-4">
            <div className="flex size-10 items-center justify-center rounded-xl bg-amber-100"><Award className="size-5 text-amber-600" /></div>
            <div><div className="text-2xl font-bold text-foreground">{totalCreds}</div><div className="text-xs text-muted-foreground">ใบรับรอง</div></div>
          </CardContent>
        </Card>
      </div>

      {/* Users by Role */}
      <Card>
        <CardHeader><CardTitle className="text-foreground flex items-center gap-2"><Users className="size-5" />ผู้ใช้ตาม Role</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(ROLE_LABELS).map(([role, cfg]) => (
              <div key={role} className="flex items-center gap-3 rounded-lg border p-3">
                <div className={cn("flex size-8 items-center justify-center rounded-lg", cfg.bg)}>
                  {role.includes("admin") ? <Shield className={cn("size-4", cfg.color)} /> : <Users className={cn("size-4", cfg.color)} />}
                </div>
                <div>
                  <div className="text-lg font-bold text-foreground">{roleCounts[role] ?? 0}</div>
                  <div className="text-[11px] text-muted-foreground">{cfg.label}</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Jobs by Status */}
      {totalJobs > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-foreground flex items-center gap-2"><Briefcase className="size-5" />งานตามสถานะ</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Object.entries(STATUS_LABELS).map(([status, cfg]) => (
                (jobStatusCounts[status] ?? 0) > 0 && (
                  <div key={status} className="flex items-center gap-2 rounded-lg border p-3">
                    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium", cfg.color)}>{cfg.label}</span>
                    <span className="text-lg font-bold text-foreground ml-auto">{jobStatusCounts[status]}</span>
                  </div>
                )
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Activity */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-foreground flex items-center gap-2"><Users className="size-5" />ผู้ใช้ล่าสุด</CardTitle></CardHeader>
          <CardContent>
            {recentUsers.length > 0 ? (
              <div className="space-y-3">
                {recentUsers.map((u) => (
                  <div key={String(u.id)} className="flex items-center justify-between text-sm">
                    <div>
                      <div className="font-medium text-foreground">{String(u.name)}</div>
                      <div className="text-xs text-muted-foreground">{String(u.email)}</div>
                    </div>
                    <div className="text-right flex items-center gap-2">
                      <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium", ROLE_LABELS[String(u.role)]?.bg ?? "bg-gray-100", ROLE_LABELS[String(u.role)]?.color ?? "")}>
                        {ROLE_LABELS[String(u.role)]?.label ?? u.role}
                      </span>
                      {String(u.approval_status) === "PENDING" && (
                        <span className="inline-flex rounded-full bg-yellow-100 text-yellow-800 px-2 py-0.5 text-[10px] font-medium">รอ</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">ยังไม่มีผู้ใช้</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-foreground flex items-center gap-2"><Briefcase className="size-5" />งานล่าสุด</CardTitle></CardHeader>
          <CardContent>
            {recentJobs.length > 0 ? (
              <div className="space-y-3">
                {recentJobs.map((j) => (
                  <div key={String(j.id)} className="flex items-center justify-between text-sm">
                    <div>
                      <div className="font-medium text-foreground">{String(j.title)}</div>
                      <div className="text-xs text-muted-foreground">{String(j.type)}</div>
                    </div>
                    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium", STATUS_LABELS[String(j.status)]?.color ?? "bg-gray-100")}>
                      {STATUS_LABELS[String(j.status)]?.label ?? j.status}
                    </span>
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
