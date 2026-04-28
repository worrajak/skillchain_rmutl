"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ShieldAlert, Clock, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface Props {
  jobId: string;
  jobTitle: string;
  warrantyEndAt?: string | null;
  warrantyStatus?: string;
}

export default function WarrantyClaimForm({ jobId, jobTitle, warrantyEndAt, warrantyStatus }: Props) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [severity, setSeverity] = useState<"MINOR" | "MAJOR" | "CRITICAL">("MINOR");
  const [submitting, setSubmitting] = useState(false);

  const daysLeft = warrantyEndAt
    ? Math.ceil((new Date(warrantyEndAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  const canClaim = warrantyStatus === "ACTIVE" && daysLeft !== null && daysLeft > 0;

  async function handleSubmit() {
    if (!reason.trim()) {
      toast.error("กรุณาอธิบายปัญหา");
      return;
    }

    setSubmitting(true);
    const res = await fetch("/api/warranty-claims", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ job_id: jobId, claim_reason: reason, claim_severity: severity }),
    });
    const data = await res.json();
    setSubmitting(false);

    if (!res.ok) {
      toast.error(data.error ?? "เปิด Claim ไม่สำเร็จ");
      return;
    }

    toast.success("เปิด Warranty Claim เรียบร้อย — เจ้าหน้าที่จะติดต่อกลับเร็วๆ นี้");
    setOpen(false);
    setReason("");
    setSeverity("MINOR");
  }

  if (!canClaim && warrantyStatus !== "ACTIVE") return null;

  return (
    <Card className={daysLeft !== null && daysLeft <= 2 ? "border-orange-200 bg-orange-50" : "border-purple-200 bg-purple-50"}>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <ShieldAlert className="size-5 text-purple-600" />
          การประกันงาน
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex items-center gap-2">
          <Clock className="size-4 text-purple-600" />
          เหลือเวลาประกัน <strong>{daysLeft} วัน</strong>
          {warrantyEndAt && (
            <span className="text-muted-foreground">
              (ถึง {new Date(warrantyEndAt).toLocaleDateString("th-TH")})
            </span>
          )}
        </div>

        <div className="text-xs text-muted-foreground">
          💡 หากพบปัญหากับงานที่ทำเสร็จ — สามารถเปิด <strong>Warranty Claim</strong> ให้ช่างกลับมาแก้ไขฟรี
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger
            disabled={!canClaim}
            className="inline-flex items-center justify-center gap-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-medium shadow-xs transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50"
          >
            <AlertTriangle className="size-4 mr-1" />
            เปิด Warranty Claim
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>เปิด Warranty Claim — {jobTitle}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>ความรุนแรง</Label>
                <div className="grid grid-cols-3 gap-2 mt-1">
                  {(["MINOR", "MAJOR", "CRITICAL"] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSeverity(s)}
                      className={`rounded border p-2 text-sm ${severity === s
                        ? s === "CRITICAL" ? "bg-red-600 text-white border-red-600"
                        : s === "MAJOR" ? "bg-orange-500 text-white border-orange-500"
                        : "bg-blue-500 text-white border-blue-500"
                        : "hover:bg-accent"
                      }`}
                    >
                      {s === "MINOR" ? "เล็กน้อย" : s === "MAJOR" ? "ปานกลาง" : "ฉุกเฉิน"}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label>อธิบายปัญหาที่พบ *</Label>
                <Textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={4}
                  placeholder="เช่น แอร์เริ่มมีเสียงดังหลังจากซ่อม 3 วัน, ไฟฟ้าตกบ่อยในห้องที่เพิ่งเดินสาย"
                />
              </div>

              <div className="text-xs text-muted-foreground bg-blue-50 p-2 rounded">
                💡 หลังเปิด Claim:
                <br />• Staff supervisor + นศ. + พี่เลี้ยง จะได้รับแจ้งเตือนทันที
                <br />• ระบบจะหยุดนาฬิกาประกัน — เริ่มใหม่หลังแก้ไขเสร็จ
                <br />• ไม่มีค่าใช้จ่ายเพิ่ม — เป็นการรับประกันงาน
              </div>

              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setOpen(false)}>ยกเลิก</Button>
                <Button onClick={handleSubmit} disabled={submitting || !reason.trim()}>
                  {submitting ? "กำลังบันทึก..." : "ยืนยัน Claim"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
