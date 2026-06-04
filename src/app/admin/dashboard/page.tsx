"use client";

/**
 * Admin Dashboard — 3-tier pyramid framework
 *
 *   Tier 1 (Hero, 5-sec scan):
 *     4 KPIs — "ต้องการคุณ" · "งานเสร็จเดือนนี้" · "TRPB หมุนเวียน" · "Active 7 วัน"
 *     ทุกตัวมี Δ vs ช่วงก่อน · สี = signal (แดง/เหลือง/เขียว)
 *
 *   Tier 2 (Trend + breakdown):
 *     • Sparkline งานเสร็จ 7 วัน
 *     • Stuck breakdown — รอ approve / รอตรวจ / รอจ่าย / unsupervised
 *     • Role distribution (mini bar)
 *
 *   Tier 3 (Drill-down, collapsible accordion):
 *     ผู้ใช้ล่าสุด · งานล่าสุด · ลิงก์ไปหน้าเต็ม
 *
 *   Top insight line — 1 ประโยคบอกสถานะระบบโดยรวม
 */

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  AlertCircle, CheckCircle2, TrendingUp, TrendingDown, Minus,
  ChevronDown, ChevronUp, Users, Briefcase, Coins, Activity,
  UserCheck, ArrowRight,
} from "lucide-react";

interface Counts {
  users: number;
  jobs: number;
  completedThisMonth: number;
  completedLastMonth: number;
  newUsersThisMonth: number;
  newUsersLastMonth: number;
  trpbThisMonth: number;
  trpbLastMonth: number;
  pendingReview: number;
  pendingApps: number;
  awaitingConfirm: number;
  unpaidEscrow: number;
  unsupervised: number;
  pendingUsers: number;
  openDisputes: number;
  activeLast7Days: number;
  rolesCount: Record<string, number>;
  completedByDay: number[]; // last 7 days, oldest first
}

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  student: { label: "นักศึกษา", color: "bg-blue-500" },
  employer: { label: "ผู้ว่าจ้าง", color: "bg-emerald-500" },
  teacher: { label: "อาจารย์", color: "bg-orange-500" },
  project_staff: { label: "ใต้ร่มฯ", color: "bg-purple-500" },
  rmutl_staff: { label: "มทร.", color: "bg-indigo-500" },
  donor: { label: "ผู้บริจาค", color: "bg-yellow-500" },
  admin: { label: "Admin", color: "bg-rose-500" },
  superadmin: { label: "SuperAdmin", color: "bg-red-500" },
};

