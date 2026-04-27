import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { STATUS_LABELS, getNextAction, type GovStatus } from "@/lib/gov-workflow";

export default async function GovDashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("skc_users").select("role, first_name, last_name").eq("id", user.id).single();
  if (!profile || !["admin", "superadmin", "rmutl_staff", "project_staff", "teacher"].includes(profile.role)) {
    redirect("/");
  }

  // Pending action items across all stages
  const { data: pendingActivities } = await supabase
    .from("skc_activity_approvals")
    .select("*, job:skc_jobs(id, title)")
    .in("status", ["DRAFT", "PENDING_SIGNATURE"])
    .order("created_at", { ascending: false })
    .limit(10);

  const { data: pendingCerts } = await supabase
    .from("skc_jobs")
    .select("id, title, student_id, gov_status, updated_at")
    .in("gov_status", ["IN_PROGRESS", "WORK_CERTIFIED"])
    .order("updated_at", { ascending: false })
    .limit(10);

  const { data: pendingDisbursements } = await supabase
    .from("skc_disbursements")
    .select("*, activity:skc_activity_approvals(activity_title)")
    .in("status", ["DRAFT", "PENDING_SIGNATURE"])
    .order("created_at", { ascending: false })
    .limit(10);

  // Overview stats
  const { data: allJobs } = await supabase
    .from("skc_jobs")
    .select("gov_status")
    .not("gov_status", "is", null);

  const statusCounts: Record<string, number> = {};
  (allJobs || []).forEach((j: any) => {
    statusCounts[j.gov_status] = (statusCounts[j.gov_status] || 0) + 1;
  });

  return (
    <div className="container max-w-6xl mx-auto py-8 px-4">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">ระบบจัดการเอกสารราชการ</h1>
        <p className="text-muted-foreground mt-1">
          ติดตามสถานะเอกสารและดำเนินการตามขั้นตอนระเบียบราชการ — Government Workflow Dashboard
        </p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard title="รออนุมัติกิจกรรม" count={statusCounts.ACTIVITY_APPROVAL_PENDING || 0} variant="warning" />
        <StatCard title="อยู่ระหว่างปฏิบัติงาน" count={statusCounts.IN_PROGRESS || 0} variant="info" />
        <StatCard title="รอเบิกจ่าย" count={statusCounts.DISBURSEMENT_PENDING || 0} variant="warning" />
        <StatCard title="จ่ายแล้ว" count={statusCounts.PAID || 0} variant="success" />
      </div>

      {/* Quick Actions */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>🎯 Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Link href="/staff/gov/activity-approvals/new">
            <Button>➕ สร้างบันทึกขออนุมัติ</Button>
          </Link>
          <Link href="/staff/gov/disbursements/new">
            <Button variant="outline">💰 สร้างใบเบิก</Button>
          </Link>
          <Link href="/staff/gov/documents">
            <Button variant="outline">📄 เอกสารทั้งหมด</Button>
          </Link>
          <Link href="/staff/gov/workflow-log">
            <Button variant="outline">📋 Audit Log</Button>
          </Link>
        </CardContent>
      </Card>

      {/* Pending Activity Approvals */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>📝 บันทึกขออนุมัติกิจกรรม (รอดำเนินการ)</CardTitle>
        </CardHeader>
        <CardContent>
          {(pendingActivities || []).length === 0 ? (
            <p className="text-muted-foreground text-sm">ไม่มีบันทึกค้างดำเนินการ</p>
          ) : (
            <div className="space-y-2">
              {(pendingActivities || []).map((a: any) => (
                <Link key={a.id} href={`/staff/gov/activity-approvals/${a.id}`}>
                  <div className="flex justify-between items-center p-3 border rounded hover:bg-accent">
                    <div>
                      <div className="font-medium">{a.activity_title}</div>
                      <div className="text-xs text-muted-foreground">
                        งาน: {a.job?.title} · {a.num_students} คน · {a.total_hours} ชม. · {a.total_compensation} บาท
                      </div>
                    </div>
                    <Badge variant={a.status === "DRAFT" ? "secondary" : "default"}>
                      {a.status === "DRAFT" ? "ร่าง" : "รอลงนาม"}
                    </Badge>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pending Work Certifications */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>✅ ใบรับรองการปฏิบัติงาน (งานเสร็จแล้วรอจัดทำเอกสาร)</CardTitle>
        </CardHeader>
        <CardContent>
          {(pendingCerts || []).length === 0 ? (
            <p className="text-muted-foreground text-sm">ไม่มีงานรอรับรอง</p>
          ) : (
            <div className="space-y-2">
              {(pendingCerts || []).map((j: any) => {
                const nextAction = getNextAction(j.gov_status as GovStatus);
                return (
                  <Link key={j.id} href={`/staff/gov/jobs/${j.id}`}>
                    <div className="flex justify-between items-center p-3 border rounded hover:bg-accent">
                      <div>
                        <div className="font-medium">{j.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {nextAction ? `${nextAction.actor}: ${nextAction.action}` : STATUS_LABELS[j.gov_status as GovStatus]}
                        </div>
                      </div>
                      <Badge variant={nextAction?.urgency === "high" ? "destructive" : "secondary"}>
                        {STATUS_LABELS[j.gov_status as GovStatus]}
                      </Badge>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pending Disbursements */}
      <Card>
        <CardHeader>
          <CardTitle>💰 ใบเบิกค่าตอบแทน (รอดำเนินการ)</CardTitle>
        </CardHeader>
        <CardContent>
          {(pendingDisbursements || []).length === 0 ? (
            <p className="text-muted-foreground text-sm">ไม่มีใบเบิกค้าง</p>
          ) : (
            <div className="space-y-2">
              {(pendingDisbursements || []).map((d: any) => (
                <Link key={d.id} href={`/staff/gov/disbursements/${d.id}`}>
                  <div className="flex justify-between items-center p-3 border rounded hover:bg-accent">
                    <div>
                      <div className="font-medium">{d.disbursement_ref || `ใบเบิก #${d.id.slice(0, 8)}`}</div>
                      <div className="text-xs text-muted-foreground">
                        {d.activity?.activity_title} · {((d.items as any[]) || []).length} รายการ · รวม {Number(d.total_amount).toLocaleString("th-TH")} บาท
                      </div>
                    </div>
                    <Badge>{d.status}</Badge>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ title, count, variant }: { title: string; count: number; variant: "success" | "warning" | "info" | "default" }) {
  const colorMap = {
    success: "bg-green-50 text-green-900 border-green-200",
    warning: "bg-amber-50 text-amber-900 border-amber-200",
    info: "bg-blue-50 text-blue-900 border-blue-200",
    default: "bg-slate-50 text-slate-900 border-slate-200",
  };
  return (
    <div className={`p-4 rounded-lg border ${colorMap[variant]}`}>
      <div className="text-2xl font-bold">{count}</div>
      <div className="text-xs mt-1">{title}</div>
    </div>
  );
}
