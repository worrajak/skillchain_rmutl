"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StaffSupervisorBadge } from "@/components/staff-supervisor-badge";
import { cn } from "@/lib/utils";
import { Briefcase, CheckCircle, XCircle, Calendar, User, Wallet, Loader2, ExternalLink, Eye, Shield } from "lucide-react";
import { toast } from "sonner";
import { ImageGallery } from "@/components/image-gallery";
import Link from "next/link";

const STATUS_TH: Record<string, { label: string; color: string }> = {
  ASSIGNED: { label: "มอบหมายแล้ว", color: "bg-blue-100 text-blue-800" },
  IN_PROGRESS: { label: "กำลังทำ", color: "bg-cyan-100 text-cyan-800" },
  SUBMITTED: { label: "ส่งงานแล้ว", color: "bg-yellow-100 text-yellow-800" },
  COMPLETED: { label: "เสร็จสิ้น", color: "bg-green-100 text-green-800" },
};

export default function StaffActiveJobsPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [releasing, setReleasing] = useState<string | null>(null);
  const supabase = createClient();

  async function loadJobs() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data } = await supabase
      .from("skc_jobs")
      .select("*, student:skc_users!skc_jobs_student_id_fkey(name), employer:skc_users!skc_jobs_employer_id_fkey(name)")
      .eq("approved_by_staff", user.id)
      .in("status", ["ASSIGNED", "IN_PROGRESS", "SUBMITTED", "COMPLETED"])
      .order("updated_at", { ascending: false });
    setJobs(data ?? []);
    setLoading(false);
  }

  useEffect(() => { loadJobs(); }, []);

  async function handleConfirm(jobId: string) {
    setConfirming(jobId);
    const res = await fetch(`/api/jobs/${jobId}/confirm-completion`, { method: "POST" });
    const data = await res.json();
    setConfirming(null);
    if (res.ok) { toast.success(data.message); loadJobs(); }
    else toast.error(data.error);
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
            <Briefcase className="size-5" />งานที่กำกับ ({jobs.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8"><div className="animate-spin size-6 border-4 border-purple-500 border-t-transparent rounded-full" /></div>
          ) : jobs.length > 0 ? (
            <div className="space-y-3">
              {jobs.map((job) => {
                const status = STATUS_TH[job.status] ?? { label: job.status, color: "bg-gray-100" };
                return (
                  <div key={job.id} className="rounded-lg border p-4 space-y-2">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="font-medium text-foreground">{job.title}</div>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium", status.color)}>{status.label}</span>
                          {job.pay_amount > 0 && <span className="text-xs text-green-700 font-medium">{job.pay_amount.toLocaleString()} TRPB</span>}
                          {job.warranty_status === "ACTIVE" && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 text-purple-800 px-2 py-0.5 text-xs">
                              <Shield className="size-3" />
                              ในประกัน
                            </span>
                          )}
                        </div>
                      </div>
                      <Link href={`/project-staff/jobs/${job.id}`}>
                        <Button size="sm" variant="outline" className="gap-1">
                          <Eye className="size-4" /> ดูรายละเอียด
                        </Button>
                      </Link>
                    </div>

                    <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><User className="size-3 text-blue-600" />นศ.: {job.student?.name ?? "-"}</span>
                      <span className="flex items-center gap-1"><User className="size-3 text-green-600" />ผู้จ้าง: {job.employer?.name ?? "-"}</span>
                      {job.work_start_date && (
                        <span className="flex items-center gap-1">
                          <Calendar className="size-3" />{new Date(job.work_start_date).toLocaleDateString("th-TH")} — {new Date(job.work_end_date).toLocaleDateString("th-TH")}
                        </span>
                      )}
                    </div>

                    {/* รูปภาพ — SUBMITTED/COMPLETED */}
                    {(job.status === "SUBMITTED" || job.status === "COMPLETED") && (
                      <div className="space-y-1">
                        <ImageGallery jobId={job.id} imageType="completion" label="รูปงานเสร็จ (นศ.)" />
                        <ImageGallery jobId={job.id} imageType="progress" label="รูประหว่างทำงาน" />
                      </div>
                    )}

                    {/* SUBMITTED — ปุ่มยืนยัน */}
                    {job.status === "SUBMITTED" && (
                      <div className="space-y-2 pt-1">
                        <div className="flex gap-4 text-xs">
                          <span className="flex items-center gap-1">
                            {job.staff_confirmed_completion ? <CheckCircle className="size-3 text-green-600" /> : <XCircle className="size-3 text-gray-300" />}
                            Staff
                          </span>
                          <span className="flex items-center gap-1">
                            {job.employer_confirmed_completion ? <CheckCircle className="size-3 text-green-600" /> : <XCircle className="size-3 text-gray-300" />}
                            ผู้ว่าจ้าง
                          </span>
                        </div>
                        {!job.staff_confirmed_completion && (
                          <Button size="sm" onClick={() => handleConfirm(job.id)} disabled={confirming === job.id} className="w-full">
                            <CheckCircle className="size-4 mr-1" />{confirming === job.id ? "กำลังยืนยัน..." : "ยืนยันงานเสร็จ"}
                          </Button>
                        )}
                        {job.staff_confirmed_completion && !job.employer_confirmed_completion && (
                          <p className="text-xs text-yellow-700 text-center">คุณยืนยันแล้ว — รอผู้ว่าจ้างยืนยัน</p>
                        )}
                      </div>
                    )}

                    {job.status === "COMPLETED" && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 rounded-lg p-2">
                          <CheckCircle className="size-3" />เสร็จสมบูรณ์
                        </div>
                        {job.type === "PAID" && job.pay_amount > 0 && !job.escrow_tx && (
                          <Button
                            size="sm"
                            onClick={async () => {
                              setReleasing(job.id);
                              const res = await fetch(`/api/jobs/${job.id}/release-escrow`, { method: "POST" });
                              const data = await res.json();
                              setReleasing(null);
                              if (res.ok) {
                                toast.success(`${data.message} — TX: ${data.tx_hash?.slice(0, 12)}...`);
                                loadJobs();
                              } else {
                                toast.error(data.error);
                              }
                            }}
                            disabled={releasing === job.id}
                            className="w-full bg-amber-600 hover:bg-amber-700"
                          >
                            {releasing === job.id
                              ? <><Loader2 className="size-4 mr-1 animate-spin" />กำลังจ่ายค่าจ้าง on-chain...</>
                              : <><Wallet className="size-4 mr-1" />จ่ายค่าจ้าง {job.pay_amount.toLocaleString()} TRPB</>}
                          </Button>
                        )}
                        {job.escrow_tx && (
                          <a
                            href={`https://nile.tronscan.org/#/transaction/${job.escrow_tx}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
                          >
                            <ExternalLink className="size-3" />จ่ายแล้ว — ดู TX บน TronScan
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">ไม่มีงานที่กำกับ</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
