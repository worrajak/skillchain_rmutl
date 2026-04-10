"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Search,
  CheckCircle,
  XCircle,
  Award,
  GraduationCap,
  User,
  Calendar,
  BookOpen,
  Shield,
} from "lucide-react";

interface VerifyResult {
  valid: boolean;
  certificate_number: string;
  trainee_name: string;
  trainee_email: string;
  course_title: string;
  course_provider: string;
  total_hours: number;
  completed_at: string;
  credential_level: string | null;
  modules_passed: number;
  total_modules: number;
}

export default function VerifyPage() {
  const [certNumber, setCertNumber] = useState("");
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!certNumber.trim()) return;
    setLoading(true);
    setResult(null);
    setNotFound(false);

    // Find enrollment by certificate number
    const { data: enrollment } = await supabase
      .from("training_enrollments")
      .select(
        "*, trainee:users!training_enrollments_trainee_id_fkey(name, email)"
      )
      .eq("certificate_number", certNumber.trim())
      .single();

    if (!enrollment) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    // Get course info
    const { data: course } = await supabase
      .from("training_courses")
      .select("title, provider, total_hours, grants_credential_level")
      .eq("id", enrollment.course_id)
      .single();

    // Get module count
    const { count: totalModules } = await supabase
      .from("training_modules")
      .select("*", { count: "exact", head: true })
      .eq("course_id", enrollment.course_id);

    // Get passed assessments
    const { count: passedModules } = await supabase
      .from("module_assessments")
      .select("*", { count: "exact", head: true })
      .eq("enrollment_id", enrollment.id)
      .eq("passed", true);

    setResult({
      valid: true,
      certificate_number: enrollment.certificate_number,
      trainee_name: enrollment.trainee?.name ?? "—",
      trainee_email: enrollment.trainee?.email ?? "—",
      course_title: course?.title ?? "—",
      course_provider: course?.provider ?? "—",
      total_hours: course?.total_hours ?? 0,
      completed_at: enrollment.completed_at,
      credential_level: course?.grants_credential_level ?? null,
      modules_passed: passedModules ?? 0,
      total_modules: totalModules ?? 0,
    });

    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-muted">
      <div className="bg-gradient-to-r from-green-600 to-emerald-700 text-white py-12 px-4">
        <div className="max-w-2xl mx-auto text-center space-y-3">
          <Shield className="size-12 mx-auto opacity-80" />
          <h1 className="text-3xl font-bold">ตรวจสอบใบรับรอง</h1>
          <p className="text-green-100">
            ตรวจสอบความถูกต้องของใบรับรองการอบรม SkillChain RMUTL
          </p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 -mt-6 space-y-6 pb-12">
        {/* Search form */}
        <Card>
          <CardContent className="py-6">
            <form
              onSubmit={handleVerify}
              className="flex gap-3"
            >
              <Input
                placeholder="กรอกเลขที่ใบรับรอง เช่น TC-2026-123456"
                value={certNumber}
                onChange={(e) => setCertNumber(e.target.value)}
                className="flex-1"
              />
              <Button type="submit" disabled={loading}>
                {loading ? (
                  <span className="animate-spin size-4 border-2 border-white border-t-transparent rounded-full" />
                ) : (
                  <Search className="size-4" />
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Not found */}
        {notFound && (
          <Card className="border-red-200">
            <CardContent className="py-8 text-center space-y-3">
              <XCircle className="size-12 mx-auto text-red-500" />
              <p className="font-medium text-red-700">
                ไม่พบใบรับรองเลขที่นี้
              </p>
              <p className="text-sm text-muted-foreground">
                กรุณาตรวจสอบเลขที่ใบรับรองอีกครั้ง
              </p>
            </CardContent>
          </Card>
        )}

        {/* Valid result */}
        {result && (
          <Card className="border-green-200">
            <CardHeader className="text-center border-b bg-green-50/50">
              <CheckCircle className="size-12 mx-auto text-green-500 mb-2" />
              <CardTitle className="text-green-800">
                ใบรับรองถูกต้อง
              </CardTitle>
              <p className="text-sm text-green-600">
                เลขที่: {result.certificate_number}
              </p>
            </CardHeader>
            <CardContent className="py-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex items-start gap-3">
                  <User className="size-5 text-muted-foreground shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">ผู้ผ่านการอบรม</p>
                    <p className="font-medium text-foreground">{result.trainee_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {result.trainee_email}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <GraduationCap className="size-5 text-muted-foreground shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">หลักสูตร</p>
                    <p className="font-medium text-foreground">{result.course_title}</p>
                    <p className="text-xs text-muted-foreground">
                      {result.total_hours} ชั่วโมง
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Calendar className="size-5 text-muted-foreground shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">วันที่สำเร็จ</p>
                    <p className="font-medium text-foreground">
                      {new Date(result.completed_at).toLocaleDateString(
                        "th-TH",
                        {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        }
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <BookOpen className="size-5 text-muted-foreground shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">โมดูลที่ผ่าน</p>
                    <p className="font-medium text-foreground">
                      {result.modules_passed}/{result.total_modules} โมดูล
                    </p>
                  </div>
                </div>
              </div>

              {result.credential_level && (
                <div className="flex items-center gap-2 text-sm bg-amber-50 text-amber-800 rounded-lg px-4 py-3">
                  <Award className="size-5" />
                  ได้รับ Credential:{" "}
                  {result.credential_level.replace("_", " ")}
                </div>
              )}

              <div className="border-t pt-4 text-center">
                <p className="text-xs text-muted-foreground">
                  ออกโดย SkillChain RMUTL — โครงการใต้ร่มพระบารมี
                  มหาวิทยาลัยเทคโนโลยีราชมงคลล้านนา
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
