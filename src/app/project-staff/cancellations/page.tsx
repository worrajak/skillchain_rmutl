"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { FileCheck, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";

const REASON_TH: Record<string, string> = {
  DISTANCE: "ระยะทาง", SAFETY: "ความปลอดภัย", TIMING: "เวลา", UNFAIR_PAY: "ค่าจ้างไม่เหมาะสม",
  STUDENT_UNAVAILABLE: "นศ.ไม่ว่าง", SCOPE_CHANGE: "เปลี่ยนขอบเขต", INAPPROPRIATE: "ไม่เหมาะสม", OTHER: "อื่นๆ",
};

export default function StaffCancellationsPage() {
  const [requests, setRequests] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  async function loadData() {
    setLoading(true);
    const { data } = await supabase.from("job_cancellation_requests")
      .select("*, job:jobs(title, status), requester:users!job_cancellation_requests_requested_by_fkey(name)")
      .eq("status", "PENDING")
      .order("created_at", { ascending: false });
    setRequests(data ?? []);
    setLoading(false);
  }

  useEffect(() => { loadData(); }, []);

  async function handleAction(req: Record<string, unknown>, action: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from("job_cancellation_requests").update({
      status: action,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    }).eq("id", req.id);

    if (action === "APPROVED") {
      const job = req.job as Record<string, unknown>;
      await supabase.from("jobs").update({ status: "CANCELLED" }).eq("id", req.job_id);
      // แจ้ง employer
      await supabase.from("notifications").insert({
        user_id: req.requested_by,
        type: "cancellation_approved",
        title: "คำขอยกเลิกได้รับอนุมัติ",
        body: `งาน "${String(job?.title)}" ถูกยกเลิกแล้ว`,
      });
    }

    toast.success(action === "APPROVED" ? "อนุมัติยกเลิกแล้ว" : "ปฏิเสธแล้ว");
    loadData();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-foreground flex items-center gap-2">
          <FileCheck className="size-5" />คำขอยกเลิกงาน ({requests.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8"><div className="animate-spin size-6 border-4 border-purple-500 border-t-transparent rounded-full" /></div>
        ) : requests.length > 0 ? (
          <div className="space-y-3">
            {requests.map((req) => (
              <div key={String(req.id)} className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <div className="font-medium text-sm text-foreground">{String((req.job as Record<string, unknown>)?.title)}</div>
                  <div className="text-xs text-muted-foreground">
                    โดย: {String((req.requester as Record<string, unknown>)?.name)} — เหตุผล: {REASON_TH[String(req.reason)] ?? req.reason}
                  </div>
                  {req.reason_detail ? <div className="text-xs text-muted-foreground mt-0.5">{String(req.reason_detail)}</div> : null}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => handleAction(req, "APPROVED")}><CheckCircle className="size-4 mr-1" />อนุมัติ</Button>
                  <Button size="sm" variant="outline" onClick={() => handleAction(req, "REJECTED")}><XCircle className="size-4 mr-1" />ปฏิเสธ</Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-muted-foreground py-8">ไม่มีคำขอ</p>
        )}
      </CardContent>
    </Card>
  );
}
