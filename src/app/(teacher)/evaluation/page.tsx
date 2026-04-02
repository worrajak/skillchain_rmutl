"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  RubricScore,
  TEACHER_RUBRIC_LEVELS,
  RubricBar,
} from "@/components/reviews/rubric-score";
import { ScoreCircle } from "@/components/reviews/badge-display";
import { createClient } from "@/lib/supabase/client";
import { ClipboardCheck } from "lucide-react";

const CRITERIA = [
  { key: "score_quality", label: "คุณภาพงาน", weight: 0.4, description: "ผลงานตรงตามมาตรฐานและความต้องการ" },
  { key: "score_skill", label: "ทักษะช่าง", weight: 0.3, description: "ความชำนาญในการใช้เครื่องมือและเทคนิค" },
  { key: "score_time", label: "ตรงเวลา", weight: 0.2, description: "ส่งงานภายในกำหนดเวลา" },
  { key: "score_tool", label: "การใช้อุปกรณ์", weight: 0.1, description: "ดูแลรักษาและใช้อุปกรณ์อย่างถูกต้อง" },
] as const;

export default function TeacherEvaluationPage() {
  const [scores, setScores] = useState<Record<string, number>>({
    score_quality: 0,
    score_skill: 0,
    score_time: 0,
    score_tool: 0,
  });
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const supabase = createClient();

  const weightedScore = CRITERIA.reduce((sum, c) => {
    return sum + (scores[c.key] || 0) * c.weight;
  }, 0);

  const allScored = CRITERIA.every((c) => scores[c.key] > 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!allScored) return;

    setLoading(true);

    // TODO: Get actual job_id, student_id, teacher_id from context/params
    const { error } = await supabase.from("evaluations").insert({
      job_id: "", // placeholder
      student_id: "", // placeholder
      teacher_id: "", // placeholder
      score_quality: scores.score_quality,
      score_skill: scores.score_skill,
      score_time: scores.score_time,
      score_tool: scores.score_tool,
      weighted_score: weightedScore,
      comment: comment || null,
    });

    setLoading(false);
    if (!error) setSuccess(true);
  }

  if (success) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center px-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-8 pb-6 space-y-4">
            <ClipboardCheck className="size-16 mx-auto text-green-500" />
            <h2 className="text-xl font-bold text-foreground">ประเมินเสร็จสิ้น</h2>
            <p className="text-sm text-muted-foreground">
              คะแนนถ่วงน้ำหนักรวม: {weightedScore.toFixed(2)} / 4.0
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted px-4 py-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-foreground">
          ประเมินผลงานนักศึกษา
        </h1>
        <p className="text-sm text-muted-foreground">
          ใช้เกณฑ์ Rubric 4 ระดับ (1=ปรับปรุง, 2=พอใช้, 3=ดี, 4=เยี่ยม)
          ถ่วงน้ำหนัก: คุณภาพ 40% / ทักษะ 30% / เวลา 20% / อุปกรณ์ 10%
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Rubric Criteria */}
          <Card>
            <CardHeader>
              <CardTitle className="text-foreground">เกณฑ์การประเมิน</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {CRITERIA.map((c) => (
                <div key={c.key}>
                  <RubricScore
                    label={`${c.label} (${(c.weight * 100).toFixed(0)}%)`}
                    value={scores[c.key]}
                    levels={TEACHER_RUBRIC_LEVELS}
                    onChange={(v) =>
                      setScores((prev) => ({ ...prev, [c.key]: v }))
                    }
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    {c.description}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Score Preview */}
          {allScored && (
            <Card>
              <CardHeader>
                <CardTitle className="text-foreground">สรุปคะแนน</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-8">
                  <ScoreCircle
                    score={weightedScore}
                    max={4}
                    label="คะแนนรวม"
                    size="lg"
                  />
                  <div className="flex-1 space-y-2">
                    {CRITERIA.map((c) => (
                      <RubricBar
                        key={c.key}
                        label={c.label}
                        value={scores[c.key]}
                        max={4}
                      />
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Comment */}
          <Card>
            <CardHeader>
              <CardTitle className="text-foreground">ความคิดเห็น</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="ข้อเสนอแนะเพิ่มเติม (ไม่บังคับ)"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
              />
            </CardContent>
          </Card>

          <Button
            type="submit"
            className="w-full"
            disabled={!allScored || loading}
            size="lg"
          >
            {loading ? "กำลังบันทึก..." : "ยืนยันการประเมิน"}
          </Button>
        </form>
      </div>
    </div>
  );
}
