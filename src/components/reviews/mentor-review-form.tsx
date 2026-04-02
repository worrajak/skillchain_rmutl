"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { RubricScore, MENTOR_RUBRIC_LEVELS, RubricBar } from "./rubric-score";
import { ScoreCircle } from "./badge-display";
import { createClient } from "@/lib/supabase/client";
import { CheckCircle, ArrowUpCircle } from "lucide-react";

const CRITERIA = [
  { key: "score_effort", label: "ความตั้งใจ", description: "ความกระตือรือร้น สนใจเรียนรู้" },
  { key: "score_safety", label: "ความปลอดภัย", description: "ปฏิบัติตามกฎความปลอดภัยอย่างเคร่งครัด" },
  { key: "score_skill_dev", label: "ทักษะที่พัฒนา", description: "มีพัฒนาการจากเริ่มต้นจนจบงาน" },
] as const;

interface MentorReviewFormProps {
  jobId: string;
  mentorId: string;
  traineeId: string;
  traineeName: string;
  jobTitle: string;
  onSuccess?: () => void;
}

export function MentorReviewForm({
  jobId,
  mentorId,
  traineeId,
  traineeName,
  jobTitle,
  onSuccess,
}: MentorReviewFormProps) {
  const [scores, setScores] = useState<Record<string, number>>({
    score_effort: 0,
    score_safety: 0,
    score_skill_dev: 0,
  });
  const [comment, setComment] = useState("");
  const [recommendPromotion, setRecommendPromotion] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const supabase = createClient();

  const weightedScore =
    Object.values(scores).filter((v) => v > 0).length > 0
      ? Object.values(scores).reduce((a, b) => a + b, 0) /
        Object.values(scores).filter((v) => v > 0).length
      : 0;

  const allScored = CRITERIA.every((c) => scores[c.key] > 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!allScored) return;
    setLoading(true);

    const { error } = await supabase.from("mentor_reviews").insert({
      job_id: jobId,
      mentor_id: mentorId,
      trainee_id: traineeId,
      score_effort: scores.score_effort,
      score_safety: scores.score_safety,
      score_skill_dev: scores.score_skill_dev,
      weighted_score: weightedScore,
      comment: comment || null,
      recommend_promotion: recommendPromotion,
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
          <p className="font-medium text-foreground">ประเมินเรียบร้อย</p>
          <p className="text-sm text-muted-foreground">
            คะแนนเฉลี่ย: {weightedScore.toFixed(1)} / 4.0
          </p>
          {recommendPromotion && (
            <p className="text-sm text-blue-600 font-medium flex items-center justify-center gap-1">
              <ArrowUpCircle className="size-4" />
              แนะนำเลื่อนขั้น
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader>
          <CardTitle className="text-foreground">
            ประเมิน Trainee: {traineeName}
          </CardTitle>
          <p className="text-sm text-muted-foreground">งาน: {jobTitle}</p>
        </CardHeader>
        <CardContent className="space-y-6">
          {CRITERIA.map((c) => (
            <div key={c.key}>
              <RubricScore
                label={c.label}
                value={scores[c.key]}
                levels={MENTOR_RUBRIC_LEVELS}
                onChange={(v) =>
                  setScores((prev) => ({ ...prev, [c.key]: v }))
                }
              />
              <p className="mt-1 text-xs text-muted-foreground">
                {c.description}
              </p>
            </div>
          ))}

          {allScored && (
            <div className="flex items-center gap-6 pt-2">
              <ScoreCircle
                score={weightedScore}
                max={4}
                label="คะแนนเฉลี่ย"
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
          )}

          {/* Recommend Promotion */}
          <div className="flex items-center gap-3 rounded-lg border p-4">
            <input
              type="checkbox"
              id="recommend"
              checked={recommendPromotion}
              onChange={(e) => setRecommendPromotion(e.target.checked)}
              className="size-4 rounded border-gray-300"
            />
            <div>
              <Label htmlFor="recommend" className="text-foreground cursor-pointer">
                แนะนำเลื่อนขั้น
              </Label>
              <p className="text-xs text-muted-foreground">
                น้องคนนี้พร้อมที่จะเลื่อนระดับจาก Trainee ไป Apprentice
              </p>
            </div>
          </div>

          <Textarea
            placeholder="ข้อเสนอแนะสำหรับน้อง (ไม่บังคับ)"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
          />

          <Button
            type="submit"
            className="w-full"
            disabled={!allScored || loading}
          >
            {loading ? "กำลังบันทึก..." : "ยืนยันการประเมิน"}
          </Button>
        </CardContent>
      </Card>
    </form>
  );
}
