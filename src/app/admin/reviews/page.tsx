"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Star, GraduationCap, Users, Briefcase } from "lucide-react";

export default function AdminReviewsPage() {
  const [evaluations, setEvaluations] = useState<Record<string, unknown>[]>([]);
  const [employerReviews, setEmployerReviews] = useState<Record<string, unknown>[]>([]);
  const [studentReviews, setStudentReviews] = useState<Record<string, unknown>[]>([]);
  const [mentorReviews, setMentorReviews] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const [{ data: evals }, { data: empR }, { data: stuR }, { data: menR }] = await Promise.all([
        supabase.from("skc_evaluations").select("*, teacher:skc_users!skc_evaluations_teacher_id_fkey(name), student:skc_users!skc_evaluations_student_id_fkey(name), job:skc_jobs(title)").order("created_at", { ascending: false }).limit(50),
        supabase.from("skc_employer_reviews").select("*, employer:skc_users!skc_employer_reviews_employer_id_fkey(name), student:skc_users!skc_employer_reviews_student_id_fkey(name), job:skc_jobs(title)").order("created_at", { ascending: false }).limit(50),
        supabase.from("skc_student_reviews").select("*, student:skc_users!skc_student_reviews_student_id_fkey(name), employer:skc_users!skc_student_reviews_employer_id_fkey(name), job:skc_jobs(title)").order("created_at", { ascending: false }).limit(50),
        supabase.from("skc_mentor_reviews").select("*, mentor:skc_users!skc_mentor_reviews_mentor_id_fkey(name), trainee:skc_users!skc_mentor_reviews_trainee_id_fkey(name), job:skc_jobs(title)").order("created_at", { ascending: false }).limit(50),
      ]);
      setEvaluations(evals ?? []);
      setEmployerReviews(empR ?? []);
      setStudentReviews(stuR ?? []);
      setMentorReviews(menR ?? []);
      setLoading(false);
    }
    load();
  }, []);

  const stars = (n: number) => "★".repeat(Math.round(n)) + "☆".repeat(5 - Math.round(n));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin size-8 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <Tabs defaultValue="evaluations" className="space-y-4">
      <TabsList>
        <TabsTrigger value="evaluations" className="gap-1">
          <GraduationCap className="size-4" /> อาจารย์ ({evaluations.length})
        </TabsTrigger>
        <TabsTrigger value="employer" className="gap-1">
          <Briefcase className="size-4" /> ผู้จ้าง→นศ. ({employerReviews.length})
        </TabsTrigger>
        <TabsTrigger value="student" className="gap-1">
          <Star className="size-4" /> นศ.→ผู้จ้าง ({studentReviews.length})
        </TabsTrigger>
        <TabsTrigger value="mentor" className="gap-1">
          <Users className="size-4" /> Mentor ({mentorReviews.length})
        </TabsTrigger>
      </TabsList>

      {/* Teacher Evaluations */}
      <TabsContent value="evaluations">
        <Card>
          <CardHeader><CardTitle className="text-foreground">การประเมินโดยอาจารย์ (Rubric 4 ด้าน)</CardTitle></CardHeader>
          <CardContent>
            {evaluations.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>งาน</TableHead>
                    <TableHead>อาจารย์</TableHead>
                    <TableHead>นักศึกษา</TableHead>
                    <TableHead>คุณภาพ</TableHead>
                    <TableHead>ทักษะ</TableHead>
                    <TableHead>เวลา</TableHead>
                    <TableHead>อุปกรณ์</TableHead>
                    <TableHead>รวม</TableHead>
                    <TableHead>วันที่</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {evaluations.map((e: Record<string, unknown>) => (
                    <TableRow key={e.id as string}>
                      <TableCell className="text-xs">{(e.job as Record<string, unknown>)?.title as string ?? "-"}</TableCell>
                      <TableCell className="text-xs">{(e.teacher as Record<string, unknown>)?.name as string ?? "-"}</TableCell>
                      <TableCell className="text-xs">{(e.student as Record<string, unknown>)?.name as string ?? "-"}</TableCell>
                      <TableCell className="text-center font-mono">{e.score_quality as number}/4</TableCell>
                      <TableCell className="text-center font-mono">{e.score_skill as number}/4</TableCell>
                      <TableCell className="text-center font-mono">{e.score_time as number}/4</TableCell>
                      <TableCell className="text-center font-mono">{e.score_tool as number}/4</TableCell>
                      <TableCell className="text-center font-bold">{Number(e.weighted_score).toFixed(2)}</TableCell>
                      <TableCell className="text-[10px]">{new Date(e.created_at as string).toLocaleDateString("th-TH")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-center text-muted-foreground py-8">ยังไม่มีการประเมิน</p>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* Employer → Student Reviews */}
      <TabsContent value="employer">
        <Card>
          <CardHeader><CardTitle className="text-foreground">ผู้จ้างให้ดาวนักศึกษา (1-5 ดาว)</CardTitle></CardHeader>
          <CardContent>
            {employerReviews.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>งาน</TableHead>
                    <TableHead>ผู้จ้าง</TableHead>
                    <TableHead>นักศึกษา</TableHead>
                    <TableHead>คุณภาพ</TableHead>
                    <TableHead>ตรงเวลา</TableHead>
                    <TableHead>ทัศนคติ</TableHead>
                    <TableHead>เฉลี่ย</TableHead>
                    <TableHead>วันที่</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employerReviews.map((r: Record<string, unknown>) => (
                    <TableRow key={r.id as string}>
                      <TableCell className="text-xs">{(r.job as Record<string, unknown>)?.title as string ?? "-"}</TableCell>
                      <TableCell className="text-xs">{(r.employer as Record<string, unknown>)?.name as string ?? "-"}</TableCell>
                      <TableCell className="text-xs">{(r.student as Record<string, unknown>)?.name as string ?? "-"}</TableCell>
                      <TableCell className="text-center text-yellow-600">{stars(r.score_quality as number)}</TableCell>
                      <TableCell className="text-center text-yellow-600">{stars(r.score_punctuality as number)}</TableCell>
                      <TableCell className="text-center text-yellow-600">{stars(r.score_attitude as number)}</TableCell>
                      <TableCell className="text-center font-bold">{Number(r.overall_rating).toFixed(1)}</TableCell>
                      <TableCell className="text-[10px]">{new Date(r.created_at as string).toLocaleDateString("th-TH")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-center text-muted-foreground py-8">ยังไม่มีรีวิว</p>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* Student → Employer Reviews */}
      <TabsContent value="student">
        <Card>
          <CardHeader><CardTitle className="text-foreground">นักศึกษาให้ดาวผู้จ้าง (1-5 ดาว)</CardTitle></CardHeader>
          <CardContent>
            {studentReviews.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>งาน</TableHead>
                    <TableHead>นักศึกษา</TableHead>
                    <TableHead>ผู้จ้าง</TableHead>
                    <TableHead>ชัดเจน</TableHead>
                    <TableHead>จ่ายเงิน</TableHead>
                    <TableHead>ปลอดภัย</TableHead>
                    <TableHead>เฉลี่ย</TableHead>
                    <TableHead>วันที่</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {studentReviews.map((r: Record<string, unknown>) => (
                    <TableRow key={r.id as string}>
                      <TableCell className="text-xs">{(r.job as Record<string, unknown>)?.title as string ?? "-"}</TableCell>
                      <TableCell className="text-xs">{(r.student as Record<string, unknown>)?.name as string ?? "-"}</TableCell>
                      <TableCell className="text-xs">{(r.employer as Record<string, unknown>)?.name as string ?? "-"}</TableCell>
                      <TableCell className="text-center text-yellow-600">{stars(r.score_clarity as number)}</TableCell>
                      <TableCell className="text-center text-yellow-600">{stars(r.score_payment as number)}</TableCell>
                      <TableCell className="text-center text-yellow-600">{stars(r.score_safety as number)}</TableCell>
                      <TableCell className="text-center font-bold">{Number(r.overall_rating).toFixed(1)}</TableCell>
                      <TableCell className="text-[10px]">{new Date(r.created_at as string).toLocaleDateString("th-TH")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-center text-muted-foreground py-8">ยังไม่มีรีวิว</p>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* Mentor Reviews */}
      <TabsContent value="mentor">
        <Card>
          <CardHeader><CardTitle className="text-foreground">Mentor ประเมิน Trainee (Rubric 1-4)</CardTitle></CardHeader>
          <CardContent>
            {mentorReviews.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>งาน</TableHead>
                    <TableHead>Mentor</TableHead>
                    <TableHead>Trainee</TableHead>
                    <TableHead>ตั้งใจ</TableHead>
                    <TableHead>ปลอดภัย</TableHead>
                    <TableHead>ทักษะ</TableHead>
                    <TableHead>เฉลี่ย</TableHead>
                    <TableHead>แนะนำเลื่อน</TableHead>
                    <TableHead>วันที่</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mentorReviews.map((r: Record<string, unknown>) => (
                    <TableRow key={r.id as string}>
                      <TableCell className="text-xs">{(r.job as Record<string, unknown>)?.title as string ?? "-"}</TableCell>
                      <TableCell className="text-xs">{(r.mentor as Record<string, unknown>)?.name as string ?? "-"}</TableCell>
                      <TableCell className="text-xs">{(r.trainee as Record<string, unknown>)?.name as string ?? "-"}</TableCell>
                      <TableCell className="text-center font-mono">{r.score_effort as number}/4</TableCell>
                      <TableCell className="text-center font-mono">{r.score_safety as number}/4</TableCell>
                      <TableCell className="text-center font-mono">{r.score_skill_dev as number}/4</TableCell>
                      <TableCell className="text-center font-bold">{Number(r.weighted_score).toFixed(1)}</TableCell>
                      <TableCell className="text-center">{r.recommend_promotion ? "✅" : "-"}</TableCell>
                      <TableCell className="text-[10px]">{new Date(r.created_at as string).toLocaleDateString("th-TH")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-center text-muted-foreground py-8">ยังไม่มีรีวิว</p>
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
