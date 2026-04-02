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
  Award,
  MapPin,
  Clock,
  Star,
  Trophy,
  Shield,
  Zap,
  ArrowRight,
  UserPlus,
  FileCheck,
  Wrench,
  BadgeCheck,
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
    supabase.from("jobs").select("*", { count: "exact", head: true }),
    supabase.from("users").select("*", { count: "exact", head: true }).eq("role", "student"),
    supabase.from("users").select("*", { count: "exact", head: true }).eq("role", "employer"),
    supabase.from("jobs").select("*", { count: "exact", head: true }).eq("status", "COMPLETED"),
    supabase.from("evaluations").select("*", { count: "exact", head: true }),
    supabase.from("student_credentials").select("*", { count: "exact", head: true }),
    supabase
      .from("jobs")
      .select("*, employer:users!jobs_employer_id_fkey(name)")
      .eq("status", "OPEN")
      .order("created_at", { ascending: false })
      .limit(6),
    supabase
      .from("student_rating_summary")
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
          {/* Top bar */}
          <div className="flex items-center justify-between mb-8">
            <Badge variant="secondary" className="text-sm font-medium">
              Pilot Phase — มทร.ล้านนา 2569
            </Badge>
            <div className="flex gap-3">
              <Link href="/login">
                <Button size="sm" variant="secondary" className="font-semibold">เข้าสู่ระบบ</Button>
              </Link>
              <Link href="/register">
                <Button size="sm" className="font-semibold bg-white text-blue-700 hover:bg-blue-50">ลงทะเบียน</Button>
              </Link>
            </div>
          </div>

          {/* Main content — 2 columns */}
          <div className="grid md:grid-cols-2 gap-10 items-center">
            {/* Left: Message */}
            <div className="space-y-5">
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight leading-tight">
                จ้างช่างนักศึกษา
                <br />
                <span className="text-blue-200">โปร่งใส ตรวจสอบได้</span>
              </h1>
              <p className="text-base text-blue-100 leading-relaxed">
                SkillChain เชื่อมต่อ<strong>ผู้ว่าจ้าง</strong>กับ<strong>นักศึกษาช่าง มทร.ล้านนา</strong>
                ผ่านระบบ Blockchain — ทุกงาน ทุกการจ่ายเงิน ทุกการประเมิน บันทึกบน TRON
                แก้ไขย้อนหลังไม่ได้ ตรวจสอบได้ตลอด
              </p>

              {/* Key Value Props */}
              <div className="grid grid-cols-2 gap-3">
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

              {/* CTA */}
              <div className="flex gap-3 pt-2">
                <Link href="/register">
                  <Button size="lg" className="font-semibold bg-white text-blue-700 hover:bg-blue-50 px-6">
                    ลงทะเบียนเลย
                  </Button>
                </Link>
                <Link href="#how-it-works">
                  <Button size="lg" variant="outline" className="font-semibold text-white border-white/40 bg-white/10 hover:bg-white/20 px-6">
                    ดูขั้นตอน
                  </Button>
                </Link>
              </div>
            </div>

            {/* Right: Live Stats */}
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

              {/* For who */}
              <div className="rounded-xl bg-white/10 backdrop-blur p-4 space-y-3">
                <p className="text-sm font-semibold text-blue-100">สำหรับใคร?</p>
                {[
                  { role: "นักศึกษาช่าง", desc: "รับงาน สร้างประวัติ ได้ NFT ใบรับรอง" },
                  { role: "ผู้ว่าจ้าง/หน่วยงาน", desc: "ลงงาน จ่ายผ่าน Escrow ประเมินช่างได้" },
                  { role: "อาจารย์", desc: "ประเมินทักษะ ดูแลคุณภาพ เลื่อนระดับ สร้างงานจ้างเทียม" },
                  { role: "คณะทำงานใต้ร่มพระบารมี", desc: "ฝึกอบรม ประเมินเบื้องต้น รับรอง Lv.2 ยืนยันผู้ใช้" },
                  { role: "คณะทำงาน มทร.ล้านนา", desc: "ผู้ว่าจ้างเทียม+ผู้ประเมินทักษะ สร้างงานทดสอบ" },
                  { role: "ผู้บริจาค", desc: "บริจาคกองทุน ติดตามการใช้เงินแบบ Real-time" },
                ].map((r) => (
                  <div key={r.role} className="flex items-start gap-2">
                    <CheckCircle className="size-4 text-green-300 mt-0.5 shrink-0" />
                    <div>
                      <span className="text-sm font-medium">{r.role}</span>
                      <span className="text-xs text-blue-200 ml-1">— {r.desc}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main id="how-it-works" className="flex-1 max-w-6xl mx-auto px-4 py-10 space-y-14">

        {/* How It Works */}
        <section>
          <h2 className="text-2xl font-bold text-center mb-2 text-foreground">
            ขั้นตอนการใช้งาน
          </h2>
          <p className="text-sm text-muted-foreground text-center mb-8">
            เส้นทางพัฒนาจากนักศึกษาช่างสู่ช่างชำนาญการ
          </p>
          <div className="grid md:grid-cols-5 gap-3">
            {[
              { step: 1, icon: UserPlus, title: "ลงทะเบียน", desc: "สมัครบัญชี เลือกบทบาท", color: "from-gray-500 to-gray-600" },
              { step: 2, icon: FileCheck, title: "ผ่านฝึกอบรม", desc: "อบรมจากใต้ร่มพระบารมี", color: "from-amber-500 to-orange-600" },
              { step: 3, icon: Wrench, title: "รับงาน", desc: "งานฝึก/จิตอาสา/จ้าง", color: "from-blue-500 to-indigo-600" },
              { step: 4, icon: Star, title: "ถูกประเมิน", desc: "อาจารย์+ผู้จ้าง+Mentor", color: "from-yellow-500 to-amber-600" },
              { step: 5, icon: BadgeCheck, title: "NFT Credential", desc: "ใบรับรองบน Blockchain", color: "from-green-500 to-emerald-600" },
            ].map((s, i) => (
              <div key={s.step} className="flex flex-col items-center text-center">
                <div className={cn("flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br text-white mb-3 shadow-lg", s.color)}>
                  <s.icon className="size-7" />
                </div>
                <div className="font-bold text-sm text-foreground mb-1">
                  <span className="text-muted-foreground">{s.step}.</span> {s.title}
                </div>
                <p className="text-xs text-muted-foreground">{s.desc}</p>
                {i < 4 && (
                  <ArrowRight className="size-4 text-muted-foreground/40 mt-2 hidden md:block rotate-0" />
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Credential Levels */}
        <section>
          <h2 className="text-2xl font-bold text-center mb-2 text-foreground">
            5 ระดับ Credential
          </h2>
          <p className="text-sm text-muted-foreground text-center mb-6">
            ใบรับรองทักษะช่างบน Blockchain — ยิ่งระดับสูง ยิ่งรับงานได้มาก
          </p>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            {[
              { lv: 1, name: "Registered", th: "ลงทะเบียน", by: "ระบบอัตโนมัติ", jobs: "สังเกตการณ์", gradient: "from-gray-400 to-gray-500", ring: "ring-gray-300" },
              { lv: 2, name: "Project Cert.", th: "ผ่านฝึกอบรม", by: "กลุ่มใต้ร่มพระบารมี", jobs: "ฝึกทักษะ+จิตอาสา", gradient: "from-amber-500 to-orange-600", ring: "ring-amber-300" },
              { lv: 3, name: "Teacher Cert.", th: "อาจารย์รับรอง", by: "มทร.ล้านนา", jobs: "งานจ้างได้", gradient: "from-blue-500 to-indigo-600", ring: "ring-blue-300" },
              { lv: 4, name: "National Cert.", th: "สถาบันชาติรับรอง", by: "กรมฝีมือแรงงาน/สคช.", jobs: "ทุกประเภท+Mentor", gradient: "from-yellow-400 to-amber-500", ring: "ring-yellow-400" },
              { lv: 5, name: "Master Tech.", th: "ช่างชำนาญการ", by: "ผลงานสะสม", jobs: "รับเหมา+สอน+รับรอง", gradient: "from-purple-500 to-fuchsia-600", ring: "ring-purple-400" },
            ].map((c) => (
              <Card key={c.lv} className={cn("overflow-hidden ring-1", c.ring)}>
                <div className={cn("h-2 bg-gradient-to-r", c.gradient)} />
                <CardContent className="pt-3 pb-3 text-center space-y-1">
                  <div className={cn("inline-flex size-10 items-center justify-center rounded-full bg-gradient-to-br text-white font-bold text-sm mx-auto", c.gradient)}>
                    {c.lv}
                  </div>
                  <div className="font-bold text-sm text-foreground">{c.name}</div>
                  <div className="text-xs text-muted-foreground">{c.th}</div>
                  <div className="text-[10px] text-muted-foreground border-t pt-1 mt-1">
                    รับรอง: {c.by}
                  </div>
                  <div className="text-[10px] font-medium text-foreground">
                    {c.jobs}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Recent Jobs */}
        {recentJobs && recentJobs.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-foreground">งานที่เปิดรับล่าสุด</h2>
                <p className="text-sm text-muted-foreground mt-1">งานซ่อมบำรุงที่รอนักศึกษาช่างมารับงาน</p>
              </div>
              <Link href="/login">
                <Button variant="outline" size="sm">ดูทั้งหมด</Button>
              </Link>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {recentJobs.map((job) => (
                <Link key={job.id} href={`/jobs/${job.id}`}>
                <Card className="hover:ring-2 hover:ring-blue-200 transition-all cursor-pointer">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base leading-snug text-foreground">{job.title}</CardTitle>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", BADGE_COLORS[job.type] ?? "")}>
                        {JOB_TYPE_LABELS[job.type] ?? job.type}
                      </span>
                      <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", CATEGORY_COLORS[job.job_category] ?? "")}>
                        {JOB_CATEGORY_LABELS[job.job_category] ?? job.job_category}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <p className="text-sm text-muted-foreground line-clamp-2">{job.description}</p>
                    <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><MapPin className="size-3" />{job.location} ({job.campus})</span>
                      <span className="flex items-center gap-1"><Clock className="size-3" />กำหนดส่ง: {new Date(job.deadline).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })}</span>
                      {job.pay_amount > 0 && (
                        <span className="flex items-center gap-1 text-green-700 font-medium"><Wallet className="size-3" />{job.pay_amount.toLocaleString()} TRX</span>
                      )}
                    </div>
                    <div className="pt-2 border-t text-xs text-muted-foreground">
                      โดย: {(job.employer as { name: string })?.name ?? "ไม่ระบุ"}
                    </div>
                  </CardContent>
                </Card>
                </Link>
              ))}
            </div>
          </section>
        )}

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
                          <MapPin className="size-3" />{s.campus}
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

        {/* Features Grid */}
        <section>
          <h2 className="text-2xl font-bold text-center mb-2 text-foreground">ระบบครบวงจร</h2>
          <p className="text-sm text-muted-foreground text-center mb-6">โปร่งใส ตรวจสอบได้ ทุกขั้นตอนอยู่บน Blockchain</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[
              { icon: Briefcase, title: "Job Board", desc: "4 ประเภทงาน: จ้าง/จิตอาสา/ฝึกทักษะ/ยกเว้นค่าบริการ", color: "text-blue-600", bg: "bg-blue-50" },
              { icon: Wallet, title: "Escrow Payment", desc: "Smart Contract จ่ายอัตโนมัติเมื่องานเสร็จ", color: "text-green-600", bg: "bg-green-50" },
              { icon: Award, title: "NFT Credential", desc: "ใบรับรอง 5 ระดับบน Blockchain แก้ไขไม่ได้", color: "text-purple-600", bg: "bg-purple-50" },
              { icon: Users, title: "Mentorship", desc: "พี่เลี้ยงรุ่นพี่กำกับดูแลพร้อมประเมิน", color: "text-orange-600", bg: "bg-orange-50" },
              { icon: Shield, title: "Gate Control", desc: "ตรวจสอบสิทธิ์รับงานตาม Credential Level", color: "text-red-600", bg: "bg-red-50" },
              { icon: Zap, title: "Multi-source Rating", desc: "อาจารย์ + ผู้จ้าง + Mentor ประเมินครบวงจร", color: "text-yellow-600", bg: "bg-yellow-50" },
            ].map((f) => (
              <Card key={f.title} className="hover:shadow-md transition-shadow">
                <CardContent className="flex items-start gap-3 pt-4 pb-4">
                  <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", f.bg)}>
                    <f.icon className={cn("size-5", f.color)} />
                  </div>
                  <div>
                    <div className="font-semibold text-sm text-foreground">{f.title}</div>
                    <div className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{f.desc}</div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="text-center py-8">
          <Card className="bg-gradient-to-br from-blue-600 to-indigo-800 text-white border-0">
            <CardContent className="py-10 space-y-4">
              <h2 className="text-2xl md:text-3xl font-bold">พร้อมเริ่มต้นแล้วหรือยัง?</h2>
              <p className="text-blue-100 max-w-xl mx-auto">
                ลงทะเบียนวันนี้ เริ่มสร้างประวัติทักษะช่างบน Blockchain ที่โปร่งใส ตรวจสอบได้
              </p>
              <div className="flex gap-4 justify-center pt-2">
                <Link href="/register">
                  <Button size="lg" className="bg-white text-blue-700 hover:bg-blue-50 font-semibold px-8">
                    ลงทะเบียนเลย
                  </Button>
                </Link>
                <Link href="/login">
                  <Button size="lg" variant="outline" className="text-white border-2 border-white bg-white/10 hover:bg-white/20 font-semibold px-8">
                    เข้าสู่ระบบ
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t bg-card py-8">
        <div className="max-w-6xl mx-auto px-4 text-center text-sm text-muted-foreground space-y-2">
          <p className="font-medium text-foreground">กลุ่มใต้ร่มพระบารมี — มหาวิทยาลัยเทคโนโลยีราชมงคลล้านนา</p>
          <p>Powered by Next.js, Supabase &amp; TRON Blockchain (Nile Testnet)</p>
          <div className="flex justify-center gap-4 pt-2">
            <Link href="/admin/dashboard" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              Admin
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
