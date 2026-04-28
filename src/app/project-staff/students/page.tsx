"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Search, Star, GraduationCap, Mail, MapPin, Award, Briefcase, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  APPROVED: { label: "อนุมัติแล้ว", color: "bg-green-100 text-green-800" },
  PENDING: { label: "รออนุมัติ", color: "bg-yellow-100 text-yellow-800" },
  SUSPENDED: { label: "ระงับ", color: "bg-red-100 text-red-800" },
};

const CAMPUS_LABELS: Record<string, string> = {
  huaykaew: "เชียงใหม่ (ห้วยแก้ว)",
  doisaket: "เชียงใหม่ (ดอยสะเก็ด)",
  chiangrai: "เชียงราย",
  lampang: "ลำปาง",
  tak: "ตาก",
  nan: "น่าน",
  phitsanulok: "พิษณุโลก",
};

function StarRating({ score, max = 5 }: { score: number | null | undefined; max?: number }) {
  if (score == null) return <span className="text-muted-foreground text-xs">ยังไม่ประเมิน</span>;
  return (
    <span className="inline-flex items-center gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        <Star
          key={i}
          className={cn(
            "size-3",
            i < Math.round(score)
              ? "fill-amber-400 text-amber-400"
              : "text-muted-foreground/30"
          )}
        />
      ))}
      <span className="text-xs ml-1 font-medium">{score.toFixed(1)}</span>
    </span>
  );
}

export default function StudentsListPage() {
  const [students, setStudents] = useState<any[]>([]);
  const [ratings, setRatings] = useState<Record<string, any>>({});
  const [jobCounts, setJobCounts] = useState<Record<string, number>>({});
  const [credentials, setCredentials] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [campusFilter, setCampusFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const supabase = createClient();

  async function load() {
    setLoading(true);

    let query = supabase
      .from("skc_users")
      .select("id, name, email, faculty, campus, year_level, student_id_card, approval_status, avatar_url, created_at")
      .eq("role", "student");

    if (campusFilter !== "all") query = query.eq("campus", campusFilter);
    if (statusFilter !== "all") query = query.eq("approval_status", statusFilter);
    if (search) query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,student_id_card.ilike.%${search}%`);

    const { data: studentsData } = await query.order("name", { ascending: true });
    setStudents(studentsData ?? []);

    if (studentsData && studentsData.length > 0) {
      const ids = studentsData.map((s) => s.id);

      // Ratings
      const { data: ratingsData } = await supabase
        .from("skc_student_rating_summary")
        .select("*")
        .in("student_id", ids);
      setRatings(Object.fromEntries((ratingsData ?? []).map((r) => [r.student_id, r])));

      // Job counts (completed jobs)
      const { data: jobsData } = await supabase
        .from("skc_jobs")
        .select("student_id")
        .in("student_id", ids)
        .in("status", ["COMPLETED", "IN_WARRANTY", "CLOSED"]);
      const counts: Record<string, number> = {};
      for (const j of jobsData ?? []) counts[j.student_id] = (counts[j.student_id] ?? 0) + 1;
      setJobCounts(counts);

      // Credentials
      const { data: credsData } = await supabase
        .from("skc_student_credentials")
        .select("student_id, level, certifying_body, issued_at")
        .in("student_id", ids)
        .eq("is_active", true);
      const credMap: Record<string, any[]> = {};
      for (const c of credsData ?? []) {
        if (!credMap[c.student_id]) credMap[c.student_id] = [];
        credMap[c.student_id].push(c);
      }
      setCredentials(credMap);
    }

    setLoading(false);
  }

  useEffect(() => { load(); }, [search, campusFilter, statusFilter]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <GraduationCap className="size-6 text-purple-600" />
          นักศึกษาในระบบ
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          รายชื่อ + สถานะ + คะแนนประเมิน + ใบรับรอง
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="flex flex-wrap gap-3 pt-4 pb-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="ค้นหาชื่อ/อีเมล/รหัสนักศึกษา..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={campusFilter} onValueChange={(v) => v && setCampusFilter(v)}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="ทุกวิทยาเขต" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทุกวิทยาเขต</SelectItem>
              {Object.entries(CAMPUS_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={(v) => v && setStatusFilter(v)}>
            <SelectTrigger className="w-[150px]"><SelectValue placeholder="ทุกสถานะ" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทุกสถานะ</SelectItem>
              <SelectItem value="APPROVED">อนุมัติแล้ว</SelectItem>
              <SelectItem value="PENDING">รออนุมัติ</SelectItem>
              <SelectItem value="SUSPENDED">ระงับ</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Students grid */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin size-8 border-4 border-purple-500 border-t-transparent rounded-full" />
        </div>
      ) : students.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">ไม่พบนักศึกษา</CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">รายชื่อนักศึกษา ({students.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {students.map((s) => {
              const rating = ratings[s.id];
              const jobsDone = jobCounts[s.id] ?? 0;
              const creds = credentials[s.id] ?? [];
              const status = STATUS_LABELS[s.approval_status] ?? { label: s.approval_status, color: "bg-gray-100" };

              return (
                <div key={s.id} className="border rounded-lg p-3 hover:bg-accent/50 transition-colors">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium flex items-center gap-2 flex-wrap">
                        {s.name}
                        <Badge className={cn("text-[10px]", status.color)}>{status.label}</Badge>
                        {s.year_level && <Badge variant="outline" className="text-[10px]">ปี {s.year_level}</Badge>}
                      </div>
                      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mt-1">
                        {s.student_id_card && <span>รหัส: {s.student_id_card}</span>}
                        {s.email && (
                          <span className="flex items-center gap-1">
                            <Mail className="size-3" />
                            {s.email}
                          </span>
                        )}
                        {s.faculty && <span>คณะ: {s.faculty}</span>}
                        {s.campus && (
                          <span className="flex items-center gap-1">
                            <MapPin className="size-3" />
                            {CAMPUS_LABELS[s.campus] ?? s.campus}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Stats: rating + jobs + credentials */}
                  <div className="flex flex-wrap gap-4 text-xs pt-2 border-t mt-2">
                    <div>
                      <div className="text-[10px] text-muted-foreground mb-0.5">คะแนนรวม</div>
                      <StarRating score={rating?.combined_score} />
                    </div>
                    <div>
                      <div className="text-[10px] text-muted-foreground mb-0.5">อาจารย์</div>
                      <StarRating score={rating?.avg_teacher_score} />
                    </div>
                    <div>
                      <div className="text-[10px] text-muted-foreground mb-0.5">ผู้จ้าง</div>
                      <StarRating score={rating?.avg_employer_rating} />
                    </div>
                    <div>
                      <div className="text-[10px] text-muted-foreground mb-0.5">งานที่ทำ</div>
                      <span className="inline-flex items-center gap-1 font-medium">
                        <Briefcase className="size-3 text-green-600" />
                        {jobsDone}
                      </span>
                    </div>
                    <div>
                      <div className="text-[10px] text-muted-foreground mb-0.5">Credentials</div>
                      {creds.length > 0 ? (
                        <span className="inline-flex items-center gap-1 font-medium">
                          <Award className="size-3 text-amber-600" />
                          {creds.length}
                          {creds[0]?.level && <Badge variant="outline" className="text-[9px] ml-1">{creds[0].level}</Badge>}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
