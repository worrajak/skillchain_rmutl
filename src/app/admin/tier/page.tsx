"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { GraduationCap, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { getCampusLabel } from "@/types/database";

const TIER_CONFIG: Record<string, { label: string; color: string }> = {
  trainee: { label: "Trainee (ฝึกหัด)", color: "bg-gray-100 text-gray-700" },
  apprentice: { label: "Apprentice (ช่างฝึกงาน)", color: "bg-blue-100 text-blue-700" },
  certified: { label: "Certified (ช่างรับรอง)", color: "bg-green-100 text-green-700" },
};

export default function AdminTierPage() {
  const [students, setStudents] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  async function loadData() {
    setLoading(true);
    const { data } = await supabase.from("skc_users")
      .select("id, name, email, campus, faculty")
      .eq("role", "student")
      .order("name");

    if (!data) { setLoading(false); return; }

    const { data: tiers } = await supabase.from("skc_student_tiers").select("*");
    const tierMap = new Map<string, Record<string, unknown>>();
    (tiers ?? []).forEach((t) => tierMap.set(String(t.student_id), t));

    setStudents(data.map((s) => ({
      ...s,
      tier: tierMap.get(s.id)?.tier ?? "trainee",
      training_jobs: tierMap.get(s.id)?.training_jobs_completed ?? 0,
      avg_mentor: tierMap.get(s.id)?.avg_mentor_score ?? 0,
      safety: tierMap.get(s.id)?.safety_incidents ?? 0,
    })));
    setLoading(false);
  }

  useEffect(() => { loadData(); }, []);

  async function handlePromote(studentId: string, currentTier: string) {
    const next = currentTier === "trainee" ? "apprentice" : currentTier === "apprentice" ? "certified" : null;
    if (!next) { toast.error("ระดับสูงสุดแล้ว"); return; }

    const { data: existing } = await supabase.from("skc_student_tiers").select("id").eq("student_id", studentId).single();

    if (existing) {
      await supabase.from("skc_student_tiers").update({ tier: next, promoted_at: new Date().toISOString() }).eq("student_id", studentId);
    } else {
      await supabase.from("skc_student_tiers").insert({ student_id: studentId, tier: next, promoted_at: new Date().toISOString() });
    }

    toast.success(`เลื่อนเป็น ${TIER_CONFIG[next]?.label} สำเร็จ`);
    loadData();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-foreground flex items-center gap-2">
          <GraduationCap className="size-5" />Student Tier ({students.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8"><div className="animate-spin size-6 border-4 border-blue-500 border-t-transparent rounded-full" /></div>
        ) : students.length > 0 ? (
          <div className="space-y-3">
            {students.map((s) => (
              <div key={String(s.id)} className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <div className="font-medium text-sm text-foreground">{String(s.name)}</div>
                  <div className="text-xs text-muted-foreground">{String(s.email)} · {getCampusLabel(String(s.campus))}</div>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    <span>งานฝึก: {String(s.training_jobs)}</span>
                    <span>คะแนน Mentor: {Number(s.avg_mentor).toFixed(1)}</span>
                    <span>เหตุการณ์: {String(s.safety)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium", TIER_CONFIG[String(s.tier)]?.color ?? "")}>
                    {TIER_CONFIG[String(s.tier)]?.label ?? s.tier}
                  </span>
                  {String(s.tier) !== "certified" && (
                    <Button size="sm" variant="outline" onClick={() => handlePromote(String(s.id), String(s.tier))}>
                      <TrendingUp className="size-4 mr-1" />เลื่อน
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-muted-foreground py-8">ไม่มีนักศึกษา</p>
        )}
      </CardContent>
    </Card>
  );
}
