"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  GraduationCap,
  CheckCircle,
  XCircle,
  Loader2,
  ArrowLeft,
  Award,
  Save,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { COURSE_STATUS_LABELS } from "@/types/database";
import type { CourseStatus } from "@/types/database";

interface Module {
  id: string;
  sort_order: number;
  title: string;
  hours: number;
  pass_criteria: string;
}

interface Enrollment {
  id: string;
  trainee_id: string;
  is_external: boolean;
  completed_at: string | null;
  certificate_number: string | null;
  trainee: { name: string; email: string } | null;
}

interface Assessment {
  module_id: string;
  enrollment_id: string;
  passed: boolean;
  score: number | null;
  note: string | null;
}

interface CourseData {
  id: string;
  title: string;
  status: CourseStatus;
  modules: Module[];
  enrollments: Enrollment[];
}

export default function AssessPage() {
  const { id: courseId } = useParams<{ id: string }>();
  const [course, setCourse] = useState<CourseData | null>(null);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [selectedEnrollment, setSelectedEnrollment] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    loadCourse();
  }, [courseId]);

  async function loadCourse() {
    const res = await fetch(`/api/training/${courseId}`);
    if (res.ok) {
      const data = await res.json();
      setCourse(data);
      if (data.enrollments.length > 0 && !selectedEnrollment) {
        setSelectedEnrollment(data.enrollments[0].id);
      }
    }
    setLoading(false);
  }

  // Load assessments when enrollment changes
  useEffect(() => {
    if (!selectedEnrollment) return;
    async function loadAssessments() {
      const { data } = await supabase
        .from("module_assessments")
        .select("module_id, enrollment_id, passed, score, note")
        .eq("enrollment_id", selectedEnrollment);
      setAssessments(data ?? []);
    }
    loadAssessments();
  }, [selectedEnrollment]);

  function getAssessment(moduleId: string) {
    return assessments.find(
      (a) => a.module_id === moduleId && a.enrollment_id === selectedEnrollment
    );
  }

  async function handleAssess(
    moduleId: string,
    passed: boolean,
    score?: number,
    note?: string
  ) {
    setSaving(moduleId);
    const res = await fetch(`/api/training/${courseId}/assess`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        module_id: moduleId,
        enrollment_id: selectedEnrollment,
        passed,
        score: score ?? null,
        note: note ?? null,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error);
    } else {
      toast.success(data.message);
      if (data.all_passed) {
        toast.success(`ใบรับรองเลขที่: ${data.certificate_number}`, {
          duration: 8000,
        });
      }
      // Reload
      const { data: updated } = await supabase
        .from("module_assessments")
        .select("module_id, enrollment_id, passed, score, note")
        .eq("enrollment_id", selectedEnrollment);
      setAssessments(updated ?? []);
      // Reload course for enrollment changes
      const r2 = await fetch(`/api/training/${courseId}`);
      if (r2.ok) setCourse(await r2.json());
    }
    setSaving(null);
  }

  async function handleStatusChange(newStatus: string) {
    setStatusLoading(true);
    const res = await fetch(`/api/training/${courseId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error);
    } else {
      toast.success(data.message);
      await loadCourse();
    }
    setStatusLoading(false);
  }

  if (loading)
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  if (!course)
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">ไม่พบหลักสูตร</p>
      </div>
    );

  const currentEnrollment = course.enrollments.find(
    (e) => e.id === selectedEnrollment
  );
  const st = COURSE_STATUS_LABELS[course.status];

  const statusTransitions: Record<string, { label: string; next: string }[]> = {
    DRAFT: [{ label: "เปิดรับสมัคร", next: "OPEN_ENROLLMENT" }],
    OPEN_ENROLLMENT: [{ label: "เริ่มอบรม", next: "IN_PROGRESS" }],
    IN_PROGRESS: [{ label: "เสร็จสิ้น", next: "COMPLETED" }],
  };

  return (
    <div className="min-h-screen bg-muted py-8 px-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <Link
              href={`/training/${courseId}`}
              className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground text-sm mb-2"
            >
              <ArrowLeft className="size-4" /> กลับไปหลักสูตร
            </Link>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              <GraduationCap className="size-5 text-indigo-600" />
              {course.title}
            </h1>
            <div className="flex items-center gap-3 mt-1">
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-medium ${st.color}`}
              >
                {st.label}
              </span>
              <span className="text-sm text-muted-foreground">
                {course.enrollments.length} ผู้สมัคร · {course.modules.length}{" "}
                โมดูล
              </span>
            </div>
          </div>
          {/* Status change */}
          <div className="flex gap-2">
            {(statusTransitions[course.status] ?? []).map((t) => (
              <Button
                key={t.next}
                size="sm"
                onClick={() => handleStatusChange(t.next)}
                disabled={statusLoading}
              >
                {statusLoading && (
                  <Loader2 className="size-3 animate-spin mr-1" />
                )}
                {t.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Select enrollment */}
        {course.enrollments.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              ยังไม่มีผู้สมัครหลักสูตรนี้
            </CardContent>
          </Card>
        ) : (
          <>
            <Card>
              <CardContent className="py-4">
                <div className="flex items-center gap-3">
                  <label className="text-sm font-medium text-foreground shrink-0">
                    ประเมินผู้เรียน:
                  </label>
                  <Select
                    value={selectedEnrollment}
                    onValueChange={(v) => v && setSelectedEnrollment(v)}
                  >
                    <SelectTrigger className="max-w-md">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {course.enrollments.map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.trainee?.name ?? "—"} ({e.trainee?.email}){" "}
                          {e.is_external ? "📌ภายนอก" : ""}{" "}
                          {e.completed_at ? "✅" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {currentEnrollment?.certificate_number && (
                  <div className="mt-2 flex items-center gap-2 text-sm text-green-700 bg-green-50 rounded px-3 py-2">
                    <Award className="size-4" />
                    ใบรับรองเลขที่: {currentEnrollment.certificate_number}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Module assessments */}
            <div className="space-y-3">
              {course.modules.map((m) => {
                const a = getAssessment(m.id);
                return (
                  <ModuleAssessmentCard
                    key={m.id}
                    module={m}
                    assessment={a}
                    saving={saving === m.id}
                    onAssess={(passed, score, note) =>
                      handleAssess(m.id, passed, score, note)
                    }
                  />
                );
              })}
            </div>

            {/* Summary */}
            <Card>
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">
                    สรุปผลการประเมิน
                  </span>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="flex items-center gap-1 text-green-700">
                      <CheckCircle className="size-4" />
                      ผ่าน{" "}
                      {assessments.filter((a) => a.passed).length}/
                      {course.modules.length}
                    </span>
                    <span className="flex items-center gap-1 text-red-600">
                      <XCircle className="size-4" />
                      ไม่ผ่าน{" "}
                      {
                        assessments.filter(
                          (a) => !a.passed && a.enrollment_id === selectedEnrollment
                        ).length
                      }
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}

// Sub-component for each module assessment
function ModuleAssessmentCard({
  module: m,
  assessment,
  saving,
  onAssess,
}: {
  module: { id: string; sort_order: number; title: string; hours: number; pass_criteria: string };
  assessment: Assessment | undefined;
  saving: boolean;
  onAssess: (passed: boolean, score?: number, note?: string) => void;
}) {
  const [score, setScore] = useState(assessment?.score?.toString() ?? "");
  const [note, setNote] = useState(assessment?.note ?? "");

  useEffect(() => {
    setScore(assessment?.score?.toString() ?? "");
    setNote(assessment?.note ?? "");
  }, [assessment]);

  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex items-start gap-3">
          <div className="flex size-8 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 text-sm font-bold shrink-0">
            {m.sort_order}
          </div>
          <div className="flex-1 min-w-0 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium text-sm text-foreground">{m.title}</p>
                <p className="text-xs text-muted-foreground">
                  {m.hours} ชม. · เกณฑ์: {m.pass_criteria}
                </p>
              </div>
              {assessment && (
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    assessment.passed
                      ? "bg-green-100 text-green-800"
                      : "bg-red-100 text-red-800"
                  }`}
                >
                  {assessment.passed ? "ผ่าน" : "ไม่ผ่าน"}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <Input
                type="number"
                placeholder="คะแนน (ถ้ามี)"
                value={score}
                onChange={(e) => setScore(e.target.value)}
                min={0}
                max={100}
              />
              <Textarea
                placeholder="หมายเหตุ..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={1}
                className="sm:col-span-2"
              />
            </div>

            <div className="flex gap-2">
              <Button
                size="sm"
                className="bg-green-600 hover:bg-green-700"
                disabled={saving}
                onClick={() =>
                  onAssess(
                    true,
                    score ? Number(score) : undefined,
                    note || undefined
                  )
                }
              >
                {saving ? (
                  <Loader2 className="size-3 animate-spin mr-1" />
                ) : (
                  <CheckCircle className="size-3 mr-1" />
                )}
                ผ่าน
              </Button>
              <Button
                size="sm"
                variant="destructive"
                disabled={saving}
                onClick={() =>
                  onAssess(
                    false,
                    score ? Number(score) : undefined,
                    note || undefined
                  )
                }
              >
                {saving ? (
                  <Loader2 className="size-3 animate-spin mr-1" />
                ) : (
                  <XCircle className="size-3 mr-1" />
                )}
                ไม่ผ่าน
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
