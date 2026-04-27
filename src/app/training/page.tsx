"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  GraduationCap,
  Clock,
  Users,
  Calendar,
  Search,
  BookOpen,
  ExternalLink,
} from "lucide-react";
import { COURSE_STATUS_LABELS, PROVIDER_LABELS } from "@/types/database";
import type { CourseStatus, TrainingProvider } from "@/types/database";

interface CourseRow {
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
  is_open_to_external: boolean;
  grants_credential_level: string | null;
  instructor: { name: string; email: string } | null;
  _enrollment_count?: number;
}

export default function TrainingCatalogPage() {
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "open" | "in_progress">("all");
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("skc_training_courses")
        .select(
          "*, instructor:skc_users!skc_training_courses_instructor_id_fkey(name, email)"
        )
        .in("status", ["OPEN_ENROLLMENT", "IN_PROGRESS", "COMPLETED"])
        .order("start_date", { ascending: false });

      if (data) {
        // Get enrollment counts
        const ids = data.map((c) => c.id);
        const { data: enrollments } = await supabase
          .from("skc_training_enrollments")
          .select("course_id")
          .in("course_id", ids);

        const countMap: Record<string, number> = {};
        (enrollments ?? []).forEach((e) => {
          countMap[e.course_id] = (countMap[e.course_id] || 0) + 1;
        });

        setCourses(
          data.map((c) => ({ ...c, _enrollment_count: countMap[c.id] || 0 }))
        );
      }
      setLoading(false);
    }
    load();
  }, []);

  const filtered = courses.filter((c) => {
    if (filter === "open" && c.status !== "OPEN_ENROLLMENT") return false;
    if (filter === "in_progress" && c.status !== "IN_PROGRESS") return false;
    if (search && !c.title.toLowerCase().includes(search.toLowerCase()))
      return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-muted">
      <div className="bg-gradient-to-r from-indigo-600 to-purple-700 text-white py-12 px-4">
        <div className="max-w-5xl mx-auto text-center space-y-3">
          <GraduationCap className="size-12 mx-auto opacity-80" />
          <h1 className="text-3xl font-bold">
            หลักสูตรฝึกอบรมทักษะช่าง
          </h1>
          <p className="text-indigo-100 max-w-2xl mx-auto">
            Reskill · Upskill · New Skill — โดย มทร.ล้านนา
            ภายใต้โครงการใต้ร่มพระบารมี
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 -mt-6 space-y-6 pb-12">
        {/* Search & filter */}
        <Card>
          <CardContent className="py-4 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="ค้นหาหลักสูตร..."
                className="pl-10"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              {(
                [
                  ["all", "ทั้งหมด"],
                  ["open", "เปิดรับสมัคร"],
                  ["in_progress", "กำลังอบรม"],
                ] as const
              ).map(([key, label]) => (
                <Button
                  key={key}
                  variant={filter === key ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilter(key)}
                >
                  {label}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Course list */}
        {loading ? (
          <p className="text-center text-muted-foreground py-12">
            กำลังโหลด...
          </p>
        ) : filtered.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">
            ไม่พบหลักสูตร
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {filtered.map((c) => {
              const st = COURSE_STATUS_LABELS[c.status];
              return (
                <Link key={c.id} href={`/training/${c.id}`}>
                  <Card className="hover:shadow-md transition-shadow h-full">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-base leading-snug text-foreground">
                          {c.title}
                        </CardTitle>
                        <span
                          className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${st.color}`}
                        >
                          {st.label}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {PROVIDER_LABELS[c.provider]}
                        {c.instructor && ` — ${c.instructor.name}`}
                      </p>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {c.description}
                      </p>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="size-3" />
                          {new Date(c.start_date).toLocaleDateString("th-TH", {
                            day: "numeric",
                            month: "short",
                            year: "2-digit",
                          })}{" "}
                          –{" "}
                          {new Date(c.end_date).toLocaleDateString("th-TH", {
                            day: "numeric",
                            month: "short",
                            year: "2-digit",
                          })}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="size-3" />
                          {c.total_hours} ชม.
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="size-3" />
                          {c._enrollment_count}/{c.max_participants}
                        </span>
                        {c.is_open_to_external && (
                          <span className="flex items-center gap-1 text-indigo-600">
                            <ExternalLink className="size-3" />
                            เปิดรับภายนอก
                          </span>
                        )}
                      </div>
                      {c.grants_credential_level && (
                        <div className="flex items-center gap-1 text-xs text-amber-700 bg-amber-50 rounded px-2 py-1 w-fit">
                          <BookOpen className="size-3" />
                          ได้ credential:{" "}
                          {c.grants_credential_level.replace("_", " ")}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}

        {/* Links */}
        <div className="text-center space-y-2 pt-4">
          <p className="text-sm text-muted-foreground">
            ยังไม่มีบัญชี?{" "}
            <Link
              href="/register-trainee"
              className="text-indigo-600 hover:underline"
            >
              สมัครเป็นผู้เรียนภายนอก
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
