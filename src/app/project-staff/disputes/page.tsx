"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { AlertTriangle, CheckCircle, Clock, Gavel, Shield } from "lucide-react";
import { toast } from "sonner";

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  RAISED: { label: "แจ้งใหม่", color: "bg-red-100 text-red-800" },
  UNDER_REVIEW: { label: "กำลังตรวจสอบ", color: "bg-yellow-100 text-yellow-800" },
  MEDIATION: { label: "ไกล่เกลี่ย", color: "bg-blue-100 text-blue-800" },
  RESOLVED_STUDENT_FAVOR: { label: "ตัดสิน: ฝ่าย นศ.", color: "bg-green-100 text-green-800" },
  RESOLVED_EMPLOYER_FAVOR: { label: "ตัดสิน: ฝ่ายผู้จ้าง", color: "bg-green-100 text-green-800" },
  RESOLVED_COMPROMISE: { label: "ประนีประนอม", color: "bg-green-100 text-green-800" },
  ESCALATED: { label: "ส่งต่อผู้บริหาร", color: "bg-purple-100 text-purple-800" },
  CLOSED: { label: "ปิดแล้ว", color: "bg-gray-100 text-gray-800" },
};

const CATEGORY_TH: Record<string, string> = {
  SKILL_INSUFFICIENT: "ทักษะไม่พอ", SCOPE_CHANGED: "เปลี่ยนขอบเขต", DANGER_RISK: "อันตราย",
  PAY_DISPUTE: "ค่าจ้าง", QUALITY_ISSUE: "คุณภาพ", NO_SHOW: "ไม่มาทำงาน", HARASSMENT: "ล่วงละเมิด", OTHER: "อื่นๆ",
};

export default function AdminDisputesPage() {
  const [disputes, setDisputes] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolveOpen, setResolveOpen] = useState(false);
  const [selected, setSelected] = useState<Record<string, unknown> | null>(null);
  const [resolution, setResolution] = useState("");
  const [resolveStatus, setResolveStatus] = useState("RESOLVED_COMPROMISE");

  const supabase = createClient();

  async function loadDisputes() {
    setLoading(true);
    const { data } = await supabase.from("disputes")
      .select("*, job:jobs(title), raised_by_user:users!disputes_raised_by_fkey(name), raised_against_user:users!disputes_raised_against_fkey(name)")
      .order("created_at", { ascending: false });
    setDisputes(data ?? []);
    setLoading(false);
  }

  useEffect(() => { loadDisputes(); }, []);

  async function handleResolve() {
    if (!selected || !resolution) return;
    const res = await fetch(`/api/disputes/${selected.id}/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: resolveStatus, resolution }),
    });
    if (res.ok) {
      toast.success("ตัดสินสำเร็จ");
      setResolveOpen(false);
      setResolution("");
      loadDisputes();
    } else {
      const err = await res.json();
      toast.error(err.error);
    }
  }

  const pending = disputes.filter((d) => ["RAISED", "UNDER_REVIEW", "MEDIATION"].includes(String(d.status)));
  const resolved = disputes.filter((d) => !["RAISED", "UNDER_REVIEW", "MEDIATION"].includes(String(d.status)));

  return (
    <div className="space-y-6">
      {pending.length > 0 && (
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <AlertTriangle className="size-5 text-red-500" />รอตัดสิน ({pending.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pending.map((d) => (
              <div key={String(d.id)} className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <div className="font-medium text-sm text-foreground">
                    {String((d.job as Record<string, unknown>)?.title ?? "-")}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {CATEGORY_TH[String(d.category)] ?? d.category} — {String((d.raised_by_user as Record<string, unknown>)?.name)} → {String((d.raised_against_user as Record<string, unknown>)?.name)}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 line-clamp-1">{String(d.description)}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium", STATUS_CONFIG[String(d.status)]?.color ?? "")}>
                    {STATUS_CONFIG[String(d.status)]?.label}
                  </span>
                  <Button size="sm" onClick={() => { setSelected(d); setResolveOpen(true); }}>
                    <Gavel className="size-4 mr-1" />ตัดสิน
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {resolved.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <CheckCircle className="size-5 text-green-500" />ตัดสินแล้ว ({resolved.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {resolved.map((d) => (
              <div key={String(d.id)} className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <div className="font-medium text-sm text-foreground">{String((d.job as Record<string, unknown>)?.title ?? "-")}</div>
                  <div className="text-xs text-muted-foreground">{CATEGORY_TH[String(d.category)]} — {String(d.resolution ?? "").slice(0, 80)}</div>
                </div>
                <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium", STATUS_CONFIG[String(d.status)]?.color ?? "")}>
                  {STATUS_CONFIG[String(d.status)]?.label}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {disputes.length === 0 && !loading && (
        <Card className="text-center py-12">
          <CardContent>
            <Shield className="size-12 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-foreground font-medium">ไม่มีข้อพิพาท</p>
          </CardContent>
        </Card>
      )}

      {/* Resolve Dialog */}
      <Dialog open={resolveOpen} onOpenChange={setResolveOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="text-foreground">ตัดสินข้อพิพาท</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="text-sm">
                <span className="text-muted-foreground">งาน:</span> <span className="text-foreground font-medium">{String((selected.job as Record<string, unknown>)?.title)}</span>
              </div>
              <div className="text-sm">
                <span className="text-muted-foreground">หมวด:</span> {CATEGORY_TH[String(selected.category)]}
              </div>
              <div className="text-sm">
                <span className="text-muted-foreground">รายละเอียด:</span> <span className="text-foreground">{String(selected.description)}</span>
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">ผลการตัดสิน</Label>
                <Select value={resolveStatus} onValueChange={(v) => v && setResolveStatus(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="RESOLVED_STUDENT_FAVOR">ฝ่าย นศ. ชนะ</SelectItem>
                    <SelectItem value="RESOLVED_EMPLOYER_FAVOR">ฝ่ายผู้จ้าง ชนะ</SelectItem>
                    <SelectItem value="RESOLVED_COMPROMISE">ประนีประนอม</SelectItem>
                    <SelectItem value="ESCALATED">ส่งต่อผู้บริหาร</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">เหตุผลประกอบการตัดสิน</Label>
                <Textarea value={resolution} onChange={(e) => setResolution(e.target.value)} rows={4} placeholder="อธิบายเหตุผลและเงื่อนไข..." />
              </div>
              <div className="flex gap-3">
                <Button onClick={handleResolve} className="flex-1" disabled={!resolution}><Gavel className="size-4 mr-1" />ยืนยัน</Button>
                <Button variant="outline" onClick={() => setResolveOpen(false)}>ยกเลิก</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
