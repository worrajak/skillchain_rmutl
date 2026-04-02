"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Users, Search, Star, Award, MapPin } from "lucide-react";

const LEVEL_CONFIG: Record<string, { label: string; color: string }> = {
  LEVEL_1: { label: "Lv.1", color: "bg-gray-100 text-gray-700" },
  LEVEL_2: { label: "Lv.2", color: "bg-amber-100 text-amber-800" },
  LEVEL_3: { label: "Lv.3", color: "bg-blue-100 text-blue-800" },
  LEVEL_4: { label: "Lv.4", color: "bg-yellow-100 text-yellow-800" },
  LEVEL_5: { label: "Lv.5", color: "bg-purple-100 text-purple-800" },
};

export default function EmployerStudentsPage() {
  const [students, setStudents] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from("student_rating_summary").select("*").order("combined_score", { ascending: false });
      setStudents(data ?? []);
      setLoading(false);
    }
    load();
  }, []);

  const filtered = students.filter((s) => {
    if (!search) return true;
    return String(s.name).toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input placeholder="ค้นหาชื่อนักศึกษา..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2"><Users className="size-5" />นักศึกษาในระบบ ({filtered.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8"><div className="animate-spin size-6 border-4 border-green-500 border-t-transparent rounded-full" /></div>
          ) : filtered.length > 0 ? (
            <div className="space-y-3">
              {filtered.map((s) => (
                <div key={String(s.student_id)} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-full bg-blue-100 text-blue-700 font-bold text-sm">
                      {String(s.name).charAt(0)}
                    </div>
                    <div>
                      <div className="font-medium text-sm text-foreground">{String(s.name)}</div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="size-3" />{String(s.campus)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {s.credential_level && String(s.credential_level) !== "LEVEL_1" ? (
                      <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium", LEVEL_CONFIG[String(s.credential_level)]?.color ?? "")}>
                        {LEVEL_CONFIG[String(s.credential_level)]?.label} {String(s.credential_name ?? "")}
                      </span>
                    ) : null}
                    {Number(s.combined_score) > 0 && (
                      <div className="flex items-center gap-1 text-sm">
                        <Star className="size-4 fill-yellow-400 text-yellow-400" />
                        <span className="font-bold text-foreground">{Number(s.combined_score).toFixed(1)}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">ไม่พบนักศึกษา</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
