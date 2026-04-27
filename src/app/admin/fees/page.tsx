"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Settings, Users, Briefcase, GraduationCap, Shield, Save } from "lucide-react";
import { toast } from "sonner";
import { calculateFeeBreakdown, formatTRPB } from "@/lib/tron/client";

export default function AdminFeesPage() {
  const [studentBps, setStudentBps] = useState(8500);
  const [fundBps, setFundBps] = useState(500);
  const [mentorBps, setMentorBps] = useState(500);
  const [staffBps, setStaffBps] = useState(500);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [previewAmount, setPreviewAmount] = useState(1000);
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from("skc_fee_config").select("*").limit(1).single();
      if (data) {
        setStudentBps(data.student_bps);
        setFundBps(data.fund_bps);
        setMentorBps(data.mentor_bps);
        setStaffBps(data.staff_bps);
      }
      setLoading(false);
    }
    load();
  }, []);

  const total = studentBps + fundBps + mentorBps + staffBps;
  const isValid = total === 10000;
  const preview = calculateFeeBreakdown(previewAmount, true);

  async function handleSave() {
    if (!isValid) { toast.error("ผลรวมต้องเป็น 100%"); return; }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { data: existing } = await supabase.from("skc_fee_config").select("id").limit(1).single();

    if (existing) {
      await supabase.from("skc_fee_config").update({
        student_bps: studentBps, fund_bps: fundBps, mentor_bps: mentorBps, staff_bps: staffBps,
        updated_by: user?.id, updated_at: new Date().toISOString(),
      }).eq("id", existing.id);
    } else {
      await supabase.from("skc_fee_config").insert({
        student_bps: studentBps, fund_bps: fundBps, mentor_bps: mentorBps, staff_bps: staffBps,
        updated_by: user?.id,
      });
    }

    setSaving(false);
    toast.success("บันทึก Fee สำเร็จ");
  }

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin size-8 border-4 border-blue-500 border-t-transparent rounded-full" /></div>;

  const feeItems = [
    { label: "นักศึกษา", icon: GraduationCap, value: studentBps, setter: setStudentBps, color: "text-blue-600", bg: "bg-blue-100" },
    { label: "กองทุนกลาง", icon: Briefcase, value: fundBps, setter: setFundBps, color: "text-green-600", bg: "bg-green-100" },
    { label: "Mentor (พี่เลี้ยง)", icon: Users, value: mentorBps, setter: setMentorBps, color: "text-orange-600", bg: "bg-orange-100" },
    { label: "คณะทำงาน", icon: Shield, value: staffBps, setter: setStaffBps, color: "text-purple-600", bg: "bg-purple-100" },
  ];

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
            <Settings className="size-5" />ตั้งค่า Fee — TRPB Coin
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-sm text-muted-foreground">
            กำหนดสัดส่วนการแบ่งค่าจ้าง (TRPB) เมื่องาน PAID เสร็จ — ผลรวมต้อง = 100%
          </p>

          {feeItems.map((f) => (
            <div key={f.label} className="flex items-center gap-4">
              <div className={cn("flex size-10 items-center justify-center rounded-xl shrink-0", f.bg)}>
                <f.icon className={cn("size-5", f.color)} />
              </div>
              <div className="flex-1">
                <Label className="text-foreground text-sm">{f.label}</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Input
                    type="number"
                    value={f.value / 100}
                    onChange={(e) => f.setter(Math.round(parseFloat(e.target.value || "0") * 100))}
                    min={0}
                    max={100}
                    step={0.5}
                    className="w-24"
                  />
                  <span className="text-sm text-muted-foreground">%</span>
                  <div className="flex-1 h-3 rounded-full bg-muted overflow-hidden">
                    <div className={cn("h-full rounded-full", f.bg)} style={{ width: `${f.value / 100}%` }} />
                  </div>
                </div>
              </div>
            </div>
          ))}

          <div className={cn("flex items-center justify-between p-3 rounded-lg", isValid ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800")}>
            <span className="font-medium text-sm">ผลรวม: {(total / 100).toFixed(1)}%</span>
            {isValid ? <span className="text-xs">✓ ถูกต้อง</span> : <span className="text-xs">✗ ต้องรวมเป็น 100%</span>}
          </div>

          <Button onClick={handleSave} disabled={!isValid || saving} className="w-full">
            <Save className="size-4 mr-2" />{saving ? "กำลังบันทึก..." : "บันทึก"}
          </Button>
        </CardContent>
      </Card>

      {/* Preview */}
      <Card>
        <CardHeader><CardTitle className="text-foreground text-sm">ตัวอย่างการแบ่ง</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <Label className="text-foreground text-sm">ค่าจ้าง:</Label>
            <Input type="number" value={previewAmount} onChange={(e) => setPreviewAmount(parseInt(e.target.value) || 0)} className="w-32" />
            <span className="text-sm text-muted-foreground">TRPB</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-blue-50 p-3 text-center">
              <div className="font-bold text-blue-700">{formatTRPB(preview.student)}</div>
              <div className="text-[11px] text-muted-foreground">นักศึกษา ({studentBps / 100}%)</div>
            </div>
            <div className="rounded-lg bg-green-50 p-3 text-center">
              <div className="font-bold text-green-700">{formatTRPB(preview.fund)}</div>
              <div className="text-[11px] text-muted-foreground">กองทุน ({fundBps / 100}%)</div>
            </div>
            <div className="rounded-lg bg-orange-50 p-3 text-center">
              <div className="font-bold text-orange-700">{formatTRPB(preview.mentor)}</div>
              <div className="text-[11px] text-muted-foreground">Mentor ({mentorBps / 100}%)</div>
            </div>
            <div className="rounded-lg bg-purple-50 p-3 text-center">
              <div className="font-bold text-purple-700">{formatTRPB(preview.staff)}</div>
              <div className="text-[11px] text-muted-foreground">คณะทำงาน ({staffBps / 100}%)</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
