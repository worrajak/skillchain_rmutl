"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Shield, Clock, AlertTriangle, CheckCircle, Eye } from "lucide-react";
import { cn } from "@/lib/utils";

const WARRANTY_STATUS: Record<string, { label: string; color: string }> = {
  NOT_STARTED: { label: "ยังไม่เริ่ม", color: "bg-gray-100 text-gray-800" },
  ACTIVE: { label: "อยู่ในประกัน", color: "bg-purple-100 text-purple-800" },
  CLAIMED: { label: "มี Claim", color: "bg-red-100 text-red-800" },
  EXPIRED: { label: "หมดประกัน", color: "bg-slate-100 text-slate-600" },
  CLOSED: { label: "ปิดงาน", color: "bg-green-100 text-green-800" },
};

export default function WarrantyDashboardPage() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [claims, setClaims] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  async function load() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    // Jobs in warranty assigned to this staff
    const { data: jobsData } = await supabase
      .from("skc_jobs")
      .select(`
        id, title, status, warranty_status, warranty_start_at, warranty_end_at, warranty_period_days,
        student:skc_users!skc_jobs_student_id_fkey(name),
        employer:skc_users!skc_jobs_employer_id_fkey(name)
      `)
      .eq("approved_by_staff", user.id)
      .in("warranty_status", ["ACTIVE", "CLAIMED"])
      .order("warranty_end_at", { ascending: true });
    setJobs(jobsData ?? []);

    // Open warranty claims for jobs supervised by this staff
    const { data: claimsData } = await supabase
      .from("skc_warranty_claims")
      .select(`
        *,
        job:skc_jobs!inner(id, title, approved_by_staff),
        claimer:skc_users!skc_warranty_claims_claimed_by_fkey(name)
      `)
      .in("status", ["OPEN", "IN_PROGRESS"])
      .eq("job.approved_by_staff", user.id)
      .order("claimed_at", { ascending: false });
    setClaims(claimsData ?? []);

    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  if (loading) return <div className="p-8 text-center">กำลังโหลด...</div>;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Shield className="size-6 text-purple-600" />
          Warranty Dashboard
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          ติดตามงานที่อยู่ในระยะประกัน + จัดการ warranty claims
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="py-4 text-center">
            <div className="text-2xl font-bold text-purple-600">{jobs.length}</div>
            <div className="text-xs text-muted-foreground">งานในประกัน</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <div className="text-2xl font-bold text-red-600">{claims.length}</div>
            <div className="text-xs text-muted-foreground">Open Claims</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <div className="text-2xl font-bold text-orange-600">
              {jobs.filter((j) => {
                if (!j.warranty_end_at) return false;
                const days = Math.ceil((new Date(j.warranty_end_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                return days >= 0 && days <= 2;
              }).length}
            </div>
            <div className="text-xs text-muted-foreground">ใกล้หมดประกัน</div>
          </CardContent>
        </Card>
      </div>

      {/* Open Claims */}
      {claims.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="size-5 text-red-600" />
              Warranty Claims ที่ต้องดำเนินการ ({claims.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {claims.map((c) => (
              <Link key={c.id} href={`/project-staff/jobs/${c.job_id}`}>
                <div className="border rounded p-3 hover:bg-accent text-sm space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="font-medium">{c.job?.title}</div>
                    <div className="flex gap-1">
                      <Badge variant="destructive">{c.claim_severity}</Badge>
                      <Badge>{c.status}</Badge>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    โดย {c.claimer?.name} · {new Date(c.claimed_at).toLocaleString("th-TH")}
                  </div>
                  <div className="text-xs">{c.claim_reason.slice(0, 120)}{c.claim_reason.length > 120 && "..."}</div>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Jobs in warranty */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">งานในระยะประกัน ({jobs.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {jobs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">ยังไม่มีงานในประกัน</p>
          ) : (
            <div className="space-y-2">
              {jobs.map((j) => {
                const wstatus = WARRANTY_STATUS[j.warranty_status] ?? WARRANTY_STATUS.NOT_STARTED;
                const daysLeft = j.warranty_end_at
                  ? Math.ceil((new Date(j.warranty_end_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                  : null;
                const urgent = daysLeft !== null && daysLeft >= 0 && daysLeft <= 2;

                return (
                  <Link key={j.id} href={`/project-staff/jobs/${j.id}`}>
                    <div className={cn(
                      "border rounded p-3 hover:bg-accent text-sm",
                      urgent && "border-orange-300 bg-orange-50"
                    )}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="font-medium">{j.title}</div>
                        <div className="flex gap-1 items-center">
                          <Badge className={cn(wstatus.color, "text-xs")}>{wstatus.label}</Badge>
                          {daysLeft !== null && daysLeft > 0 && (
                            <Badge variant="outline" className="text-xs">
                              <Clock className="size-3 mr-1" />
                              เหลือ {daysLeft} วัน
                            </Badge>
                          )}
                          {daysLeft !== null && daysLeft <= 0 && (
                            <Badge variant="outline" className="text-xs">
                              <CheckCircle className="size-3 mr-1" />
                              หมดแล้ว
                            </Badge>
                          )}
                          <Eye className="size-4 text-muted-foreground" />
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        นศ.: {j.student?.name ?? "-"} · ผู้จ้าง: {j.employer?.name ?? "-"}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
