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
import { StarRating } from "./star-rating";
import { ScoreCircle } from "./badge-display";
import { createClient } from "@/lib/supabase/client";
import { CheckCircle } from "lucide-react";

const CRITERIA = [
  { key: "score_quality", label: "คุณภาพงาน", description: "ผลงานตรงตามที่ตกลง เรียบร้อย" },
  { key: "score_punctuality", label: "ตรงเวลา", description: "มาทำงานและส่งงานตามกำหนด" },
  { key: "score_attitude", label: "ทัศนคติ/มารยาท", description: "สุภาพ ตั้งใจ รับผิดชอบ" },
] as const;

interface EmployerReviewFormProps {
  jobId: string;
  employerId: string;
  studentId: string;
  studentName: string;
  jobTitle: string;
  onSuccess?: () => void;
}

export function EmployerReviewForm({
  jobId,
  employerId,
  studentId,
  studentName,
  jobTitle,
  onSuccess,
}: EmployerReviewFormProps) {
  const [scores, setScores] = useState<Record<string, number>>({
    score_quality: 0,
    score_punctuality: 0,
    score_attitude: 0,
  });
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const supabase = createClient();

  const overallRating =
    Object.values(scores).filter((v) => v > 0).length > 0
      ? Object.values(scores).reduce((a, b) => a + b, 0) /
        Object.values(scores).filter((v) => v > 0).length
      : 0;

  const allScored = CRITERIA.every((c) => scores[c.key] > 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!allScored) return;
    setLoading(true);

    const { error } = await supabase.from("employer_reviews").insert({
      job_id: jobId,
      employer_id: employerId,
      student_id: studentId,
      score_quality: scores.score_quality,
      score_punctuality: scores.score_punctuality,
      score_attitude: scores.score_attitude,
      overall_rating: overallRating,
      comment: comment || null,
    });

    setLoading(false);
    if (!error) {
      setSuccess(true);
      onSuccess?.();
    }
  }

  if (success) {
    return (
      <Card className="text-center">
        <CardContent className="pt-8 pb-6 space-y-3">
          <CheckCircle className="size-12 mx-auto text-green-500" />
          <p className="font-medium text-foreground">ให้คะแนนเรียบร้อย</p>
          <p className="text-sm text-muted-foreground">
            คะแนนเฉลี่ย: {overallRating.toFixed(1)} / 5.0
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader>
          <CardTitle className="text-foreground">
            ให้คะแนนนักศึกษา: {studentName}
          </CardTitle>
          <p className="text-sm text-muted-foreground">งาน: {jobTitle}</p>
        </CardHeader>
        <CardContent className="space-y-6">
          {CRITERIA.map((c) => (
            <div key={c.key} className="space-y-1">
              <StarRating
                label={c.label}
                value={scores[c.key]}
                onChange={(v) =>
                  setScores((prev) => ({ ...prev, [c.key]: v }))
                }
              />
              <p className="text-xs text-muted-foreground pl-1">
                {c.description}
              </p>
            </div>
          ))}

          {allScored && (
            <div className="flex justify-center pt-2">
              <ScoreCircle
                score={overallRating}
                max={5}
                label="คะแนนเฉลี่ย"
              />
            </div>
          )}

          <Textarea
            placeholder="ความคิดเห็นเพิ่มเติม (ไม่บังคับ)"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
          />

          <Button
            type="submit"
            className="w-full"
            disabled={!allScored || loading}
          >
            {loading ? "กำลังบันทึก..." : "ยืนยันการให้คะแนน"}
          </Button>
        </CardContent>
      </Card>
    </form>
  );
}
