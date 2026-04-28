"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Search, Award, ExternalLink } from "lucide-react";

const LEVEL_LABELS: Record<string, { label: string; color: string }> = {
  LEVEL_1: { label: "ระดับ 1 (เริ่มต้น)", color: "bg-blue-100 text-blue-800" },
  LEVEL_2: { label: "ระดับ 2 (ฝึกหัด)", color: "bg-cyan-100 text-cyan-800" },
  LEVEL_3: { label: "ระดับ 3 (ช่าง)", color: "bg-green-100 text-green-800" },
  LEVEL_4: { label: "ระดับ 4 (ชำนาญ)", color: "bg-amber-100 text-amber-800" },
  LEVEL_5: { label: "ระดับ 5 (เชี่ยวชาญ)", color: "bg-purple-100 text-purple-800" },
};

const BODY_LABELS: Record<string, string> = {
  SYSTEM: "ระบบ",
  PROJECT_BARAMEE: "ใต้ร่มพระบารมี",
  RMUTL_TEACHER: "อาจารย์ มทร.",
  DSD: "กรมพัฒนาฝีมือแรงงาน",
  TPQI: "TPQI",
  MASTER_TECH: "ช่างผู้เชี่ยวชาญ",
};

export default function CredentialsListPage() {
  const [creds, setCreds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState("all");
  const [bodyFilter, setBodyFilter] = useState("all");
  const supabase = createClient();

  async function load() {
    setLoading(true);
    let query = supabase
      .from("skc_student_credentials")
      .select(`
        id, level, certifying_body, issued_at, valid_until, is_active, nft_token_id,
        student:skc_users!skc_student_credentials_student_id_fkey(id, name, email, faculty, campus)
      `)
      .eq("is_active", true)
      .order("issued_at", { ascending: false });

    if (levelFilter !== "all") query = query.eq("level", levelFilter);
    if (bodyFilter !== "all") query = query.eq("certifying_body", bodyFilter);

    const { data } = await query;
    let filtered = data ?? [];
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter((c: any) =>
        c.student?.name?.toLowerCase().includes(q) ||
        c.student?.email?.toLowerCase().includes(q)
      );
    }
    setCreds(filtered);
    setLoading(false);
  }

  useEffect(() => { load(); }, [levelFilter, bodyFilter, search]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Award className="size-6 text-amber-600" />
          ใบรับรองทักษะ (Credentials)
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          รายการใบรับรองทั้งหมดในระบบ — กรองตามระดับ/หน่วยรับรอง
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="flex flex-wrap gap-3 pt-4 pb-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="ค้นหาชื่อ นศ."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={levelFilter} onValueChange={(v) => v && setLevelFilter(v)}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="ทุกระดับ" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทุกระดับ</SelectItem>
              {Object.entries(LEVEL_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={bodyFilter} onValueChange={(v) => v && setBodyFilter(v)}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="ทุกหน่วย" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทุกหน่วยรับรอง</SelectItem>
              {Object.entries(BODY_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Credentials ({creds.length})</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">กำลังโหลด...</div>
          ) : creds.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">ไม่พบใบรับรอง</div>
          ) : (
            <div className="space-y-2">
              {creds.map((c) => (
                <div key={c.id} className="border rounded p-3">
                  <div className="flex items-start justify-between mb-1 flex-wrap gap-2">
                    <div className="font-medium">{c.student?.name ?? "-"}</div>
                    <div className="flex gap-1">
                      <Badge className={LEVEL_LABELS[c.level]?.color ?? "bg-gray-100"}>
                        {LEVEL_LABELS[c.level]?.label ?? c.level}
                      </Badge>
                      <Badge variant="outline">{BODY_LABELS[c.certifying_body] ?? c.certifying_body}</Badge>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    {c.student?.email && <span>{c.student.email}</span>}
                    {c.student?.campus && <span>วิทยาเขต: {c.student.campus}</span>}
                    {c.issued_at && <span>ออก: {new Date(c.issued_at).toLocaleDateString("th-TH")}</span>}
                    {c.valid_until && <span>ใช้ได้ถึง: {new Date(c.valid_until).toLocaleDateString("th-TH")}</span>}
                    {c.nft_token_id && (
                      <a
                        href={`/verify/${c.nft_token_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                      >
                        <ExternalLink className="size-3" />
                        NFT #{c.nft_token_id}
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
