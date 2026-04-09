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
import { CheckCircle } from "lucide-react";

const CRITERIA = [
  { key: "score_clarity", label: "งานชัดเจน", description: "อธิบายงานและความต้องการชัดเจน" },
  { key: "score_payment", label: "จ่ายตรงเวลา", description: "จ่ายเงินครบถ้วนและตรงตามกำหนด" },
  { key: "score_safety", label: "ความปลอดภัย", description: "สถานที่ทำงานปลอดภัย มีอุปกรณ์พร้อม" },
] as const;

interface StudentReviewFormProps {
  jobId: string;
  studentId: string;
  employerId: string;
  employerName: string;
  jobTitle: string;
  onSuccess?: () => void;
}

export function StudentReviewForm({
  jobId,
  studentId,
  employerId,
  employerName,
  jobTitle,
  onSuccess,
}: StudentReviewFormProps) {
  const [scores, setScores] = useState<Record<string, number>>({
    score_clarity: 0,
    score_payment: 0,
    score_safety: 0,
  });
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const [error, setError] = useState<string | null>(null);

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
    setError(null);

    const res = await fetch("/api/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "student",
        job_id: jobId,
        employer_id: employerId,
        score_clarity: scores.score_clarity,
        score_payment: scores.score_payment,
        score_safety: scores.score_safety,
        comment: comment || null,
      }),
    });
    const data = await res.json();
    setLoading(false);
    if (res.ok) {
      setSuccess(true);
      onSuccess?.();
    } else {
      setError(data.error || "บันทึกไม่สำเร็จ");
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
            ให้คะแนนผู้ว่าจ้าง: {employerName}
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

          {error && <p className="text-sm text-red-600">{error}</p>}
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
