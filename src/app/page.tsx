import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Briefcase,
  Users,
  CheckCircle,
  Award,
  MapPin,
  Star,
  Trophy,
  Wrench,
  ArrowRight,
} from "lucide-react";
import { getCampusLabel } from "@/types/database";
import { rankJobs } from "@/lib/job-rank";
import { HeroJobCard } from "@/components/hero-job-card";

const JOB_TYPE_LABELS: Record<string, string> = {
  PAID: "งานจ้าง",
  VOLUNTEER: "จิตอาสา",
  TRAINING: "ฝึกทักษะ",
  EXEMPTED: "ยกเว้นค่าบริการ",
};

const JOB_CATEGORY_LABELS: Record<string, string> = {
  electrical: "ไฟฟ้า",
  hvac: "แอร์/เครื่องเย็น",
  automotive: "ยานยนต์",
  general: "ทั่วไป",
};


export default async function HomePage() {
  const supabase = await createClient();

  const [
    { count: totalJobs },
    { count: totalStudents },
    { count: totalEmployers },
    { count: completedJobs },
    { count: totalEvaluations },
    { count: totalCredentials },
    { data: recentJobs },
    { data: topStudents },
  ] = await Promise.all([
    supabase.from("skc_jobs").select("*", { count: "exact", head: true }),
    supabase.from("skc_users").select("*", { count: "exact", head: true }).eq("role", "student"),
    supabase.from("skc_users").select("*", { count: "exact", head: true }).eq("role", "employer"),
    supabase.from("skc_jobs").select("*", { count: "exact", head: true }).eq("status", "COMPLETED"),
    supabase.from("skc_evaluations").select("*", { count: "exact", head: true }),
    supabase.from("skc_student_credentials").select("*", { count: "exact", head: true }),
    // Fetch up to 20 OPEN jobs · let job-rank pick the Top 10 hero
    supabase
      .from("skc_jobs")
      .select("id, title, type, job_category, location, pay_amount, deadline, required_workers, employer:skc_users!skc_jobs_employer_id_fkey(name)")
      .eq("status", "OPEN")
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("skc_student_rating_summary")
      .select("*")
      .gt("combined_score", 0)
      .order("combined_score", { ascending: false })
      .limit(6),
  ]);

  // Rank jobs — pay 60% · urgency 30% · small-team 10%
  type JobRow = NonNullable<typeof recentJobs>[number];
  const featuredJobs = rankJobs<JobRow>((recentJobs ?? []) as JobRow[]).slice(0, 10);

  const stats = [
    { label: "นักศึกษาช่าง", value: totalStudents ?? 0, icon: Users, color: "text-blue-600", bg: "bg-blue-100" },
    { label: "ผู้ว่าจ้าง", value: totalEmployers ?? 0, icon: Briefcase, color: "text-green-600", bg: "bg-green-100" },
    { label: "งานทั้งหมด", value: totalJobs ?? 0, icon: Wrench, color: "text-purple-600", bg: "bg-purple-100" },
    { label: "งานสำเร็จ", value: completedJobs ?? 0, icon: CheckCircle, color: "text-emerald-600", bg: "bg-emerald-100" },
    { label: "การประเมิน", value: totalEvaluations ?? 0, icon: Star, color: "text-yellow-600", bg: "bg-yellow-100" },
    { label: "ใบรับรองทักษะ", value: totalCredentials ?? 0, icon: Award, color: "text-orange-600", bg: "bg-orange-100" },
  ];

  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero — Content-Rich */}
      <header className="relative bg-gradient-to-br from-blue-600 via-indigo-700 to-purple-800 text-white overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-10 size-40 rounded-full border-2 border-white" />
          <div className="absolute bottom-10 right-20 size-60 rounded-full border-2 border-white" />
        </div>

        <div className="relative max-w-6xl mx-auto px-4 py-3 md:py-4">
          {/* Single-row billboard: title + CTAs · stats inline on lg+ */}
          <div className="flex items-center justify-between gap-3 md:gap-6 flex-wrap">
            {/* Title block */}
            <div className="flex-1 min-w-[200px]">
              <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold tracking-tight leading-tight">
                <span className="block whitespace-nowrap">จ้างช่างนักศึกษา</span>
                <span className="block whitespace-nowrap text-blue-200">โปร่งใส ตรวจสอบได้</span>
              </h1>
              <p className="text-[11px] md:text-xs text-blue-200 mt-0.5">
                SkillChain RMUTL · 1 TRPB = 1 อาสา · TRON Nile Testnet
              </p>
            </div>

            {/* Inline stats (hidden mobile, visible md+) — ขยายเป็น 6 stats ครบหลังตัด CTAs ออก */}
            <div className="hidden md:flex items-center gap-3 lg:gap-5 text-white/90">
              {stats.map((s) => (
                <div key={s.label} className="flex items-center gap-1.5">
                  <s.icon className="size-4 text-blue-200" />
                  <span className="text-lg font-bold leading-none">{s.value}</span>
                  <span className="text-[11px] text-blue-200 leading-none">{s.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* Thin stats strip below hero (mobile only — md+ shows all 6 inline in hero) */}
      <section className="md:hidden bg-white border-b">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="grid grid-cols-6 gap-2 text-center">
            {stats.map((s) => (
              <div key={s.label} className="flex flex-col items-center gap-0.5">
                <s.icon className={cn("size-4", s.color)} />
                <span className="text-sm font-bold text-foreground leading-tight">{s.value}</span>
                <span className="text-[9px] text-muted-foreground leading-tight">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* === Featured Jobs (Top 10 ranked by pay + urgency) === */}
      {featuredJobs.length > 0 && (
        <section className="bg-gradient-to-b from-slate-50 via-white to-slate-50 border-b">
          <div className="max-w-6xl mx-auto px-4 py-10 md:py-14">
            <div className="flex items-end justify-between mb-6 flex-wrap gap-2">
              <div>
                <h2 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
                  🔥 งานล่าสุด
                  <span className="text-xs font-normal text-muted-foreground">(Top {featuredJobs.length})</span>
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  เรียงตามค่าจ้างสูง + ใกล้กำหนด — คลิกดูรายละเอียดได้ทันที
                </p>
              </div>
              <Link href="/jobs" className="text-sm text-sky-600 hover:text-sky-800 font-medium inline-flex items-center gap-1">
                ดูงานทั้งหมด <ArrowRight className="size-4" />
              </Link>
            </div>

            {/* Mobile snap-scroll · sm 3-col · lg 5-col × 2-row */}
            <div
              className="
                flex sm:grid gap-3 md:gap-4
                overflow-x-auto sm:overflow-visible
                snap-x snap-mandatory sm:snap-none
                sm:grid-cols-3 lg:grid-cols-5
                -mx-4 px-4 sm:mx-0 sm:px-0
                pb-2 sm:pb-0
              "
            >
              {featuredJobs.map((job) => (
                <HeroJobCard key={job.id} job={job as Parameters<typeof HeroJobCard>[0]["job"]} />
              ))}
            </div>
          </div>
        </section>
      )}

      <main className="flex-1 max-w-6xl mx-auto px-4 py-10 space-y-14">

        {/* Top Rated Students */}
        {topStudents && topStudents.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
                  <Trophy className="size-6 text-yellow-500" />
                  นักศึกษาคะแนนเด่น
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  อันดับจากคะแนนรวม (อาจารย์ 40% + ผู้จ้าง 35% + พี่เลี้ยง 25%)
                </p>
              </div>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {topStudents.map((s, i) => (
                <Card key={s.student_id} className="hover:ring-2 hover:ring-yellow-200 transition-all">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-3">
                      <div className="flex size-10 items-center justify-center rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 text-white font-bold text-sm">
                        #{i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-base text-foreground truncate">{s.name}</CardTitle>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                          <MapPin className="size-3" />{getCampusLabel(String(s.campus))}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-foreground">{Number(s.combined_score).toFixed(1)}</div>
                        <div className="text-[10px] text-muted-foreground">คะแนนรวม</div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {s.credential_level && s.credential_level !== "LEVEL_1" && (
                      <span className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1",
                        s.nft_tier === "diamond" ? "bg-purple-50 text-purple-700 ring-purple-300" :
                        s.nft_tier === "gold" ? "bg-yellow-50 text-yellow-700 ring-yellow-300" :
                        s.nft_tier === "silver" ? "bg-blue-50 text-blue-700 ring-blue-300" :
                        s.nft_tier === "bronze" ? "bg-amber-50 text-amber-700 ring-amber-300" :
                        "bg-gray-50 text-gray-600 ring-gray-300"
                      )}>
                        Lv.{s.credential_level.replace("LEVEL_", "")} — {s.credential_name}
                      </span>
                    )}
                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="rounded-md bg-blue-50 p-2">
                        <div className="flex items-center justify-center gap-0.5 text-blue-700">
                          <Star className="size-3 fill-blue-500 text-blue-500" />
                          <span className="font-bold text-sm">{Number(s.avg_teacher_score).toFixed(1)}</span>
                        </div>
                        <div className="text-muted-foreground mt-0.5">อาจารย์ ({s.teacher_review_count})</div>
                      </div>
                      <div className="rounded-md bg-green-50 p-2">
                        <div className="flex items-center justify-center gap-0.5 text-green-700">
                          <Star className="size-3 fill-green-500 text-green-500" />
                          <span className="font-bold text-sm">{Number(s.avg_employer_rating).toFixed(1)}</span>
                        </div>
                        <div className="text-muted-foreground mt-0.5">ผู้จ้าง ({s.employer_review_count})</div>
                      </div>
                      <div className="rounded-md bg-purple-50 p-2">
                        <div className="flex items-center justify-center gap-0.5 text-purple-700">
                          <Star className="size-3 fill-purple-500 text-purple-500" />
                          <span className="font-bold text-sm">{Number(s.avg_mentor_score).toFixed(1)}</span>
                        </div>
                        <div className="text-muted-foreground mt-0.5">พี่เลี้ยง ({s.mentor_review_count})</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

      </main>

      {/* Footer */}
      <footer className="border-t bg-card py-8">
        <div className="max-w-6xl mx-auto px-4 text-center text-sm text-muted-foreground space-y-2">
          <p className="font-medium text-foreground">กลุ่มใต้ร่มพระบารมี — มหาวิทยาลัยเทคโนโลยีราชมงคลล้านนา</p>
          <p>Powered by Next.js, Supabase &amp; TRON Blockchain (Nile Testnet)</p>
        </div>
      </footer>
    </div>
  );
}
