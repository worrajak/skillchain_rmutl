import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Briefcase, ArrowLeft, Search } from "lucide-react";
import { HeroJobCard } from "@/components/hero-job-card";
import { rankJobs } from "@/lib/job-rank";

const TYPE_TH: Record<string, string> = { PAID: "งานจ้าง", VOLUNTEER: "จิตอาสา", TRAINING: "ฝึกทักษะ", EXEMPTED: "ยกเว้นค่าบริการ" };
const CAT_TH: Record<string, string> = { electrical: "ไฟฟ้า", hvac: "แอร์/เครื่องเย็น", automotive: "ยานยนต์", general: "ทั่วไป" };

export default async function PublicJobsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; category?: string }>;
}) {
  const { type, category } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("skc_jobs")
    .select("id, title, type, job_category, location, pay_amount, deadline, required_workers, employer:skc_users!skc_jobs_employer_id_fkey(name, organization, campus)")
    .eq("status", "OPEN")
    .order("created_at", { ascending: false });

  if (type) query = query.eq("type", type);
  if (category) query = query.eq("job_category", category);

  const { data: jobs } = await query;

  // Rank — pay 60% + urgency 30% + small-team 10%
  type JobRow = NonNullable<typeof jobs>[number];
  const rankedJobs = rankJobs<JobRow>((jobs ?? []) as JobRow[]);

  const buildUrl = (params: Record<string, string | undefined>) => {
    const sp = new URLSearchParams();
    if (params.type) sp.set("type", params.type);
    if (params.category) sp.set("category", params.category);
    const qs = sp.toString();
    return `/jobs${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="min-h-screen bg-muted/40">
      {/* Compact header — single-row billboard (same pattern as landing) */}
      <header className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white">
        <div className="max-w-6xl mx-auto px-4 py-3 md:py-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <Link href="/">
                <Button variant="ghost" size="sm" className="text-white/80 hover:text-white hover:bg-white/10 -ml-2">
                  <ArrowLeft className="size-4 mr-1" />กลับหน้าหลัก
                </Button>
              </Link>
              <div className="hidden sm:block w-px h-6 bg-white/20" />
              <div className="flex items-center gap-2 min-w-0">
                <Briefcase className="size-5 shrink-0" />
                <div className="min-w-0">
                  <h1 className="text-lg md:text-xl font-bold leading-tight truncate">ประกาศงานทั้งหมด</h1>
                  <p className="text-[11px] text-blue-200 leading-tight truncate">
                    {rankedJobs.length} งานที่กำลังเปิดรับ · เรียงตามค่าจ้าง + ใกล้กำหนด
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-2 shrink-0">
              <Link href="/login">
                <Button size="sm" className="bg-amber-400 hover:bg-amber-500 text-slate-900 font-semibold h-8 px-3 text-xs">
                  เข้าสู่ระบบ
                </Button>
              </Link>
              <Link href="/register">
                <Button size="sm" variant="outline" className="bg-white/10 hover:bg-white/20 text-white border-white/30 h-8 px-3 text-xs">
                  ลงทะเบียน
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Filters — compact chips */}
        <Card>
          <CardContent className="py-3 space-y-2.5">
            <div>
              <p className="text-[11px] text-muted-foreground mb-1.5 uppercase tracking-wide">ประเภทงาน</p>
              <div className="flex flex-wrap gap-1.5">
                <Link href={buildUrl({ category })}>
                  <Badge variant={!type ? "default" : "outline"} className="cursor-pointer text-xs">ทั้งหมด</Badge>
                </Link>
                {Object.entries(TYPE_TH).map(([key, label]) => (
                  <Link key={key} href={buildUrl({ type: type === key ? undefined : key, category })}>
                    <Badge variant={type === key ? "default" : "outline"} className="cursor-pointer text-xs">{label}</Badge>
                  </Link>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground mb-1.5 uppercase tracking-wide">หมวดหมู่</p>
              <div className="flex flex-wrap gap-1.5">
                <Link href={buildUrl({ type })}>
                  <Badge variant={!category ? "default" : "outline"} className="cursor-pointer text-xs">ทั้งหมด</Badge>
                </Link>
                {Object.entries(CAT_TH).map(([key, label]) => (
                  <Link key={key} href={buildUrl({ type, category: category === key ? undefined : key })}>
                    <Badge variant={category === key ? "default" : "outline"} className="cursor-pointer text-xs">{label}</Badge>
                  </Link>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Job Grid — HeroJobCard (same style as landing) */}
        {rankedJobs.length > 0 ? (
          <div
            className="
              flex sm:grid gap-3 md:gap-4
              overflow-x-auto sm:overflow-visible
              snap-x snap-mandatory sm:snap-none
              sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5
              -mx-4 px-4 sm:mx-0 sm:px-0
              pb-2 sm:pb-0
            "
          >
            {rankedJobs.map((job) => (
              <HeroJobCard
                key={job.id}
                job={job as Parameters<typeof HeroJobCard>[0]["job"]}
              />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <Search className="size-12 text-muted-foreground/30 mb-4" />
              <p className="font-medium text-foreground">ไม่พบงานที่ตรงเงื่อนไข</p>
              <p className="text-sm text-muted-foreground mt-1">ลองเปลี่ยนตัวกรอง หรือกลับมาดูใหม่ภายหลัง</p>
            </CardContent>
          </Card>
        )}

        {/* CTA Banner */}
        <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
          <CardContent className="py-5 text-center space-y-2">
            <h3 className="text-base md:text-lg font-semibold text-foreground">สนใจจ้างนักศึกษาช่าง?</h3>
            <p className="text-xs md:text-sm text-muted-foreground">
              ลงทะเบียนเป็นผู้ว่าจ้าง เพื่อประกาศงานและจ้างนักศึกษา มทร.ล้านนา
            </p>
            <div className="flex justify-center gap-2 pt-1">
              <Link href="/register"><Button size="sm">ลงทะเบียนผู้ว่าจ้าง</Button></Link>
              <Link href="/about"><Button size="sm" variant="outline">เกี่ยวกับระบบ</Button></Link>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
