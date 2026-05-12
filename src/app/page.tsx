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
  Shield,
  Wrench,
  ArrowRight,
  ScanLine,
  Sparkles,
} from "lucide-react";
import { getCampusLabel } from "@/types/database";

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
    supabase
      .from("skc_jobs")
      .select("*, employer:skc_users!skc_jobs_employer_id_fkey(name)")
      .eq("status", "OPEN")
      .order("created_at", { ascending: false })
      .limit(6),
    supabase
      .from("skc_student_rating_summary")
      .select("*")
      .gt("combined_score", 0)
      .order("combined_score", { ascending: false })
      .limit(6),
  ]);

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

        <div className="relative max-w-6xl mx-auto px-4 py-10 md:py-14">
          {/* Main content — 2 columns */}
          <div className="grid md:grid-cols-2 gap-10 items-center">
            {/* Left: Message */}
            <div className="space-y-5">
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight leading-tight">
                จ้างช่างนักศึกษา
                <br />
                <span className="text-blue-200">โปร่งใส ตรวจสอบได้</span>
              </h1>

              {/* TRPB Token Badge */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="inline-flex items-center gap-2 rounded-full bg-white/15 backdrop-blur border border-white/20 px-4 py-2">
                  <span className="text-lg font-bold text-yellow-300">1 TRPB = 1 อาสา</span>
                </div>
                <div className="inline-flex items-center gap-1.5 rounded-full bg-green-500/20 border border-green-400/30 px-3 py-1.5">
                  <span className="size-2 rounded-full bg-green-400 animate-pulse" />
                  <span className="text-xs font-medium text-green-300">TRON Nile Testnet</span>
                </div>
              </div>

              <p className="text-base text-blue-100 leading-relaxed">
                SkillChain เชื่อมต่อ<strong>ผู้ว่าจ้าง</strong>กับ<strong>นักศึกษาช่าง มทร.ล้านนา</strong>
                ผ่านระบบ Blockchain — ทุกงาน ทุกการจ่ายเงิน ทุกการประเมิน บันทึกบน TRON
              </p>

              {/* Primary CTAs */}
              <div className="flex flex-col sm:flex-row gap-3 pt-1">
                <Link href="/register" className="flex-1">
                  <Button
                    size="lg"
                    className="w-full bg-amber-400 hover:bg-amber-500 text-slate-900 font-semibold shadow-lg shadow-amber-500/30 ring-1 ring-amber-300/50 h-12"
                  >
                    <Sparkles className="size-5 mr-2" />
                    เริ่มต้น — สมัคร
                  </Button>
                </Link>
                <Link href="/login" className="flex-1">
                  <Button
                    size="lg"
                    variant="outline"
                    className="w-full bg-white/10 hover:bg-white/20 text-white border-white/30 h-12"
                  >
                    เข้าสู่ระบบ
                    <ArrowRight className="size-5 ml-2" />
                  </Button>
                </Link>
              </div>

              {/* Secondary actions */}
              <div className="flex items-center gap-4 text-sm text-blue-200 pt-1">
                <Link href="/verify" className="hover:text-white inline-flex items-center gap-1.5">
                  <ScanLine className="size-4" />
                  ตรวจสอบใบรับรอง
                </Link>
                <span className="text-blue-300/50">·</span>
                <Link href="/training" className="hover:text-white inline-flex items-center gap-1.5">
                  <Award className="size-4" />
                  หลักสูตรอบรม
                </Link>
              </div>

              {/* Key Value Props */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                {[
                  { icon: Shield, text: "Escrow จ่ายเมื่องานเสร็จ" },
                  { icon: Award, text: "NFT ใบรับรองทักษะ 5 ระดับ" },
                  { icon: Star, text: "ประเมิน 3 ฝ่าย เฉพาะงาน" },
                  { icon: Users, text: "ระบบพี่เลี้ยงดูแลน้อง" },
                ].map((v) => (
                  <div key={v.text} className="flex items-center gap-2 text-sm text-blue-100">
                    <v.icon className="size-4 text-blue-300 shrink-0" />
                    <span>{v.text}</span>
                  </div>
                ))}
              </div>

            </div>

            {/* Right: Live Stats + Recent Jobs */}
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                {stats.map((s) => (
                  <div key={s.label} className="rounded-xl bg-white/10 backdrop-blur p-3 text-center">
                    <s.icon className="size-5 mx-auto mb-1 text-blue-200" />
                    <div className="text-2xl font-bold">{s.value}</div>
                    <div className="text-[11px] text-blue-200">{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Recent Jobs in Hero */}
              {recentJobs && recentJobs.length > 0 ? (
                <div className="rounded-xl bg-white/10 backdrop-blur p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-blue-100">งานล่าสุด</p>
                    <Link href="/jobs" className="text-[11px] text-blue-200 hover:text-white">ดูทั้งหมด →</Link>
                  </div>
                  {recentJobs.slice(0, 4).map((job) => (
                    <Link key={job.id} href={`/jobs/${job.id}`} className="block rounded-lg bg-white/10 hover:bg-white/20 transition-colors p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">{job.title}</div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="inline-flex rounded-full bg-white/20 px-2 py-0.5 text-[10px]">{JOB_TYPE_LABELS[job.type] ?? job.type}</span>
                            <span className="text-[10px] text-blue-200 flex items-center gap-0.5"><MapPin className="size-3" />{getCampusLabel(String(job.campus))}</span>
                          </div>
                        </div>
                        {job.pay_amount > 0 && (
                          <span className="text-sm font-bold text-green-300 shrink-0">{job.pay_amount.toLocaleString()} TRPB</span>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl bg-white/10 backdrop-blur p-4 text-center">
                  <Briefcase className="size-8 mx-auto text-blue-300/50 mb-2" />
                  <p className="text-sm text-blue-200">ยังไม่มีงานเปิดรับ</p>
                  <p className="text-xs text-blue-300 mt-1">ผู้ว่าจ้างสามารถลงงานได้เลย</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

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
