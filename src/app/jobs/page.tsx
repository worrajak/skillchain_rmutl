import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getCampusLabel } from "@/types/database";
import { MapPin, Clock, Wallet, Briefcase, ArrowLeft, Search } from "lucide-react";

const TYPE_TH: Record<string, string> = { PAID: "งานจ้าง", VOLUNTEER: "จิตอาสา", TRAINING: "ฝึกทักษะ", EXEMPTED: "ยกเว้นค่าบริการ" };
const CAT_TH: Record<string, string> = { electrical: "ไฟฟ้า", hvac: "แอร์/เครื่องเย็น", automotive: "ยานยนต์", general: "ทั่วไป" };

const TYPE_COLORS: Record<string, string> = {
  PAID: "bg-green-100 text-green-800",
  VOLUNTEER: "bg-purple-100 text-purple-800",
  TRAINING: "bg-blue-100 text-blue-800",
  EXEMPTED: "bg-amber-100 text-amber-800",
};

export default async function PublicJobsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; category?: string }>;
}) {
  const { type, category } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("jobs")
    .select("*, employer:users!jobs_employer_id_fkey(name, organization, campus)")
    .eq("status", "OPEN")
    .order("created_at", { ascending: false });

  if (type) query = query.eq("type", type);
  if (category) query = query.eq("job_category", category);

  const { data: jobs } = await query;

  const buildUrl = (params: Record<string, string | undefined>) => {
    const sp = new URLSearchParams();
    if (params.type) sp.set("type", params.type);
    if (params.category) sp.set("category", params.category);
    const qs = sp.toString();
    return `/jobs${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="min-h-screen bg-muted">
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white">
        <div className="max-w-5xl mx-auto px-4 py-6">
          <div className="flex items-center gap-3 mb-4">
            <Link href="/">
              <Button variant="ghost" size="sm" className="text-white/80 hover:text-white hover:bg-white/10">
                <ArrowLeft className="size-4 mr-1" />กลับหน้าหลัก
              </Button>
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <Briefcase className="size-8" />
            <div>
              <h1 className="text-2xl font-bold">ประกาศงานทั้งหมด</h1>
              <p className="text-sm text-blue-200 mt-0.5">ดูลักษณะงานที่สามารถจ้างนักศึกษาช่าง มทร.ล้านนา ได้</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Filters */}
        <Card>
          <CardContent className="py-4 space-y-3">
            {/* Type filter */}
            <div>
              <p className="text-xs text-muted-foreground mb-2">ประเภทงาน</p>
              <div className="flex flex-wrap gap-2">
                <Link href={buildUrl({ category })}>
                  <Badge variant={!type ? "default" : "outline"} className="cursor-pointer">ทั้งหมด</Badge>
                </Link>
                {Object.entries(TYPE_TH).map(([key, label]) => (
                  <Link key={key} href={buildUrl({ type: type === key ? undefined : key, category })}>
                    <Badge variant={type === key ? "default" : "outline"} className="cursor-pointer">{label}</Badge>
                  </Link>
                ))}
              </div>
            </div>
            {/* Category filter */}
            <div>
              <p className="text-xs text-muted-foreground mb-2">หมวดหมู่</p>
              <div className="flex flex-wrap gap-2">
                <Link href={buildUrl({ type })}>
                  <Badge variant={!category ? "default" : "outline"} className="cursor-pointer">ทั้งหมด</Badge>
                </Link>
                {Object.entries(CAT_TH).map(([key, label]) => (
                  <Link key={key} href={buildUrl({ type, category: category === key ? undefined : key })}>
                    <Badge variant={category === key ? "default" : "outline"} className="cursor-pointer">{label}</Badge>
                  </Link>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results count */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            พบ <span className="font-semibold text-foreground">{jobs?.length ?? 0}</span> งาน
          </p>
          <div className="flex gap-2">
            <Link href="/login">
              <Button size="sm">เข้าสู่ระบบ</Button>
            </Link>
            <Link href="/register">
              <Button size="sm" variant="outline">ลงทะเบียน</Button>
            </Link>
          </div>
        </div>

        {/* Job Grid */}
        {jobs && jobs.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2">
            {jobs.map((job) => {
              const employer = job.employer as { name: string; organization: string | null; campus: string } | null;
              return (
                <Link key={job.id} href={`/jobs/${job.id}`}>
                  <Card className="h-full hover:shadow-md transition-shadow cursor-pointer">
                    <CardContent className="p-4 space-y-3">
                      {/* Badges */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium", TYPE_COLORS[job.type] ?? "bg-gray-100 text-gray-800")}>
                          {TYPE_TH[job.type] ?? job.type}
                        </span>
                        <Badge variant="outline" className="text-xs">{CAT_TH[job.job_category] ?? job.job_category}</Badge>
                        {job.is_mentorship && <Badge variant="outline" className="text-xs">ต้องมี Mentor</Badge>}
                      </div>

                      {/* Title */}
                      <h3 className="font-semibold text-foreground line-clamp-2">{job.title}</h3>

                      {/* Description */}
                      <p className="text-sm text-muted-foreground line-clamp-2">{job.description}</p>

                      {/* Info row */}
                      <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1">
                          <MapPin className="size-3" />{getCampusLabel(String(job.campus))}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="size-3" />{new Date(job.deadline).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })}
                        </span>
                        {job.pay_amount > 0 && (
                          <span className="flex items-center gap-1 text-green-600 font-semibold">
                            <Wallet className="size-3" />{job.pay_amount.toLocaleString()} TRPB
                          </span>
                        )}
                      </div>

                      {/* Employer */}
                      <div className="pt-2 border-t text-xs text-muted-foreground">
                        ผู้ว่าจ้าง: <span className="text-foreground font-medium">{employer?.name ?? "ไม่ระบุ"}</span>
                        {employer?.organization && <span> · {employer.organization}</span>}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
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
          <CardContent className="py-6 text-center space-y-3">
            <h3 className="text-lg font-semibold text-foreground">สนใจจ้างนักศึกษาช่าง?</h3>
            <p className="text-sm text-muted-foreground">ลงทะเบียนเป็นผู้ว่าจ้าง เพื่อประกาศงานและจ้างนักศึกษา มทร.ล้านนา</p>
            <div className="flex justify-center gap-3">
              <Link href="/register"><Button>ลงทะเบียนผู้ว่าจ้าง</Button></Link>
              <Link href="/about"><Button variant="outline">เกี่ยวกับระบบ</Button></Link>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