export default function AdminDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [c, setC] = useState<Counts | null>(null);
  const [drill, setDrill] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [recentUsers, setRecentUsers] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [recentJobs, setRecentJobs] = useState<any[]>([]);

  useEffect(() => {
    const supabase = createClient();

    async function load() {
      const now = new Date();
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
      const lastMonthEnd = thisMonthStart;
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 3600 * 1000).toISOString();

      const [
        usersRes,
        jobsRes,
        completedNow,
        completedPrev,
        newUsersNow,
        newUsersPrev,
        trpbNow,
        trpbPrev,
        pendingReview,
        pendingApps,
        submittedCount,
        unpaidEscrow,
        unsupervised,
        pendingUsers,
        openDisputes,
        active7d,
        last7daysJobs,
        rUsers,
        rJobs,
      ] = await Promise.all([
        supabase.from("skc_users").select("role"),
        supabase.from("skc_jobs").select("id", { count: "exact", head: true }),
        supabase.from("skc_jobs").select("id", { count: "exact", head: true })
          .in("status", ["COMPLETED", "CLOSED"]).gte("updated_at", thisMonthStart),
        supabase.from("skc_jobs").select("id", { count: "exact", head: true })
          .in("status", ["COMPLETED", "CLOSED"]).gte("updated_at", lastMonthStart).lt("updated_at", lastMonthEnd),
        supabase.from("skc_users").select("id", { count: "exact", head: true }).gte("created_at", thisMonthStart),
        supabase.from("skc_users").select("id", { count: "exact", head: true })
          .gte("created_at", lastMonthStart).lt("created_at", lastMonthEnd),
        supabase.from("skc_trpb_transactions").select("amount").eq("kind", "RELEASE").gte("created_at", thisMonthStart),
        supabase.from("skc_trpb_transactions").select("amount").eq("kind", "RELEASE")
          .gte("created_at", lastMonthStart).lt("created_at", lastMonthEnd),
        supabase.from("skc_jobs").select("id", { count: "exact", head: true }).eq("status", "PENDING_REVIEW"),
        supabase.from("skc_job_assignment_requests").select("id", { count: "exact", head: true }).eq("status", "PENDING"),
        supabase.from("skc_jobs").select("id", { count: "exact", head: true }).eq("status", "SUBMITTED"),
        supabase.from("skc_jobs").select("id", { count: "exact", head: true })
          .eq("status", "COMPLETED").eq("type", "PAID").is("escrow_tx", null).gt("pay_amount", 0),
        supabase.from("skc_jobs").select("id", { count: "exact", head: true })
          .in("status", ["OPEN", "ASSIGNED", "CONFIRMED", "IN_PROGRESS"]).is("approved_by_staff", null),
        supabase.from("skc_users").select("id", { count: "exact", head: true }).eq("approval_status", "PENDING"),
        supabase.from("skc_disputes").select("id", { count: "exact", head: true }).eq("status", "OPEN"),
        supabase.from("skc_jobs").select("employer_id, student_id, updated_at").gte("updated_at", sevenDaysAgo),
        supabase.from("skc_jobs").select("updated_at")
          .in("status", ["COMPLETED", "CLOSED"])
          .gte("updated_at", sevenDaysAgo),
        supabase.from("skc_users").select("id, name, email, role, approval_status, created_at")
          .order("created_at", { ascending: false }).limit(8),
        supabase.from("skc_jobs").select("id, title, status, type, created_at, pay_amount")
          .order("created_at", { ascending: false }).limit(6),
      ]);

      // Aggregate roles
      const rolesCount: Record<string, number> = {};
      (usersRes.data ?? []).forEach((u) => {
        rolesCount[u.role] = (rolesCount[u.role] ?? 0) + 1;
      });

      // TRPB sums
      const sumAmount = (rows: { amount: number | null }[] | null) =>
        (rows ?? []).reduce((a, b) => a + Math.abs(Number(b.amount ?? 0)), 0);

      // Active users in last 7 days (distinct from job updates)
      const activeIds = new Set<string>();
      ((active7d.data ?? []) as { employer_id: string | null; student_id: string | null }[]).forEach((j) => {
        if (j.employer_id) activeIds.add(j.employer_id);
        if (j.student_id) activeIds.add(j.student_id);
      });

      // Completed by day (last 7 days, oldest first)
      const completedByDay = Array(7).fill(0);
      const dayMs = 24 * 3600 * 1000;
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      ((last7daysJobs.data ?? []) as { updated_at: string }[]).forEach((j) => {
        const t = new Date(j.updated_at).getTime();
        const dayIdx = Math.floor((t - (todayStart - 6 * dayMs)) / dayMs);
        if (dayIdx >= 0 && dayIdx < 7) completedByDay[dayIdx] += 1;
      });

      setC({
        users: (usersRes.data ?? []).length,
        jobs: jobsRes.count ?? 0,
        completedThisMonth: completedNow.count ?? 0,
        completedLastMonth: completedPrev.count ?? 0,
        newUsersThisMonth: newUsersNow.count ?? 0,
        newUsersLastMonth: newUsersPrev.count ?? 0,
        trpbThisMonth: sumAmount(trpbNow.data as { amount: number | null }[] | null),
        trpbLastMonth: sumAmount(trpbPrev.data as { amount: number | null }[] | null),
        pendingReview: pendingReview.count ?? 0,
        pendingApps: pendingApps.count ?? 0,
        awaitingConfirm: submittedCount.count ?? 0,
        unpaidEscrow: unpaidEscrow.count ?? 0,
        unsupervised: unsupervised.count ?? 0,
        pendingUsers: pendingUsers.count ?? 0,
        openDisputes: openDisputes.count ?? 0,
        activeLast7Days: activeIds.size,
        rolesCount,
        completedByDay,
      });
      setRecentUsers(rUsers.data ?? []);
      setRecentJobs(rJobs.data ?? []);
      setLoading(false);
    }
    load();
  }, []);

  if (loading || !c) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin size-8 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  // === Derived stats ===
  const needAttention =
    c.pendingReview + c.pendingApps + c.awaitingConfirm + c.unpaidEscrow + c.pendingUsers + c.openDisputes;
  const completionRate = c.completedThisMonth + c.completedLastMonth > 0
    ? (c.completedThisMonth / Math.max(1, c.jobs)) * 100
    : 0;
  const completedDelta = c.completedThisMonth - c.completedLastMonth;
  const newUsersDelta = c.newUsersThisMonth - c.newUsersLastMonth;
  const trpbDelta = c.trpbThisMonth - c.trpbLastMonth;
  const trpbPct = c.trpbLastMonth > 0 ? ((trpbDelta / c.trpbLastMonth) * 100) : (c.trpbThisMonth > 0 ? 100 : 0);
  const newUsersPct = c.newUsersLastMonth > 0 ? ((newUsersDelta / c.newUsersLastMonth) * 100) : (c.newUsersThisMonth > 0 ? 100 : 0);
  const activeRate = c.users > 0 ? (c.activeLast7Days / c.users) * 100 : 0;

  // === Insight line ===
  const insightParts: string[] = [];
  if (needAttention === 0) insightParts.push("✅ ระบบทำงานปกติ ไม่มีอะไรค้าง");
  else insightParts.push(`⚠️ มี ${needAttention} รายการต้องการคุณ`);
  if (c.completedThisMonth > 0) insightParts.push(`งานเสร็จเดือนนี้ ${c.completedThisMonth} งาน ${completedDelta >= 0 ? "▲" : "▼"}${Math.abs(completedDelta)} vs เดือนก่อน`);
  if (Math.abs(trpbPct) >= 5) insightParts.push(`TRPB หมุนเวียน ${trpbPct >= 0 ? "▲" : "▼"}${Math.abs(trpbPct).toFixed(0)}% MoM`);
  const insightText = insightParts.join(" · ");
  const insightTone: "green" | "amber" | "red" = needAttention === 0 ? "green" : needAttention > 5 ? "red" : "amber";

  return (
    <div className="space-y-5">
      {/* === Top insight line === */}
      <div
        className={cn(
          "rounded-lg border px-4 py-2.5 text-sm font-medium flex items-center gap-2",
          insightTone === "green" && "bg-emerald-50 border-emerald-200 text-emerald-800",
          insightTone === "amber" && "bg-amber-50 border-amber-200 text-amber-800",
          insightTone === "red" && "bg-red-50 border-red-200 text-red-800",
        )}
      >
        <Activity className="size-4 shrink-0" />
        <span className="flex-1">{insightText}</span>
      </div>

      {/* === Tier 1: Hero KPIs === */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <HeroCard
          label="ต้องการคุณ"
          value={needAttention}
          subtitle={needAttention === 0 ? "ไม่มีงานค้าง" : "รายการต้อง action"}
          icon={needAttention > 0 ? AlertCircle : CheckCircle2}
          tone={needAttention === 0 ? "green" : needAttention > 5 ? "red" : "amber"}
          href="/admin/jobs"
          ctaText={needAttention > 0 ? "ดูทั้งหมด →" : undefined}
        />
        <HeroCard
          label="งานเสร็จเดือนนี้"
          value={c.completedThisMonth}
          delta={completedDelta}
          deltaUnit=" งาน"
          subtitle={`${completionRate.toFixed(0)}% ของงานทั้งหมด`}
          icon={Briefcase}
          tone={completionRate >= 60 ? "green" : completionRate >= 30 ? "amber" : "neutral"}
        />
        <HeroCard
          label="TRPB หมุนเวียน (เดือนนี้)"
          value={c.trpbThisMonth.toLocaleString()}
          delta={trpbDelta}
          deltaPct={trpbPct}
          subtitle="จ่ายให้นศ./ทีม/กองทุน"
          icon={Coins}
          tone={trpbPct >= 0 ? "green" : "amber"}
        />
        <HeroCard
          label="Active 7 วัน"
          value={c.activeLast7Days}
          subtitle={`${activeRate.toFixed(0)}% ของผู้ใช้ทั้งหมด (${c.users})`}
          icon={Users}
          tone={activeRate >= 30 ? "green" : activeRate >= 10 ? "amber" : "neutral"}
        />
      </div>

      {/* === Tier 2: Trends + breakdown === */}
      <div className="grid lg:grid-cols-3 gap-3">
        {/* Sparkline: completed jobs 7 days */}
        <Card className="lg:col-span-1">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xs text-muted-foreground">งานเสร็จ 7 วันล่าสุด</p>
                <p className="text-2xl font-bold text-foreground">
                  {c.completedByDay.reduce((a, b) => a + b, 0)}
                </p>
              </div>
              <TrendIcon delta={c.completedByDay[6] - c.completedByDay[0]} />
            </div>
            <Sparkline data={c.completedByDay} />
            <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
              <span>7 วันก่อน</span>
              <span>วันนี้</span>
            </div>
          </CardContent>
        </Card>

        {/* Stuck breakdown */}
        <Card className="lg:col-span-1">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-3">ค้างที่ขั้นไหน</p>
            <div className="space-y-2">
              <StuckRow icon="🟠" label="รอ staff อนุมัติงาน" value={c.pendingReview} href="/admin/jobs?filter=pending" />
              <StuckRow icon="👥" label="คำขอ นศ. รอ approve" value={c.pendingApps} href="/admin/jobs?filter=applications" />
              <StuckRow icon="🟡" label="ส่งงานแล้ว รอตรวจ" value={c.awaitingConfirm} href="/admin/jobs?filter=submitted" />
              <StuckRow icon="💰" label="เสร็จแล้ว รอจ่าย TRPB" value={c.unpaidEscrow} href="/admin/jobs?filter=pay" />
              <StuckRow icon="🆘" label="ไม่มีผู้กำกับ" value={c.unsupervised} href="/admin/jobs" />
              <StuckRow icon="👤" label="บัญชีรออนุมัติ" value={c.pendingUsers} href="/admin/approvals" />
              <StuckRow icon="⚠️" label="ข้อพิพาทเปิดอยู่" value={c.openDisputes} href="/admin/disputes" />
            </div>
          </CardContent>
        </Card>

        {/* Role distribution */}
        <Card className="lg:col-span-1">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-muted-foreground">การกระจายผู้ใช้</p>
              <p className="text-xs text-muted-foreground">
                ใหม่เดือนนี้ <span className={cn(
                  "font-semibold",
                  newUsersPct >= 0 ? "text-emerald-600" : "text-red-600",
                )}>
                  {newUsersPct >= 0 ? "▲" : "▼"}{Math.abs(newUsersPct).toFixed(0)}%
                </span>
              </p>
            </div>
            <div className="space-y-1.5">
              {Object.entries(ROLE_LABELS).map(([role, cfg]) => {
                const count = c.rolesCount[role] ?? 0;
                if (count === 0) return null;
                const pct = (count / Math.max(1, c.users)) * 100;
                return (
                  <div key={role} className="flex items-center gap-2 text-xs">
                    <span className="w-20 text-muted-foreground truncate">{cfg.label}</span>
                    <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div className={cn("h-full rounded-full", cfg.color)} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-8 text-right font-semibold tabular-nums text-foreground">{count}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* === Tier 3: Drill-down (accordion) === */}
      <Card>
        <button
          onClick={() => setDrill(!drill)}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/50 transition-colors"
        >
          <span className="text-sm font-medium text-foreground flex items-center gap-2">
            <Briefcase className="size-4" />
            รายละเอียดเพิ่มเติม — ผู้ใช้ + งานล่าสุด
          </span>
          {drill ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
        </button>
        {drill && (
          <CardContent className="border-t pt-4 grid lg:grid-cols-2 gap-6">
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <UserCheck className="size-4" />ผู้ใช้ล่าสุด
                </p>
                <Link href="/admin/users" className="text-xs text-sky-600 hover:underline">ดูทั้งหมด →</Link>
              </div>
              {recentUsers.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">ยังไม่มี</p>
              ) : (
                <div className="space-y-1.5">
                  {recentUsers.map((u) => (
                    <div key={u.id} className="flex items-center justify-between text-xs">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-foreground truncate">{u.name}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{u.email}</p>
                      </div>
                      <span className={cn(
                        "text-[10px] rounded-full px-2 py-0.5 shrink-0",
                        ROLE_LABELS[u.role as string]?.color.replace("bg-", "bg-") + "/10",
                      )} style={{
                        backgroundColor: ROLE_LABELS[u.role as string] ? undefined : "#f1f5f9",
                      }}>
                        {ROLE_LABELS[u.role as string]?.label ?? u.role}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Briefcase className="size-4" />งานล่าสุด
                </p>
                <Link href="/admin/jobs" className="text-xs text-sky-600 hover:underline">ดูทั้งหมด →</Link>
              </div>
              {recentJobs.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">ยังไม่มี</p>
              ) : (
                <div className="space-y-1.5">
                  {recentJobs.map((j) => (
                    <div key={j.id} className="flex items-center justify-between text-xs">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-foreground truncate">{j.title}</p>
                        <p className="text-[10px] text-muted-foreground">{j.type} · {j.status}</p>
                      </div>
                      {j.pay_amount > 0 && (
                        <span className="text-[10px] font-semibold text-emerald-700 shrink-0">
                          {j.pay_amount.toLocaleString()} TRPB
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}

/* ============================================================
 *  HeroCard — Tier 1 KPI card
 * ============================================================ */
function HeroCard({
  label, value, delta, deltaUnit, deltaPct, subtitle, icon: Icon, tone, href, ctaText,
}: {
  label: string;
  value: number | string;
  delta?: number;
  deltaUnit?: string;
  deltaPct?: number;
  subtitle: string;
  icon: typeof Briefcase;
  tone: "green" | "amber" | "red" | "neutral";
  href?: string;
  ctaText?: string;
}) {
  const toneStyles: Record<typeof tone, { bg: string; text: string; ring: string; icon: string }> = {
    green: { bg: "bg-emerald-50", text: "text-emerald-700", ring: "ring-emerald-200", icon: "text-emerald-600" },
    amber: { bg: "bg-amber-50", text: "text-amber-700", ring: "ring-amber-200", icon: "text-amber-600" },
    red: { bg: "bg-red-50", text: "text-red-700", ring: "ring-red-200", icon: "text-red-600" },
    neutral: { bg: "bg-slate-50", text: "text-slate-700", ring: "ring-slate-200", icon: "text-slate-500" },
  };
  const s = toneStyles[tone];

  const inner = (
    <Card className={cn("ring-1 transition-all", s.ring, href && "hover:ring-2 cursor-pointer")}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <p className="text-xs text-muted-foreground leading-tight">{label}</p>
          <div className={cn("size-7 rounded-lg flex items-center justify-center", s.bg)}>
            <Icon className={cn("size-4", s.icon)} />
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <p className={cn("text-3xl font-bold tabular-nums", s.text)}>{value}</p>
          {delta !== undefined && delta !== 0 && (
            <span className={cn(
              "text-xs font-semibold inline-flex items-center gap-0.5",
              delta > 0 ? "text-emerald-600" : "text-red-600",
            )}>
              {delta > 0 ? "▲" : "▼"}
              {Math.abs(delta).toLocaleString()}{deltaUnit ?? ""}
              {deltaPct !== undefined && (<span className="text-[10px] opacity-70 ml-0.5">({Math.abs(deltaPct).toFixed(0)}%)</span>)}
            </span>
          )}
          {delta === 0 && (
            <Minus className="size-3 text-muted-foreground" />
          )}
        </div>
        <p className="text-[11px] text-muted-foreground mt-1 truncate">{subtitle}</p>
        {ctaText && (
          <p className="text-[11px] font-medium text-sky-600 mt-1 flex items-center gap-0.5">
            {ctaText}
          </p>
        )}
      </CardContent>
    </Card>
  );

  return href ? <Link href={href}>{inner}</Link> : inner;
}

/* ============================================================
 *  Sparkline — minimal inline SVG (no library)
 * ============================================================ */
function Sparkline({ data }: { data: number[] }) {
  const W = 200;
  const H = 40;
  const max = Math.max(...data, 1);
  const stepX = W / Math.max(1, data.length - 1);
  const points = data.map((v, i) => `${i * stepX},${H - (v / max) * (H - 4)}`).join(" ");
  const last = data[data.length - 1];
  const lastX = (data.length - 1) * stepX;
  const lastY = H - (last / max) * (H - 4);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-12">
      <polyline points={points} fill="none" stroke="#0ea5e9" strokeWidth="2" />
      <circle cx={lastX} cy={lastY} r="3" fill="#0ea5e9" />
    </svg>
  );
}

/* ============================================================
 *  Helper: TrendIcon
 * ============================================================ */
function TrendIcon({ delta }: { delta: number }) {
  if (delta > 0) return <TrendingUp className="size-4 text-emerald-600" />;
  if (delta < 0) return <TrendingDown className="size-4 text-red-600" />;
  return <Minus className="size-4 text-muted-foreground" />;
}

/* ============================================================
 *  StuckRow — Tier 2 stuck breakdown
 * ============================================================ */
function StuckRow({
  icon, label, value, href,
}: {
  icon: string;
  label: string;
  value: number;
  href: string;
}) {
  const isHot = value > 0;
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center justify-between gap-2 py-1 px-1.5 rounded text-xs transition-colors",
        isHot ? "bg-amber-50 hover:bg-amber-100" : "hover:bg-slate-50",
      )}
    >
      <span className="flex items-center gap-1.5 min-w-0 flex-1">
        <span>{icon}</span>
        <span className={cn("truncate", isHot ? "text-amber-800 font-medium" : "text-muted-foreground")}>
          {label}
        </span>
      </span>
      <span className={cn(
        "font-bold tabular-nums shrink-0",
        isHot ? "text-amber-700" : "text-muted-foreground",
      )}>
        {value}
      </span>
      {isHot && <ArrowRight className="size-3 text-amber-600 shrink-0" />}
    </Link>
  );
}
