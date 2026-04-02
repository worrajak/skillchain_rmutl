import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Briefcase,
  Users,
  CheckCircle,
  Wallet,
  Zap,
  Award,
  GraduationCap,
  MapPin,
  Clock,
  Star,
  Trophy,
} from "lucide-react";

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

const TIER_LABELS: Record<string, string> = {
  trainee: "Trainee",
  apprentice: "Apprentice",
  certified: "Certified",
};

const BADGE_COLORS: Record<string, string> = {
  PAID: "bg-green-100 text-green-800",
  VOLUNTEER: "bg-blue-100 text-blue-800",
  TRAINING: "bg-yellow-100 text-yellow-800",
  EXEMPTED: "bg-purple-100 text-purple-800",
};

const CATEGORY_COLORS: Record<string, string> = {
  electrical: "bg-amber-100 text-amber-800",
  hvac: "bg-cyan-100 text-cyan-800",
  automotive: "bg-red-100 text-red-800",
  general: "bg-gray-100 text-gray-800",
};

const TIER_COLORS: Record<string, string> = {
  trainee: "bg-gray-100 text-gray-700",
  apprentice: "bg-blue-100 text-blue-700",
  certified: "bg-green-100 text-green-700",
};

export default async function HomePage() {
  const supabase = await createClient();

  // Fetch data in parallel
  const [
    { count: totalJobs },
    { count: totalStudents },
    { count: completedJobs },
    { data: recentJobs },
    { data: availableStudents },
    { data: topStudents },
  ] = await Promise.all([
    supabase.from("jobs").select("*", { count: "exact", head: true }),
    supabase
      .from("users")
      .select("*", { count: "exact", head: true })
      .eq("role", "student"),
    supabase
      .from("jobs")
      .select("*", { count: "exact", head: true })
      .eq("status", "COMPLETED"),
    supabase
      .from("jobs")
      .select("*, employer:users!jobs_employer_id_fkey(name)")
      .eq("status", "OPEN")
      .order("created_at", { ascending: false })
      .limit(6),
    supabase
      .from("student_availability")
      .select(
        "*, student:users!student_availability_student_id_fkey(id, name, campus), tier:student_tiers!student_id(tier, training_jobs_completed), qualification:student_qualifications!student_id(badge_level, avg_score, total_jobs)"
      )
      .eq("status", "available")
      .limit(6),
    supabase
      .from("student_rating_summary")
      .select("*")
      .gt("combined_score", 0)
      .order("combined_score", { ascending: false })
      .limit(6),
  ]);

  const stats = [
    {
      label: "งานทั้งหมด",
      value: totalJobs ?? 0,
      icon: Briefcase,
    },
    {
      label: "นักศึกษาในระบบ",
      value: totalStudents ?? 0,
      icon: Users,
    },
    {
      label: "งานสำเร็จ",
      value: completedJobs ?? 0,
      icon: CheckCircle,
    },
  ];

  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero */}
      <header className="bg-gradient-to-br from-blue-600 to-indigo-800 text-white">
        <div className="max-w-6xl mx-auto px-4 py-16 text-center">
          <Badge variant="secondary" className="mb-4 text-sm">
            Pilot Phase — มทร.ล้านนา 2569
          </Badge>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            SkillChain มทร.ล้านนา
          </h1>
          <p className="text-lg md:text-xl text-blue-100 max-w-2xl mx-auto mb-8">
            ระบบจัดการงานจ้างนักศึกษาช่างบน TRON Blockchain
            <br />
            พร้อมระบบ Escrow, NFT Credential และการฝึกทักษะแบบมีพี่เลี้ยง
          </p>
          <div className="flex gap-4 justify-center">
            <Link href="/login">
              <Button size="lg" variant="secondary">
                เข้าสู่ระบบ
              </Button>
            </Link>
            <Link href="/register">
              <Button
                size="lg"
                variant="outline"
                className="text-white border-2 border-white bg-white/15 hover:bg-white/25"
              >
                ลงทะเบียน
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Stats */}
      <section className="border-b bg-card">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="grid grid-cols-3 gap-6 text-center">
            {stats.map((s) => (
              <div key={s.label} className="flex flex-col items-center gap-2">
                <s.icon className="size-8 text-blue-600" />
                <span className="text-3xl font-bold text-foreground">
                  {s.value}
                </span>
                <span className="text-sm text-muted-foreground">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <main className="flex-1 max-w-6xl mx-auto px-4 py-12 space-y-16">
        {/* Recent Jobs */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-foreground">
                งานที่เปิดรับล่าสุด
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                งานซ่อมบำรุงที่รอนักศึกษาช่างมารับงาน
              </p>
            </div>
            <Link href="/login">
              <Button variant="outline" size="sm">
                ดูทั้งหมด
              </Button>
            </Link>
          </div>

          {recentJobs && recentJobs.length > 0 ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {recentJobs.map((job) => (
                <Card key={job.id} className="hover:ring-2 hover:ring-blue-200 transition-all">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base leading-snug text-foreground">
                        {job.title}
                      </CardTitle>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${BADGE_COLORS[job.type] ?? ""}`}
                      >
                        {JOB_TYPE_LABELS[job.type] ?? job.type}
                      </span>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${CATEGORY_COLORS[job.job_category] ?? ""}`}
                      >
                        {JOB_CATEGORY_LABELS[job.job_category] ?? job.job_category}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {job.description}
                    </p>
                    <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <MapPin className="size-3" />
                        {job.location} ({job.campus})
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="size-3" />
                        กำหนดส่ง:{" "}
                        {new Date(job.deadline).toLocaleDateString("th-TH", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                      {job.pay_amount > 0 && (
                        <span className="flex items-center gap-1 text-green-700 font-medium">
                          <Wallet className="size-3" />
                          {job.pay_amount.toLocaleString()} TRX
                        </span>
                      )}
                    </div>
                    <div className="pt-2 border-t text-xs text-muted-foreground">
                      โดย: {(job.employer as { name: string })?.name ?? "ไม่ระบุ"}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="text-center py-12">
              <CardContent>
                <Briefcase className="size-12 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-lg font-medium text-foreground">
                  ยังไม่มีงานเปิดรับ
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  ผู้ว่าจ้างสามารถเข้าสู่ระบบเพื่อประกาศงานได้เลย
                </p>
              </CardContent>
            </Card>
          )}
        </section>

        {/* Available Students */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-foreground">
                นักศึกษาช่างพร้อมรับงาน
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                นักศึกษาที่ว่างและพร้อมรับงานซ่อมบำรุง
              </p>
            </div>
            <Link href="/login">
              <Button variant="outline" size="sm">
                ดูทั้งหมด
              </Button>
            </Link>
          </div>

          {availableStudents && availableStudents.length > 0 ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {availableStudents.map((sa) => {
                const student = sa.student as { id: string; name: string; campus: string } | null;
                const tier = sa.tier as { tier: string; training_jobs_completed: number } | null;
                const qual = sa.qualification as {
                  badge_level: string;
                  avg_score: number;
                  total_jobs: number;
                } | null;
                return (
                  <Card key={sa.student_id} className="hover:ring-2 hover:ring-blue-200 transition-all">
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-3">
                        <div className="flex size-10 items-center justify-center rounded-full bg-blue-100 text-blue-700 font-bold text-sm">
                          {student?.name?.charAt(0) ?? "?"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-base text-foreground truncate">
                            {student?.name ?? "ไม่ระบุ"}
                          </CardTitle>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                            <MapPin className="size-3" />
                            {student?.campus ?? ""}
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex flex-wrap gap-1.5">
                        {tier && (
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${TIER_COLORS[tier.tier] ?? ""}`}
                          >
                            <GraduationCap className="size-3" />
                            {TIER_LABELS[tier.tier] ?? tier.tier}
                          </span>
                        )}
                        {qual && qual.badge_level !== "LOCKED" && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 text-yellow-800 px-2 py-0.5 text-xs font-medium">
                            <Award className="size-3" />
                            {qual.badge_level}
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center text-xs">
                        <div className="rounded-md bg-muted p-2">
                          <div className="font-bold text-foreground text-sm">
                            {qual?.total_jobs ?? 0}
                          </div>
                          <div className="text-muted-foreground">งาน</div>
                        </div>
                        <div className="rounded-md bg-muted p-2">
                          <div className="font-bold text-foreground text-sm">
                            {qual?.avg_score ? qual.avg_score.toFixed(1) : "-"}
                          </div>
                          <div className="text-muted-foreground">คะแนน</div>
                        </div>
                        <div className="rounded-md bg-muted p-2">
                          <div className="font-bold text-foreground text-sm">
                            {tier?.training_jobs_completed ?? 0}
                          </div>
                          <div className="text-muted-foreground">ฝึกงาน</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 text-xs">
                        <span className="inline-flex size-2 rounded-full bg-green-500" />
                        <span className="text-green-700 font-medium">พร้อมรับงาน</span>
                        {sa.current_jobs > 0 && (
                          <span className="text-muted-foreground ml-auto">
                            กำลังทำ {sa.current_jobs} งาน
                          </span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card className="text-center py-12">
              <CardContent>
                <Users className="size-12 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-lg font-medium text-foreground">
                  ยังไม่มีนักศึกษาในระบบ
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  นักศึกษาสามารถลงทะเบียนเพื่อเข้าร่วมระบบได้เลย
                </p>
              </CardContent>
            </Card>
          )}
        </section>

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
                      <div className="relative">
                        <div className="flex size-10 items-center justify-center rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 text-white font-bold text-sm">
                          #{i + 1}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-base text-foreground truncate">
                          {s.name}
                        </CardTitle>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                          <MapPin className="size-3" />
                          {s.campus}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-foreground">
                          {Number(s.combined_score).toFixed(1)}
                        </div>
                        <div className="text-[10px] text-muted-foreground">คะแนนรวม</div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {/* Credential Level */}
                    {s.credential_level && s.credential_level !== "LEVEL_1" && (
                      <div className="flex items-center gap-2 text-xs">
                        <span className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium ring-1",
                          s.nft_tier === "diamond" ? "bg-purple-50 text-purple-700 ring-purple-300" :
                          s.nft_tier === "gold" ? "bg-yellow-50 text-yellow-700 ring-yellow-300" :
                          s.nft_tier === "silver" ? "bg-blue-50 text-blue-700 ring-blue-300" :
                          s.nft_tier === "bronze" ? "bg-amber-50 text-amber-700 ring-amber-300" :
                          "bg-gray-50 text-gray-600 ring-gray-300"
                        )}>
                          Lv.{s.credential_level.replace("LEVEL_", "")} — {s.credential_name}
                        </span>
                      </div>
                    )}
                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="rounded-md bg-blue-50 p-2">
                        <div className="flex items-center justify-center gap-0.5 text-blue-700">
                          <Star className="size-3 fill-blue-500 text-blue-500" />
                          <span className="font-bold text-sm">
                            {Number(s.avg_teacher_score).toFixed(1)}
                          </span>
                        </div>
                        <div className="text-muted-foreground mt-0.5">
                          อาจารย์ ({s.teacher_review_count})
                        </div>
                      </div>
                      <div className="rounded-md bg-green-50 p-2">
                        <div className="flex items-center justify-center gap-0.5 text-green-700">
                          <Star className="size-3 fill-green-500 text-green-500" />
                          <span className="font-bold text-sm">
                            {Number(s.avg_employer_rating).toFixed(1)}
                          </span>
                        </div>
                        <div className="text-muted-foreground mt-0.5">
                          ผู้จ้าง ({s.employer_review_count})
                        </div>
                      </div>
                      <div className="rounded-md bg-purple-50 p-2">
                        <div className="flex items-center justify-center gap-0.5 text-purple-700">
                          <Star className="size-3 fill-purple-500 text-purple-500" />
                          <span className="font-bold text-sm">
                            {Number(s.avg_mentor_score).toFixed(1)}
                          </span>
                        </div>
                        <div className="text-muted-foreground mt-0.5">
                          พี่เลี้ยง ({s.mentor_review_count})
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* Features */}
        <section>
          <h2 className="text-2xl font-bold text-center mb-8 text-foreground">
            ระบบครบวงจร
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[
              {
                icon: Briefcase,
                title: "Job Board",
                desc: "4 ประเภทงาน",
              },
              {
                icon: Wallet,
                title: "Escrow Payment",
                desc: "จ่ายผ่าน Smart Contract",
              },
              {
                icon: Award,
                title: "NFT Credential",
                desc: "ใบรับรองทักษะบน Blockchain",
              },
              {
                icon: Users,
                title: "Mentorship",
                desc: "ระบบพี่เลี้ยงรุ่นพี่-รุ่นน้อง",
              },
              {
                icon: GraduationCap,
                title: "Student Tier",
                desc: "3 ระดับพัฒนา",
              },
              {
                icon: Zap,
                title: "Donation Fund",
                desc: "กองทุนโปร่งใส",
              },
            ].map((f) => (
              <div
                key={f.title}
                className="flex items-center gap-3 rounded-lg border p-4"
              >
                <f.icon className="size-8 shrink-0 text-blue-600" />
                <div>
                  <div className="font-medium text-sm text-foreground">{f.title}</div>
                  <div className="text-xs text-muted-foreground">{f.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t py-8 text-center text-sm text-muted-foreground">
        <p>กลุ่มใต้ร่มพระบารมี — มหาวิทยาลัยเทคโนโลยีราชมงคลล้านนา</p>
        <p className="mt-1">
          Powered by Next.js, Supabase &amp; TRON Blockchain
        </p>
      </footer>
    </div>
  );
}
