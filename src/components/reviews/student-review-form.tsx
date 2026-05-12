"use client";

import { useState, useEffect } from "react";
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
import { CheckCircle, Loader2 } from "lucide-react";
import { VoiceNoteButton } from "@/components/voice-note-button";
import { UserAvatar } from "@/components/user-avatar";

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
  evalPhase?: "PRE_WORK" | "IN_PROGRESS" | "POST_WORK";
  onSuccess?: () => void;
}

interface ExistingReview {
  score_clarity: number;
  score_payment: number;
  score_safety: number;
  overall_rating: number;
  comment?: string | null;
  created_at?: string;
}

export function StudentReviewForm({
  jobId,
  studentId: _studentId,
  employerId,
  employerName,
  jobTitle,
  evalPhase = "POST_WORK",
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
  const [checking, setChecking] = useState(true);
  const [existing, setExisting] = useState<ExistingReview | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Check if user already reviewed this job in this phase
  useEffect(() => {
    let cancelled = false;
    async function check() {
      try {
        const res = await fetch(
          `/api/reviews/check?type=student&job_id=${jobId}&eval_phase=${evalPhase}`,
        );
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data.existing) {
          setExisting({
            score_clarity: Number(data.existing.score_clarity),
            score_payment: Number(data.existing.score_payment),
            score_safety: Number(data.existing.score_safety),
            overall_rating: Number(data.existing.overall_rating),
            comment: data.existing.comment,
            created_at: data.existing.created_at,
          });
        }
      } finally {
        if (!cancelled) setChecking(false);
      }
    }
    check();
    return () => { cancelled = true; };
  }, [jobId, evalPhase]);

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
        eval_phase: evalPhase,
      }),
    });
    const data = await res.json();
    setLoading(false);

    if (res.status === 409 && data.already_reviewed) {
      // Race: another tab/request already submitted — switch to existing view
      setExisting(data.existing);
      return;
    }
    if (res.ok) {
      setSuccess(true);
      onSuccess?.();
    } else {
      setError(data.error || "บันทึกไม่สำเร็จ");
    }
  }

  const phaseLabel =
    evalPhase === "IN_PROGRESS"
      ? "ระหว่างทำงาน (Interim)"
      : evalPhase === "PRE_WORK"
        ? "ก่อนเริ่มงาน"
        : "หลังงานเสร็จ (Final)";

  // Loading state
  if (checking) {
    return (
      <Card>
        <CardContent className="py-8 flex items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          ตรวจสถานะการประเมิน...
        </CardContent>
      </Card>
    );
  }

  // Already reviewed — show summary, no form
  if (existing) {
    return (
      <Card className="border-green-200 bg-green-50/40">
        <CardHeader>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <CardTitle className="text-foreground flex items-center gap-2">
              <CheckCircle className="size-5 text-green-600" />
              ประเมินผู้ว่าจ้างแล้ว
            </CardTitle>
            <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">
              {phaseLabel}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            {employerName} · {jobTitle}
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-center">
            <ScoreCircle
              score={existing.overall_rating}
              max={5}
              label="คะแนนเฉลี่ย"
            />
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs text-center">
            {CRITERIA.map((c) => (
              <div key={c.key} className="rounded border bg-white p-2">
                <div className="text-muted-foreground">{c.label}</div>
                <div className="font-semibold text-foreground mt-0.5">
                  {(existing as unknown as Record<string, number>)[c.key]} / 5
                </div>
              </div>
            ))}
          </div>
          {existing.comment && (
            <div className="rounded border bg-white p-2 text-xs">
              <div className="text-muted-foreground mb-1">ความคิดเห็น</div>
              <div className="text-foreground whitespace-pre-wrap">{existing.comment}</div>
            </div>
          )}
          {existing.created_at && (
            <p className="text-[10px] text-muted-foreground text-center">
              ประเมินเมื่อ {new Date(existing.created_at).toLocaleString("th-TH")}
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  // Success (just submitted)
  if (success) {
    return (
      <Card className="text-center border-green-200 bg-green-50/40">
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

  // Form
  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-foreground flex items-center gap-2">
              <UserAvatar userId={employerId} size="sm" />
              <span>ให้คะแนนผู้ว่าจ้าง: {employerName}</span>
            </CardTitle>
            <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">
              {phaseLabel}
            </span>
          </div>
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

          <div className="space-y-2">
            <Textarea
              placeholder="ความคิดเห็นเพิ่มเติม (ไม่บังคับ) — กดปุ่ม 🎙 เพื่อพูด"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
            />
            <VoiceNoteButton
              onTranscript={(t) => setComment((c) => (c ? c + " " : "") + t)}
            />
          </div>

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
