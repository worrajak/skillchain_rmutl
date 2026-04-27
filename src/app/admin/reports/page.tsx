"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  Users, Briefcase, CheckCircle, Star, Award, Clock,
  TrendingUp, AlertTriangle, BarChart3, PieChart,
} from "lucide-react";

interface Report {
  usersByRole: Record<string, number>;
  jobsByStatus: Record<string, number>;
  jobsByType: Record<string, number>;
  credentialsByLevel: Record<string, number>;
  totalReviews: number;
  avgScore: number;
  approvalPending: number;
}

const ROLE_TH: Record<string, string> = {
  student: "นักศึกษา", employer: "ผู้ว่าจ้าง", teacher: "อาจารย์",
  project_staff: "คณะทำงานใต้ร่มฯ", rmutl_staff: "คณะทำงาน มทร.",
  donor: "ผู้บริจาค", admin: "แอดมิน", superadmin: "Super Admin",
};

const STATUS_TH: Record<string, string> = {
  PENDING_REVIEW: "รอพิจารณา", OPEN: "เปิดรับ", ASSIGNED: "มอบหมาย", CONFIRMED: "ยืนยัน", IN_PROGRESS: "กำลังทำ",
  SUBMITTED: "ส่งงาน", COMPLETED: "เสร็จ", CANCELLED: "ยกเลิก", DISPUTED: "พิพาท",
};

const TYPE_TH: Record<string, string> = {
  PAID: "งานจ้าง", VOLUNTEER: "จิตอาสา", TRAINING: "ฝึกทักษะ", EXEMPTED: "ยกเว้นค่าบริการ",
};

const LEVEL_TH: Record<string, string> = {
  LEVEL_1: "Lv.1", LEVEL_2: "Lv.2", LEVEL_3: "Lv.3", LEVEL_4: "Lv.4", LEVEL_5: "Lv.5",
};

function BarRow({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold text-foreground">{value}</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div className={cn("h-full rounded-full", color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function AdminReportsPage() {
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      // ดึงข้อมูลทั้งหมด
      const [{ data: users }, { data: jobs }, { data: creds }, { count: reviews }, { count: pending }] = await Promise.all([
        supabase.from("skc_users").select("role"),
        supabase.from("skc_jobs").select("status, type"),
        supabase.from("skc_student_credentials").select("credential_level").eq("is_active", true),
        supabase.from("skc_evaluations").select("*", { count: "exact", head: true }),
        supabase.from("skc_users").select("*", { count: "exact", head: true }).eq("approval_status", "PENDING"),
      ]);

      // นับตาม group
      const usersByRole: Record<string, number> = {};
      (users ?? []).forEach((u) => { usersByRole[u.role] = (usersByRole[u.role] ?? 0) + 1; });

      const jobsByStatus: Record<string, number> = {};
      const jobsByType: Record<string, number> = {};
      (jobs ?? []).forEach((j) => {
        jobsByStatus[j.status] = (jobsByStatus[j.status] ?? 0) + 1;
        jobsByType[j.type] = (jobsByType[j.type] ?? 0) + 1;
      });

      const credentialsByLevel: Record<string, number> = {};
      (creds ?? []).forEach((c) => {
        credentialsByLevel[c.credential_level] = (credentialsByLevel[c.credential_level] ?? 0) + 1;
      });

      setReport({
        usersByRole,
        jobsByStatus,
        jobsByType,
        credentialsByLevel,
        totalReviews: reviews ?? 0,
        avgScore: 0,
        approvalPending: pending ?? 0,
      });
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin size-8 border-4 border-blue-500 border-t-transparent rounded-full" /></div>;
  if (!report) return null;

  const totalUsers = Object.values(report.usersByRole).reduce((a, b) => a + b, 0);
  const totalJobs = Object.values(report.jobsByStatus).reduce((a, b) => a + b, 0);
  const totalCreds = Object.values(report.credentialsByLevel).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "ผู้ใช้ทั้งหมด", value: totalUsers, icon: Users, color: "text-blue-600", bg: "bg-blue-100" },
          { label: "งานทั้งหมด", value: totalJobs, icon: Briefcase, color: "text-green-600", bg: "bg-green-100" },
          { label: "Credentials", value: totalCreds, icon: Award, color: "text-purple-600", bg: "bg-purple-100" },
          { label: "รอยืนยัน", value: report.approvalPending, icon: Clock, color: "text-yellow-600", bg: "bg-yellow-100" },
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

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Users by Role */}
        <Card>
          <CardHeader><CardTitle className="text-foreground flex items-center gap-2"><Users className="size-5" />ผู้ใช้ตาม Role</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(report.usersByRole).sort(([, a], [, b]) => b - a).map(([role, count]) => (
              <BarRow key={role} label={ROLE_TH[role] ?? role} value={count} max={totalUsers} color="bg-blue-500" />
            ))}
            {Object.keys(report.usersByRole).length === 0 && <p className="text-center text-muted-foreground py-4">ไม่มีข้อมูล</p>}
          </CardContent>
        </Card>

        {/* Jobs by Status */}
        <Card>
          <CardHeader><CardTitle className="text-foreground flex items-center gap-2"><BarChart3 className="size-5" />งานตามสถานะ</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(report.jobsByStatus).sort(([, a], [, b]) => b - a).map(([status, count]) => (
              <BarRow key={status} label={STATUS_TH[status] ?? status} value={count} max={totalJobs}
                color={status === "COMPLETED" ? "bg-green-500" : status === "DISPUTED" ? "bg-red-500" : "bg-cyan-500"} />
            ))}
            {Object.keys(report.jobsByStatus).length === 0 && <p className="text-center text-muted-foreground py-4">ไม่มีข้อมูล</p>}
          </CardContent>
        </Card>

        {/* Jobs by Type */}
        <Card>
          <CardHeader><CardTitle className="text-foreground flex items-center gap-2"><PieChart className="size-5" />งานตามประเภท</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(report.jobsByType).sort(([, a], [, b]) => b - a).map(([type, count]) => (
              <BarRow key={type} label={TYPE_TH[type] ?? type} value={count} max={totalJobs} color="bg-green-500" />
            ))}
            {Object.keys(report.jobsByType).length === 0 && <p className="text-center text-muted-foreground py-4">ไม่มีข้อมูล</p>}
          </CardContent>
        </Card>

        {/* Credentials by Level */}
        <Card>
          <CardHeader><CardTitle className="text-foreground flex items-center gap-2"><Award className="size-5" />Credential ตามระดับ</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {["LEVEL_1", "LEVEL_2", "LEVEL_3", "LEVEL_4", "LEVEL_5"].map((lv) => (
              <BarRow key={lv} label={LEVEL_TH[lv]} value={report.credentialsByLevel[lv] ?? 0} max={Math.max(totalCreds, 1)}
                color={lv === "LEVEL_5" ? "bg-purple-500" : lv === "LEVEL_4" ? "bg-yellow-500" : lv === "LEVEL_3" ? "bg-blue-500" : lv === "LEVEL_2" ? "bg-amber-500" : "bg-gray-400"} />
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
