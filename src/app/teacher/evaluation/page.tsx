"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  RubricScore,
  TEACHER_RUBRIC_LEVELS,
  RubricBar,
} from "@/components/reviews/rubric-score";
import { ScoreCircle } from "@/components/reviews/badge-display";
import { createClient } from "@/lib/supabase/client";
import { ClipboardCheck, Home, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import {
  PRE_WORK_CRITERIA,
  DURING_WORK_OBSERVER_CRITERIA,
  POST_WORK_TEACHER_CRITERIA,
} from "@/types/database";
import type { EvalPhase } from "@/types/database";

const PHASE_OPTIONS: { value: EvalPhase; label: string; desc: string; statuses: string[] }[] = [
  { value: "PRE_WORK", label: "ก่อนเริ่มงาน", desc: "ประเมินทักษะเบื้องต้น → กำหนด credential level", statuses: ["ASSIGNED", "CONFIRMED"] },
  { value: "IN_PROGRESS", label: "ระหว่างทำงาน (Observe)", desc: "ออกไปดูงานร่วมกับนักศึกษา ประเมินทักษะจริง", statuses: ["IN_PROGRESS"] },
  { value: "POST_WORK", label: "หลังงานเสร็จ", desc: "ประเมินทักษะรวม + แนะนำเลื่อนระดับ", statuses: ["SUBMITTED", "COMPLETED"] },
];

function getCriteria(phase: EvalPhase) {
  switch (phase) {
    case "PRE_WORK": return PRE_WORK_CRITERIA.criteria;
    case "IN_PROGRESS": return DURING_WORK_OBSERVER_CRITERIA.criteria;
    case "POST_WORK": return POST_WORK_TEACHER_CRITERIA.criteria;
    default: return PRE_WORK_CRITERIA.criteria;
  }
}

export default function TeacherEvaluationPage() {
  const [phase, setPhase] = useState<EvalPhase>("PRE_WORK");
  const [jobs, setJobs] = useState<{ id: string; title: string; student_name: string }[]>([]);
  const [selectedJob, setSelectedJob] = useState("");
  const [scores, setScores] = useState<Record<string, number>>({});
  const [comment, setComment] = useState("");
  const [recommendLevelUp, setRecommendLevelUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const supabase = createClient();
  const criteria = getCriteria(phase);
  const phaseConfig = PHASE_OPTIONS.find((p) => p.value === phase)!;

  useEffect(() => {
    async function loadJobs() {
      const { data } = await supabase
        .from("skc_jobs")
        .select("id, title, student:skc_users!skc_jobs_student_id_fkey(name)")
        .in("status", phaseConfig.statuses)
        .order("created_at", { ascending: false });
      setJobs((data ?? []).map((j) => ({
        id: j.id, title: j.title,
        student_name: String((j.student as unknown as { name: string })?.name ?? "ยังไม่มี"),
      })));
    }
    loadJobs();
    setScores({});
    setSelectedJob("");
    setComment("");
    setRecommendLevelUp(false);
    setSuccess(false);
  }, [phase]);

  const allScored = criteria.every((c) => (scores[c.key] ?? 0) > 0);
  const avgScore = criteria.length > 0
    ? criteria.reduce((sum, c) => sum + (scores[c.key] ?? 0), 0) / criteria.length : 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedJob || !allScored) return;
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("กรุณาเข้าสู่ระบบ"); setLoading(false); return; }

    const { data: job } = await supabase.from("skc_jobs").select("student_id").eq("id", selectedJob).single();

    const { error } = await supabase.from("skc_evaluations").insert({
      job_id: selectedJob,
      student_id: job?.student_id ?? "",
      teacher_id: user.id,
      score_quality: scores[criteria[0]?.key] ?? 0,
      score_skill: scores[criteria[1]?.key] ?? 0,
      score_time: scores[criteria[2]?.key] ?? 0,
      score_tool: scores[criteria[3]?.key] ?? 0,
      weighted_score: avgScore,
      eval_phase: phase,
      comment: comment || null,
    });

    setLoading(false);
    if (error) { toast.error(error.message); }
    else { toast.success("บันทึกสำเร็จ"); setSuccess(true); }
  }

  if (success) {
    return (
      <div className="max-w-md mx-auto mt-10">
        <Card className="text-center">
          <CardContent className="py-10 space-y-4">
            <ClipboardCheck className="size-16 mx-auto text-green-500" />
            <h2 className="text-xl font-bold text-foreground">ประเมินเสร็จสิ้น</h2>
            <p className="text-sm text-muted-foreground">คะแนนเฉลี่ย: {avgScore.toFixed(2)} / 4.0</p>
            <div className="flex gap-3 justify-center">
              <Button onClick={() => setSuccess(false)}>ประเมินงานอื่น</Button>
              <Link href="/"><Button variant="outline"><Home className="size-4 mr-1" />หน้าหลัก</Button></Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Phase Selection */}
      <Card>
        <CardHeader><CardTitle className="text-foreground">เลือกระยะการประเมิน</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {PHASE_OPTIONS.map((p) => (
            <button key={p.value} type="button" onClick={() => setPhase(p.value)}
              className={cn("w-full text-left rounded-lg border p-3 transition-all",
                phase === p.value ? "border-blue-500 bg-blue-50 ring-2 ring-blue-200" : "hover:bg-muted"
              )}>
              <div className="font-medium text-sm text-foreground">{p.label}</div>
              <div className="text-xs text-muted-foreground">{p.desc}</div>
            </button>
          ))}
        </CardContent>
      </Card>

      {/* Job Selection */}
      <Card>
        <CardHeader><CardTitle className="text-foreground">เลือกงาน</CardTitle></CardHeader>
        <CardContent>
          {jobs.length > 0 ? (
            <Select value={selectedJob} onValueChange={(v) => v && setSelectedJob(v)}>
              <SelectTrigger><SelectValue placeholder="เลือกงาน" /></SelectTrigger>
              <SelectContent>
                {jobs.map((j) => <SelectItem key={j.id} value={j.id}>{j.title} — นศ.: {j.student_name}</SelectItem>)}
              </SelectContent>
            </Select>
          ) : (
            <div className="flex items-center gap-2 text-sm text-yellow-700 bg-yellow-50 rounded-lg p-3">
              <AlertTriangle className="size-4 shrink-0" />ไม่มีงานสำหรับระยะนี้
            </div>
          )}
        </CardContent>
      </Card>

      {/* Rubric */}
      {selectedJob && (
        <form onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-foreground">เกณฑ์: {phaseConfig.label}</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              {criteria.map((c) => (
                <RubricScore key={c.key} label={c.label} value={scores[c.key] ?? 0}
                  levels={TEACHER_RUBRIC_LEVELS}
                  onChange={(v) => setScores((prev) => ({ ...prev, [c.key]: v }))} />
              ))}
            </CardContent>
          </Card>

          {allScored && (
            <Card>
              <CardHeader><CardTitle className="text-foreground">สรุปคะแนน</CardTitle></CardHeader>
              <CardContent>
                <div className="flex items-center gap-8">
                  <ScoreCircle score={avgScore} max={4} label="คะแนนเฉลี่ย" size="lg" />
                  <div className="flex-1 space-y-2">
                    {criteria.map((c) => <RubricBar key={c.key} label={c.label} value={scores[c.key] ?? 0} max={c.max} />)}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {phase === "POST_WORK" && (
            <Card>
              <CardContent className="pt-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={recommendLevelUp} onChange={(e) => setRecommendLevelUp(e.target.checked)} className="size-4 rounded" />
                  <div>
                    <div className="font-medium text-sm text-foreground">แนะนำเลื่อนระดับ Credential</div>
                    <div className="text-xs text-muted-foreground">นักศึกษาพร้อมที่จะเลื่อนระดับทักษะ</div>
                  </div>
                </label>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader><CardTitle className="text-foreground">ความคิดเห็น</CardTitle></CardHeader>
            <CardContent>
              <Textarea placeholder="ข้อเสนอแนะ (ไม่บังคับ)" value={comment} onChange={(e) => setComment(e.target.value)} rows={3} />
            </CardContent>
          </Card>

          <Button type="submit" className="w-full" size="lg" disabled={!allScored || loading}>
            {loading ? "กำลังบันทึก..." : "ยืนยันการประเมิน"}
          </Button>
        </form>
      )}
    </div>
  );
}
