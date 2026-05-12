import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getCampusLabel } from "@/types/database";
import { MapPin, Clock, Wallet, User, Briefcase, ArrowLeft, Shield, Award } from "lucide-react";
import { StaffSupervisorBadge } from "@/components/staff-supervisor-badge";

const TYPE_TH: Record<string, string> = { PAID: "งานจ้าง", VOLUNTEER: "จิตอาสา", TRAINING: "ฝึกทักษะ", EXEMPTED: "ยกเว้นค่าบริการ" };
const CAT_TH: Record<string, string> = { electrical: "ไฟฟ้า", hvac: "แอร์/เครื่องเย็น", automotive: "ยานยนต์", general: "ทั่วไป" };
const STATUS_TH: Record<string, { label: string; color: string }> = {
  PENDING_REVIEW: { label: "รอพิจารณา", color: "bg-orange-100 text-orange-800" },
  OPEN: { label: "เปิดรับ", color: "bg-green-100 text-green-800" },
  ASSIGNED: { label: "มอบหมายแล้ว", color: "bg-blue-100 text-blue-800" },
  IN_PROGRESS: { label: "กำลังทำ", color: "bg-cyan-100 text-cyan-800" },
  SUBMITTED: { label: "ส่งงานแล้ว", color: "bg-yellow-100 text-yellow-800" },
  COMPLETED: { label: "เสร็จสิ้น", color: "bg-green-100 text-green-800" },
  CANCELLED: { label: "ยกเลิก", color: "bg-gray-100 text-gray-800" },
  DISPUTED: { label: "มีข้อพิพาท", color: "bg-red-100 text-red-800" },
};

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: job } = await supabase
    .from("skc_jobs")
    .select("*, employer:skc_users!skc_jobs_employer_id_fkey(name, email, organization, campus), student:skc_users!skc_jobs_student_id_fkey(name, email)")
    .eq("id", id)
    .single();

  if (!job) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted">
        <Card className="max-w-md text-center">
          <CardContent className="py-10 space-y-4">
            <Briefcase className="size-12 mx-auto text-muted-foreground/40" />
            <p className="font-medium text-foreground">ไม่พบงานนี้</p>
            <Link href="/"><Button variant="outline"><ArrowLeft className="size-4 mr-1" />กลับหน้าหลัก</Button></Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Get staff supervisor name separately (FK may not exist)
  let staffSupervisorName: string | null = null;
  if (job.approved_by_staff) {
    const { data: staff } = await supabase.from("skc_users").select("name").eq("id", job.approved_by_staff).single();
    staffSupervisorName = staff?.name ?? null;
  }

  const employer = job.employer as { name: string; email: string; organization: string | null; campus: string } | null;
  const student = job.student as { name: string; email: string } | null;
  const status = STATUS_TH[job.status] ?? { label: job.status, color: "bg-gray-100" };

  return (
    <div className="min-h-screen bg-muted">
      {/* Top bar */}
      <header className="bg-card border-b">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/">
            <Button variant="ghost" size="sm"><ArrowLeft className="size-4 mr-1" />กลับ</Button>
          </Link>
          <span className="text-sm text-muted-foreground">รายละเอียดงาน</span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div>
          <div className="flex items-center gap-3 mb-3">
            <span className={cn("inline-flex rounded-full px-3 py-1 text-sm font-medium", status.color)}>{status.label}</span>
            <Badge variant="outline">{TYPE_TH[job.type] ?? job.type}</Badge>
            <Badge variant="outline">{CAT_TH[job.job_category] ?? job.job_category}</Badge>
            {job.is_mentorship && <Badge variant="outline">ต้องมี Mentor</Badge>}
            <StaffSupervisorBadge name={staffSupervisorName} userId={job.approved_by_staff as string | null} />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">{job.title}</h1>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="md:col-span-2 space-y-6">
            <Card>
              <CardHeader><CardTitle className="text-foreground">รายละเอียดงาน</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{job.description}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-foreground">ข้อมูลงาน</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <MapPin className="size-4 text-muted-foreground" />
                  <div><div className="text-muted-foreground text-xs">สถานที่</div><div className="text-foreground">{job.location}</div></div>
                </div>
                <div className="flex items-center gap-2">
                  <Shield className="size-4 text-muted-foreground" />
                  <div><div className="text-muted-foreground text-xs">วิทยาเขต</div><div className="text-foreground">{getCampusLabel(String(job.campus))}</div></div>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="size-4 text-muted-foreground" />
                  <div><div className="text-muted-foreground text-xs">กำหนดส่ง</div><div className="text-foreground">{new Date(job.deadline).toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" })}</div></div>
                </div>
                {job.pay_amount > 0 && (
                  <div className="flex items-center gap-2">
                    <Wallet className="size-4 text-green-600" />
                    <div><div className="text-muted-foreground text-xs">ค่าจ้าง</div><div className="text-green-700 font-bold">{job.pay_amount.toLocaleString()} TRPB</div></div>
                  </div>
                )}
              </CardContent>
            </Card>

            {student && (
              <Card>
                <CardHeader><CardTitle className="text-foreground">นักศึกษาที่รับงาน</CardTitle></CardHeader>
                <CardContent>
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-full bg-blue-100 text-blue-700 font-bold">{student.name.charAt(0)}</div>
                    <div>
                      <div className="font-medium text-foreground">{student.name}</div>
                      <div className="text-xs text-muted-foreground">{student.email}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Employer Info */}
            <Card>
              <CardHeader><CardTitle className="text-foreground text-sm">ผู้ว่าจ้าง</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2">
                  <User className="size-4 text-muted-foreground" />
                  <span className="text-sm text-foreground">{employer?.name ?? "ไม่ระบุ"}</span>
                </div>
                {employer?.organization && (
                  <div className="flex items-center gap-2">
                    <Briefcase className="size-4 text-muted-foreground" />
                    <span className="text-sm text-foreground">{employer.organization}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <MapPin className="size-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">{getCampusLabel(String(employer?.campus ?? ""))}</span>
                </div>
              </CardContent>
            </Card>

            {/* CTA */}
            {job.status === "OPEN" && (
              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="py-4 text-center space-y-3">
                  <Award className="size-8 mx-auto text-blue-600" />
                  <p className="text-sm font-medium text-blue-800">สนใจงานนี้?</p>
                  <Link href="/login">
                    <Button className="w-full">เข้าสู่ระบบเพื่อสมัคร</Button>
                  </Link>
                  <Link href="/register">
                    <Button variant="outline" className="w-full">ลงทะเบียน</Button>
                  </Link>
                </CardContent>
              </Card>
            )}

            {/* Meta */}
            <Card>
              <CardContent className="py-3 text-xs text-muted-foreground space-y-1">
                <div>ลงเมื่อ: {new Date(job.created_at).toLocaleDateString("th-TH")}</div>
                <div>อัปเดต: {new Date(job.updated_at).toLocaleDateString("th-TH")}</div>
                {job.escrow_tx && <div className="font-mono">Escrow: {job.escrow_tx.slice(0, 12)}...</div>}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
