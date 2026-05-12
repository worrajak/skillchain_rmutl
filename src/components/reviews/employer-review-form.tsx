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
  evalPhase?: "PRE_WORK" | "IN_PROGRESS" | "POST_WORK";
  onSuccess?: () => void;
}

interface ExistingReview {
  score_quality: number;
  score_punctuality: number;
  score_attitude: number;
  overall_rating: number;
  comment?: string | null;
  created_at?: string;
}

export function EmployerReviewForm({
  jobId,
  employerId: _employerId,
  studentId,
  studentName,
  jobTitle,
  evalPhase = "POST_WORK",
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
  const [checking, setChecking] = useState(true);
  const [existing, setExisting] = useState<ExistingReview | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Check if already reviewed
  useEffect(() => {
    let cancelled = false;
    async function check() {
      try {
        const res = await fetch(
          `/api/reviews/check?type=employer&job_id=${jobId}&eval_phase=${evalPhase}`,
        );
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data.existing) {
          setExisting({
            score_quality: Number(data.existing.score_quality),
            score_punctuality: Number(data.existing.score_punctuality),
            score_attitude: Number(data.existing.score_attitude),
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
        type: "employer",
        job_id: jobId,
        student_id: studentId,
        score_quality: scores.score_quality,
        score_punctuality: scores.score_punctuality,
        score_attitude: scores.score_attitude,
        comment: comment || null,
        eval_phase: evalPhase,
      }),
    });
    const data = await res.json();
    setLoading(false);

    if (res.status === 409 && data.already_reviewed) {
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

  if (existing) {
    return (
      <Card className="border-blue-200 bg-blue-50/40">
        <CardHeader>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <CardTitle className="text-foreground flex items-center gap-2">
              <CheckCircle className="size-5 text-blue-600" />
              ประเมินนักศึกษาแล้ว
            </CardTitle>
            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
              {phaseLabel}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            {studentName} · {jobTitle}
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

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-foreground flex items-center gap-2">
              <UserAvatar userId={studentId} size="sm" />
              <span>ให้คะแนน: {studentName}</span>
            </CardTitle>
            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
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
