"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { UserCheck, XCircle, CheckCircle } from "lucide-react";
import { UserAvatar } from "@/components/avatar-upload";
import { toast } from "sonner";

export default function StaffApprovalsPage() {
  const [requests, setRequests] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewNote, setReviewNote] = useState("");
  const supabase = createClient();

  async function loadRequests() {
    setLoading(true);
    const { data } = await supabase.from("skc_job_assignment_requests")
      .select("*, student:skc_users!skc_job_assignment_requests_student_id_fkey(name, email, faculty, student_id_card, avatar_url), job:skc_jobs(id, title, type, job_category, location, campus, pay_amount)")
      .eq("status", "PENDING")
      .order("created_at", { ascending: false });
    setRequests(data ?? []);
    setLoading(false);
  }

  useEffect(() => { loadRequests(); }, []);

  async function handleAction(req: Record<string, unknown>, action: string) {
    const job = req.job as Record<string, unknown>;
    const res = await fetch(`/api/jobs/${job.id}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ request_id: req.id, action, review_note: reviewNote }),
    });
    if (res.ok) {
      toast.success(action === "APPROVED" ? "อนุมัติแล้ว" : "ปฏิเสธแล้ว");
      setReviewNote("");
      loadRequests();
    } else {
      const err = await res.json();
      toast.error(err.error);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
            <UserCheck className="size-5" />คำขอรับงาน ({requests.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8"><div className="animate-spin size-6 border-4 border-purple-500 border-t-transparent rounded-full" /></div>
          ) : requests.length > 0 ? (
            <div className="space-y-4">
              {requests.map((req) => {
                const student = req.student as Record<string, unknown>;
                const job = req.job as Record<string, unknown>;
                return (
                  <div key={String(req.id)} className="rounded-lg border p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <UserAvatar url={student?.avatar_url as string | null} name={String(student?.name)} size="sm" />
                        <div>
                          <div className="font-medium text-foreground">{String(student?.name)} ({String(student?.student_id_card ?? student?.email)})</div>
                          <div className="text-xs text-muted-foreground">{String(student?.faculty ?? "")}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium text-sm text-foreground">{String(job?.title)}</div>
                        <div className="text-xs text-muted-foreground">{String(job?.type)} · {String(job?.location)} · {Number(job?.pay_amount) > 0 ? `${Number(job?.pay_amount)} TRPB` : "ไม่มีค่าจ้าง"}</div>
                      </div>
                    </div>
                    <Textarea placeholder="หมายเหตุ (ไม่บังคับ)" value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} rows={2} />
                    <div className="flex gap-2">
                      <Button size="sm" className="flex-1" onClick={() => handleAction(req, "APPROVED")}>
                        <CheckCircle className="size-4 mr-1" />อนุมัติ
                      </Button>
                      <Button size="sm" variant="outline" className="flex-1 text-red-600" onClick={() => handleAction(req, "REJECTED")}>
                        <XCircle className="size-4 mr-1" />ปฏิเสธ
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">ไม่มีคำขอรอ</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
