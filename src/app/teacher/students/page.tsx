"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Award, UserCheck, Users, Search } from "lucide-react";
import { toast } from "sonner";
import { getCampusLabel } from "@/types/database";

const LEVEL_CONFIG: Record<string, { label: string; color: string }> = {
  LEVEL_1: { label: "Lv.1 ลงทะเบียน", color: "bg-gray-100 text-gray-700" },
  LEVEL_2: { label: "Lv.2 ผ่านฝึกอบรม", color: "bg-amber-100 text-amber-800" },
  LEVEL_3: { label: "Lv.3 อาจารย์รับรอง", color: "bg-blue-100 text-blue-800" },
  LEVEL_4: { label: "Lv.4 สถาบันชาติ", color: "bg-yellow-100 text-yellow-800" },
  LEVEL_5: { label: "Lv.5 ช่างชำนาญการ", color: "bg-purple-100 text-purple-800" },
};

const CERTIFYING = [
  { value: "PROJECT_BARAMEE", label: "กลุ่มใต้ร่มพระบารมี" },
  { value: "RMUTL_TEACHER", label: "อาจารย์ มทร.ล้านนา" },
  { value: "DSD", label: "กรมพัฒนาฝีมือแรงงาน" },
  { value: "TPQI", label: "สถาบันคุณวุฒิวิชาชีพ" },
];

interface StudentRow {
  id: string;
  name: string;
  email: string;
  campus: string;
  faculty: string | null;
  student_id_card: string | null;
  current_level: string;
}

export default function TeacherStudentsPage() {
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterLevel, setFilterLevel] = useState("all");
  const [assignOpen, setAssignOpen] = useState(false);
  const [selected, setSelected] = useState<StudentRow | null>(null);
  const [newLevel, setNewLevel] = useState("LEVEL_2");
  const [certBy, setCertBy] = useState("RMUTL_TEACHER");
  const [specialization, setSpecialization] = useState("");
  const [certRef, setCertRef] = useState("");

  const supabase = createClient();

  async function loadStudents() {
    setLoading(true);
    // ดึง นศ. ทั้งหมด พร้อม credential สูงสุด
    const { data: studs } = await supabase
      .from("users")
      .select("id, name, email, campus, faculty, student_id_card")
      .eq("role", "student")
      .order("name");

    if (!studs) { setLoading(false); return; }

    // ดึง credential ปัจจุบัน
    const { data: creds } = await supabase
      .from("student_credentials")
      .select("student_id, credential_level")
      .eq("is_active", true)
      .order("credential_level", { ascending: false });

    const credMap = new Map<string, string>();
    (creds ?? []).forEach((c) => {
      if (!credMap.has(c.student_id)) credMap.set(c.student_id, c.credential_level);
    });

    const rows: StudentRow[] = studs.map((s) => ({
      ...s,
      current_level: credMap.get(s.id) ?? "LEVEL_1",
    }));

    setStudents(rows);
    setLoading(false);
  }

  useEffect(() => { loadStudents(); }, []);

  const filtered = students.filter((s) => {
    if (search && !s.name.toLowerCase().includes(search.toLowerCase()) && !s.email.includes(search)) return false;
    if (filterLevel !== "all" && s.current_level !== filterLevel) return false;
    return true;
  });

  async function handleAssign() {
    if (!selected) return;
    const { data: { user: me } } = await supabase.auth.getUser();
    if (!me) { toast.error("กรุณาเข้าสู่ระบบ"); return; }

    const { error } = await supabase.from("student_credentials").insert({
      student_id: selected.id,
      credential_level: newLevel,
      certified_by: certBy,
      certified_by_user_id: me.id,
      specialization: specialization || null,
      certificate_ref: certRef || null,
    });

    if (error) {
      toast.error(error.message);
    } else {
      toast.success(`ให้ ${LEVEL_CONFIG[newLevel]?.label} แก่ ${selected.name} สำเร็จ`);
      setAssignOpen(false);
      setSpecialization("");
      setCertRef("");
      loadStudents();
    }
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card>
        <CardContent className="flex flex-wrap gap-3 pt-4 pb-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input placeholder="ค้นหาชื่อ/อีเมล..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={filterLevel} onValueChange={(v) => v && setFilterLevel(v)}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="ทุกระดับ" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทุกระดับ</SelectItem>
              {Object.entries(LEVEL_CONFIG).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Student List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
            <Users className="size-5" />
            นักศึกษา ({filtered.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8"><div className="animate-spin size-6 border-4 border-blue-500 border-t-transparent rounded-full" /></div>
          ) : filtered.length > 0 ? (
            <div className="space-y-2">
              {filtered.map((s) => (
                <div key={s.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-full bg-blue-100 text-blue-700 font-bold text-sm">
                      {s.name.charAt(0)}
                    </div>
                    <div>
                      <div className="font-medium text-sm text-foreground">{s.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {s.student_id_card ?? s.email}
                        {s.faculty ? ` · ${s.faculty}` : ""} · {getCampusLabel(String(s.campus))}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium", LEVEL_CONFIG[s.current_level]?.color ?? "")}>
                      {LEVEL_CONFIG[s.current_level]?.label ?? "Lv.1"}
                    </span>
                    <Button size="sm" variant="outline" onClick={() => {
                      setSelected(s);
                      // แนะนำระดับถัดไป
                      const nextNum = Math.min(parseInt(s.current_level.replace("LEVEL_", "")) + 1, 5);
                      setNewLevel(`LEVEL_${nextNum}`);
                      setAssignOpen(true);
                    }}>
                      <Award className="size-4 mr-1" />เลื่อนระดับ
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">ไม่พบนักศึกษา</p>
          )}
        </CardContent>
      </Card>

      {/* Assign Credential Dialog */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-foreground">ให้ Credential แก่ {selected?.name}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                ระดับปัจจุบัน: <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium ml-1", LEVEL_CONFIG[selected.current_level]?.color)}>
                  {LEVEL_CONFIG[selected.current_level]?.label}
                </span>
              </div>

              <div className="space-y-2">
                <Label className="text-foreground">เลื่อนเป็นระดับ</Label>
                <Select value={newLevel} onValueChange={(v) => v && setNewLevel(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(LEVEL_CONFIG).filter(([k]) => k > selected.current_level).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-foreground">รับรองโดย</Label>
                <Select value={certBy} onValueChange={(v) => v && setCertBy(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CERTIFYING.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-foreground">สาขาเฉพาะทาง</Label>
                <Input placeholder="เช่น ไฟฟ้าภายในอาคาร" value={specialization} onChange={(e) => setSpecialization(e.target.value)} />
              </div>

              <div className="space-y-2">
                <Label className="text-foreground">เลขที่ใบรับรอง (ถ้ามี)</Label>
                <Input placeholder="เช่น DSD-2569-12345" value={certRef} onChange={(e) => setCertRef(e.target.value)} />
              </div>

              <div className="flex gap-3 pt-2">
                <Button onClick={handleAssign} className="flex-1">
                  <UserCheck className="size-4 mr-1" />ยืนยันเลื่อนระดับ
                </Button>
                <Button variant="outline" onClick={() => setAssignOpen(false)}>ยกเลิก</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
