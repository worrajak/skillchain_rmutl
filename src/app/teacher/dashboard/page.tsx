import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GraduationCap, ClipboardList, Users, Clock } from "lucide-react";

export default async function TeacherDashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("skc_users")
    .select("role, name")
    .eq("id", user.id)
    .single();

  if (!profile || !["teacher", "admin", "superadmin"].includes(profile.role)) {
    redirect("/");
  }

  const { count: pendingCount } = await supabase
    .from("skc_jobs")
    .select("id", { count: "exact", head: true })
    .in("status", ["SUBMITTED"]);

  return (
    <div className="container max-w-4xl mx-auto py-8 px-4 space-y-6">
      <div className="flex items-center gap-3">
        <GraduationCap className="size-8 text-blue-600" />
        <div>
          <h1 className="text-2xl font-bold">สวัสดี, {profile.name}</h1>
          <p className="text-sm text-muted-foreground">หน้าหลักสำหรับอาจารย์ผู้ประเมิน</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link href="/teacher/evaluation">
          <Card className="hover:border-blue-300 hover:shadow-sm transition-all cursor-pointer h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <ClipboardList className="size-5 text-blue-600" />
                ประเมินผลงาน
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{pendingCount ?? 0}</p>
              <p className="text-xs text-muted-foreground">งานที่รอประเมิน</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/teacher/students">
          <Card className="hover:border-blue-300 hover:shadow-sm transition-all cursor-pointer h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="size-5 text-green-600" />
                นักศึกษาในความดูแล
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">ดูรายชื่อ + ผลงาน + คะแนน</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/teacher/pending">
          <Card className="hover:border-blue-300 hover:shadow-sm transition-all cursor-pointer h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="size-5 text-orange-600" />
                รออนุมัติ
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">รายการที่ต้องดำเนินการ</p>
            </CardContent>
          </Card>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">ทางลัด</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Link href="/teacher/evaluation"><Button variant="outline" size="sm">ประเมินงาน</Button></Link>
          <Link href="/teacher/students"><Button variant="outline" size="sm">นักศึกษา</Button></Link>
          <Link href="/teacher/pending"><Button variant="outline" size="sm">งานค้าง</Button></Link>
        </CardContent>
      </Card>
    </div>
  );
}
