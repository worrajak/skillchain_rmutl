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
      .or(`deadline.is.null,deadline.gte.${new Date().toISOString()}`)
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

  // แสดงเฉพาะตัวเลขที่มีค่าจริง — ระบบช่วง pilot ที่โชว์ 0 ติดกันหลายช่อง
  // ทำให้ผู้ใช้ใหม่คิดว่าไม่มีใครใช้งาน
  const stats = [
    { label: "นักศึกษาช่าง", value: totalStudents ?? 0, icon: Users },
    { label: "งานที่เปิดรับ", value: featuredJobs.length, icon: Wrench },
    { label: "ผู้ว่าจ้าง", value: totalEmployers ?? 0, icon: Briefcase },
    { label: "งานสำเร็จ", value: completedJobs ?? 0, icon: CheckCircle },
    { label: "การประเมิน", value: totalEvaluations ?? 0, icon: Star },
    { label: "ใบรับรองทักษะ", value: totalCredentials ?? 0, icon: Award },
  ].filter((s) => s.value > 0);

  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero — บอกว่าระบบทำอะไร แล้วให้ทางเข้าตามบทบาททันที */}
      <header className="border-b bg-card">
        <div className="max-w-6xl mx-auto px-4 py-12 md:py-16">
          <div className="grid gap-10 lg:grid-cols-[1.45fr_1fr] lg:items-center">
            <div>
              <p className="font-mono text-[0.7rem] uppercase tracking-[0.14em] text-[var(--brand-brass)]">
                ระบบจ้างช่างนักศึกษา · มทร.ล้านนา
              </p>
              <h1 className="mt-5 text-4xl md:text-5xl font-bold leading-[1.1] tracking-tight">
                จ้างช่างนักศึกษา
                <span className="block text-primary">โปร่งใส ตรวจสอบได้</span>
              </h1>
              <p className="mt-5 max-w-[48ch] text-base md:text-lg text-muted-foreground">
                ระบบกลางที่เชื่อมงานซ่อมบำรุงในมหาวิทยาลัยกับนักศึกษาช่างที่พร้อมทำงาน
                บันทึกผลงาน คะแนน และใบรับรองที่ตรวจสอบย้อนหลังได้
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Button size="lg" render={<Link href="/register?role=student" />}>
                  ฉันเป็นนักศึกษา — เริ่มรับงาน
                  <ArrowRight className="size-4" />
                </Button>
                <Button size="lg" variant="outline" render={<Link href="/register?role=employer" />}>
                  ต้องการจ้างช่าง
                </Button>
              </div>
            </div>

            {/* สถานะจริงของโครงการ — ตัวเลขที่ยังเป็น 0 ถูกกรองออกไปแล้ว */}
            <aside className="rounded-lg border bg-background p-6">
              <p className="flex items-center gap-2 font-mono text-[0.7rem] uppercase tracking-[0.1em] text-[var(--brand-success)]">
                <span className="size-2 rounded-full bg-[var(--brand-success)] ring-3 ring-[var(--brand-success)]/25" />
                เปิดรับสมัคร
              </p>
              <h2 className="mt-3 text-xl font-bold">สถานะโครงการวันนี้</h2>

              <dl className="mt-5 space-y-3">
                {stats.map((s) => (
                  <div
                    key={s.label}
                    className="flex items-center justify-between gap-3 border-b border-dashed pb-3 last:border-0 last:pb-0"
                  >
                    <dt className="flex items-center gap-2 text-sm text-muted-foreground">
                      <s.icon className="size-4 text-muted-foreground" />
                      {s.label}
                    </dt>
                    <dd className="tabular font-mono font-semibold text-primary">{s.value}</dd>
                  </div>
                ))}
              </dl>

              <p className="mt-5 text-[0.8rem] leading-relaxed text-muted-foreground">
                ระยะนำร่อง เม.ย.–ก.ย. 2569 · เปิดรับนักศึกษา 20 คน และงานซ่อมบำรุง 30 รายการ
              </p>
            </aside>
          </div>
        </div>
      </header>

      {/* === งานที่เปิดรับ (จัดอันดับจากค่าจ้าง + ความใกล้กำหนด) === */}
      {featuredJobs.length === 0 ? (
        <section className="border-b">
          <div className="max-w-6xl mx-auto px-4 py-14 text-center">
            <h2 className="text-2xl font-bold">ยังไม่มีงานที่เปิดรับตอนนี้</h2>
            <p className="mt-2 text-muted-foreground">
              งานใหม่จะประกาศเมื่อหน่วยงานในมหาวิทยาลัยส่งคำขอเข้ามา — สมัครไว้ก่อนเพื่อรับแจ้งเตือน
            </p>
            <Button className="mt-6" render={<Link href="/register?role=student" />}>
              สมัครเป็นนักศึกษาช่าง
            </Button>
          </div>
        </section>
      ) : (
        <section className="border-b">
          <div className="max-w-6xl mx-auto px-4 py-10 md:py-14">
            <div className="flex items-end justify-between mb-6 flex-wrap gap-2">
              <div>
                <h2 className="text-2xl md:text-3xl font-bold">งานที่เปิดรับ</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  เรียงตามค่าจ้างและวันปิดรับที่ใกล้ที่สุด
                </p>
              </div>
              <Link
                href="/jobs"
                className="text-sm font-semibold text-primary hover:underline inline-flex items-center gap-1"
              >
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
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <Trophy className="size-6 text-[var(--brand-brass)]" />
                  นักศึกษาคะแนนเด่น
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  อันดับจากคะแนนรวม (อาจารย์ 40% + ผู้จ้าง 35% + พี่เลี้ยง 25%)
                </p>
              </div>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {topStudents.map((s, i) => (
                <Card key={s.student_id} className="transition-colors hover:border-primary">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-3">
                      <div className="tabular flex size-10 items-center justify-center rounded-full bg-secondary font-mono text-sm font-bold text-primary">
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-base truncate">{s.name}</CardTitle>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                          <MapPin className="size-3" />{getCampusLabel(String(s.campus))}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="tabular text-lg font-bold">{Number(s.combined_score).toFixed(1)}</div>
                        <div className="text-[0.65rem] text-muted-foreground">คะแนนรวม</div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {s.credential_level && s.credential_level !== "LEVEL_1" && (
                      <span className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1",
                        s.nft_tier === "diamond" || s.nft_tier === "gold"
                          ? "bg-accent text-accent-foreground ring-[var(--brand-brass)]/40"
                          : "bg-secondary text-secondary-foreground ring-border"
                      )}>
                        Lv.{s.credential_level.replace("LEVEL_", "")} — {s.credential_name}
                      </span>
                    )}
                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      {[
                        { label: "อาจารย์", score: s.avg_teacher_score, count: s.teacher_review_count },
                        { label: "ผู้จ้าง", score: s.avg_employer_rating, count: s.employer_review_count },
                        { label: "พี่เลี้ยง", score: s.avg_mentor_score, count: s.mentor_review_count },
                      ].map((r) => (
                        <div key={r.label} className="rounded-md bg-secondary p-2">
                          <div className="flex items-center justify-center gap-0.5 text-primary">
                            <Star className="size-3 fill-current" />
                            <span className="tabular font-bold text-sm">{Number(r.score).toFixed(1)}</span>
                          </div>
                          <div className="text-muted-foreground mt-0.5">{r.label} ({r.count})</div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

      </main>

      {/* Footer */}
      <footer className="border-t bg-card py-10">
        <div className="max-w-6xl mx-auto px-4 flex flex-wrap items-start justify-between gap-6 text-sm">
          <div>
            <p className="font-semibold">กลุ่มแผนงานใต้ร่มพระบารมี</p>
            <p className="text-muted-foreground">มหาวิทยาลัยเทคโนโลยีราชมงคลล้านนา</p>
          </div>
          <nav className="flex flex-wrap gap-x-6 gap-y-2 text-muted-foreground">
            <Link href="/jobs" className="hover:text-foreground">งานทั้งหมด</Link>
            <Link href="/training" className="hover:text-foreground">หลักสูตรอบรม</Link>
            <Link href="/verify" className="hover:text-foreground">ตรวจสอบใบรับรอง</Link>
            <Link href="/guides" className="hover:text-foreground">คู่มือการใช้งาน</Link>
            <Link href="/about" className="hover:text-foreground">เกี่ยวกับระบบ</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
