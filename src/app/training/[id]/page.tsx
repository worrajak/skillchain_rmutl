"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  GraduationCap,
  Clock,
  Users,
  Calendar,
  BookOpen,
  CheckCircle,
  XCircle,
  ArrowLeft,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import {
  COURSE_STATUS_LABELS,
  PROVIDER_LABELS,
} from "@/types/database";
import type { CourseStatus, TrainingProvider } from "@/types/database";

interface Module {
  id: string;
  sort_order: number;
  title: string;
  description: string | null;
  hours: number;
  pass_criteria: string;
  competency_code: string | null;
}

interface Enrollment {
  id: string;
  trainee_id: string;
  is_external: boolean;
  enrolled_at: string;
  completed_at: string | null;
  certificate_number: string | null;
  trainee: { name: string; email: string; role: string } | null;
}

interface CourseDetail {
  id: string;
  title: string;
  description: string;
  category: string;
  provider: TrainingProvider;
  status: CourseStatus;
  start_date: string;
  end_date: string;
  total_hours: number;
  max_participants: number;
  min_participants: number;
  is_open_to_external: boolean;
  grants_credential_level: string | null;
  instructor: { name: string; email: string } | null;
  modules: Module[];
  enrollments: Enrollment[];
}

export default function CourseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      // Load course
      const res = await fetch(`/api/training/${id}`);
      if (res.ok) {
        setCourse(await res.json());
      }

      // Check auth
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        const { data: profile } = await supabase
          .from("skc_users")
          .select("role")
          .eq("id", user.id)
          .single();
        setUserRole(profile?.role ?? null);
      }
      setLoading(false);
    }
    load();
  }, [id]);

  async function handleEnroll() {
    setEnrolling(true);
    const res = await fetch(`/api/training/${id}/enroll`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error);
    } else {
      toast.success(data.message);
      // Reload course data
      const r2 = await fetch(`/api/training/${id}`);
      if (r2.ok) setCourse(await r2.json());
    }
    setEnrolling(false);
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

  const st = COURSE_STATUS_LABELS[course.status];
  const isEnrolled = course.enrollments.some((e) => e.trainee_id === userId);
  const myEnrollment = course.enrollments.find(
    (e) => e.trainee_id === userId
  );
  const canEnroll =
    userId &&
    course.status === "OPEN_ENROLLMENT" &&
    !isEnrolled &&
    course.enrollments.length < course.max_participants;

  const isStaff = [
    "teacher",
    "project_staff",
    "rmutl_staff",
    "admin",
    "superadmin",
  ].includes(userRole ?? "");

  return (
    <div className="min-h-screen bg-muted pb-12">
      <div className="bg-gradient-to-r from-indigo-600 to-purple-700 text-white py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <Link
            href="/training"
            className="inline-flex items-center gap-1 text-indigo-200 hover:text-white text-sm mb-4"
          >
            <ArrowLeft className="size-4" /> กลับไปหลักสูตร
          </Link>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold">{course.title}</h1>
              <p className="text-indigo-200 mt-1">
                {PROVIDER_LABELS[course.provider]}
                {course.instructor && ` — ${course.instructor.name}`}
              </p>
            </div>
            <span
              className={`shrink-0 text-xs px-3 py-1 rounded-full font-medium ${st.color}`}
            >
              {st.label}
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 -mt-4 space-y-6">
        {/* Info cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            {
              icon: Calendar,
              label: "ระยะเวลา",
              value: `${new Date(course.start_date).toLocaleDateString(
                "th-TH",
                { day: "numeric", month: "short" }
              )} – ${new Date(course.end_date).toLocaleDateString("th-TH", {
                day: "numeric",
                month: "short",
              })}`,
            },
            {
              icon: Clock,
              label: "ชั่วโมง",
              value: `${course.total_hours} ชม.`,
            },
            {
              icon: Users,
              label: "ผู้สมัคร",
              value: `${course.enrollments.length}/${course.max_participants}`,
            },
            {
              icon: BookOpen,
              label: "โมดูล",
              value: `${course.modules.length} หัวข้อ`,
            },
          ].map((item) => (
            <Card key={item.label}>
              <CardContent className="py-3 text-center">
                <item.icon className="size-5 mx-auto text-indigo-600 mb-1" />
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <p className="font-semibold text-sm text-foreground">
                  {item.value}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Description */}
        <Card>
          <CardHeader>
            <CardTitle className="text-foreground">รายละเอียดหลักสูตร</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {course.description}
            </p>
            {course.grants_credential_level && (
              <div className="mt-4 flex items-center gap-2 text-sm text-amber-700 bg-amber-50 rounded-lg px-3 py-2 w-fit">
                <GraduationCap className="size-4" />
                ผู้ผ่านหลักสูตรจะได้ credential:{" "}
                {course.grants_credential_level.replace("_", " ")}
              </div>
            )}
            {course.is_open_to_external && (
              <p className="mt-2 text-xs text-indigo-600">
                ✦ เปิดรับผู้เรียนภายนอก (ไม่ใช่นักศึกษา มทร.ล้านนา)
              </p>
            )}
          </CardContent>
        </Card>

        {/* Modules */}
        <Card>
          <CardHeader>
            <CardTitle className="text-foreground">โมดูลการเรียนรู้</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {course.modules.map((m, i) => (
              <div
                key={m.id}
                className="flex items-start gap-3 p-3 rounded-lg bg-muted"
              >
                <div className="flex size-7 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold shrink-0">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-foreground">
                    {m.title}
                  </p>
                  {m.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {m.description}
                    </p>
                  )}
                  <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                    <span>{m.hours} ชม.</span>
                    <span>เกณฑ์: {m.pass_criteria}</span>
                    {m.competency_code && (
                      <span className="text-indigo-600">
                        {m.competency_code}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Enroll button */}
        <Card>
          <CardContent className="py-6 text-center space-y-3">
            {!userId ? (
              <>
                <p className="text-sm text-muted-foreground">
                  เข้าสู่ระบบเพื่อลงทะเบียนหลักสูตร
                </p>
                <div className="flex justify-center gap-3">
                  <Link href="/login">
                    <Button>เข้าสู่ระบบ</Button>
                  </Link>
                  <Link href="/register-trainee">
                    <Button variant="outline">สมัครผู้เรียนภายนอก</Button>
                  </Link>
                </div>
              </>
            ) : isEnrolled ? (
              <>
                <CheckCircle className="size-8 mx-auto text-green-500" />
                <p className="text-sm font-medium text-green-700">
                  คุณลงทะเบียนหลักสูตรนี้แล้ว
                </p>
                {myEnrollment?.certificate_number && (
                  <p className="text-xs text-muted-foreground">
                    ใบรับรองเลขที่: {myEnrollment.certificate_number}
                  </p>
                )}
              </>
            ) : canEnroll ? (
              <Button
                size="lg"
                onClick={handleEnroll}
                disabled={enrolling}
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                {enrolling ? (
                  <Loader2 className="size-4 animate-spin mr-2" />
                ) : (
                  <GraduationCap className="size-4 mr-2" />
                )}
                ลงทะเบียนหลักสูตรนี้
              </Button>
            ) : course.status !== "OPEN_ENROLLMENT" ? (
              <p className="text-sm text-muted-foreground">
                หลักสูตรไม่ได้อยู่ในช่วงเปิดรับสมัคร
              </p>
            ) : (
              <p className="text-sm text-red-600">หลักสูตรเต็มแล้ว</p>
            )}
          </CardContent>
        </Card>

        {/* Staff: manage link */}
        {isStaff && (
          <div className="text-center">
            <Link href={`/training/manage/${id}/assess`}>
              <Button variant="outline">
                <GraduationCap className="size-4 mr-2" /> จัดการประเมินผล
              </Button>
            </Link>
          </div>
        )}

        {/* Enrollees (visible to staff) */}
        {isStaff && course.enrollments.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-foreground">
                รายชื่อผู้สมัคร ({course.enrollments.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {course.enrollments.map((e) => (
                  <div
                    key={e.id}
                    className="flex items-center justify-between p-2 rounded bg-muted text-sm"
                  >
                    <div>
                      <span className="font-medium text-foreground">
                        {e.trainee?.name ?? "—"}
                      </span>
                      <span className="text-muted-foreground ml-2 text-xs">
                        {e.trainee?.email}
                      </span>
                      {e.is_external && (
                        <span className="ml-2 text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded">
                          ภายนอก
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {e.completed_at ? (
                        <span className="flex items-center gap-1 text-xs text-green-700">
                          <CheckCircle className="size-3" /> ผ่าน
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <XCircle className="size-3" /> ยังไม่ครบ
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
