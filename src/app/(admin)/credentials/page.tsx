"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Award, Plus, Search } from "lucide-react";
import { toast } from "sonner";

const LEVEL_LABELS: Record<string, { label: string; color: string }> = {
  LEVEL_1: { label: "Lv.1 ลงทะเบียน", color: "bg-gray-100 text-gray-700" },
  LEVEL_2: { label: "Lv.2 ฝึกอบรมโครงการ", color: "bg-amber-100 text-amber-800" },
  LEVEL_3: { label: "Lv.3 อาจารย์รับรอง", color: "bg-blue-100 text-blue-800" },
  LEVEL_4: { label: "Lv.4 สถาบันระดับชาติ", color: "bg-yellow-100 text-yellow-800" },
  LEVEL_5: { label: "Lv.5 ช่างชำนาญการ", color: "bg-purple-100 text-purple-800" },
};

const CERTIFYING_LABELS: Record<string, string> = {
  SYSTEM: "ระบบอัตโนมัติ",
  PROJECT_BARAMEE: "กลุ่มใต้ร่มพระบารมี",
  RMUTL_TEACHER: "อาจารย์ มทร.ล้านนา",
  DSD: "กรมพัฒนาฝีมือแรงงาน",
  TPQI: "สถาบันคุณวุฒิวิชาชีพ",
  MASTER_TECH: "Master Technician",
};

interface Credential {
  id: string;
  student_id: string;
  credential_level: string;
  certified_by: string;
  certificate_ref: string | null;
  specialization: string | null;
  issued_at: string;
  expires_at: string | null;
  is_active: boolean;
  student?: { name: string; email: string };
}

export default function AdminCredentialsPage() {
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [students, setStudents] = useState<{ id: string; name: string; email: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({
    student_id: "",
    credential_level: "LEVEL_2",
    certified_by: "PROJECT_BARAMEE",
    certificate_ref: "",
    specialization: "",
  });

  const supabase = createClient();

  async function loadData() {
    setLoading(true);
    const [{ data: creds }, { data: studs }] = await Promise.all([
      supabase
        .from("student_credentials")
        .select("*, student:users!student_credentials_student_id_fkey(name, email)")
        .order("created_at", { ascending: false }),
      supabase
        .from("users")
        .select("id, name, email")
        .eq("role", "student")
        .order("name"),
    ]);
    setCredentials((creds as Credential[]) ?? []);
    setStudents(studs ?? []);
    setLoading(false);
  }

  useEffect(() => { loadData(); }, []);

  async function handleAdd() {
    if (!form.student_id || !form.credential_level) {
      toast.error("กรุณาเลือกนักศึกษาและระดับ");
      return;
    }
    const { error } = await supabase.from("student_credentials").insert({
      student_id: form.student_id,
      credential_level: form.credential_level,
      certified_by: form.certified_by,
      certificate_ref: form.certificate_ref || null,
      specialization: form.specialization || null,
    });

    if (!error) {
      toast.success("เพิ่ม credential สำเร็จ");
      setAddOpen(false);
      setForm({ student_id: "", credential_level: "LEVEL_2", certified_by: "PROJECT_BARAMEE", certificate_ref: "", specialization: "" });
      loadData();
    } else {
      toast.error(error.message);
    }
  }

  async function handleToggle(id: string, isActive: boolean) {
    await supabase.from("student_credentials").update({ is_active: !isActive }).eq("id", id);
    toast.success(isActive ? "ระงับแล้ว" : "เปิดใช้งานแล้ว");
    loadData();
  }

  const filtered = credentials.filter((c) => {
    if (!search) return true;
    const name = c.student?.name ?? "";
    return name.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="space-y-4">
      {/* Filters + Add */}
      <Card>
        <CardContent className="flex flex-wrap gap-3 pt-4 pb-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input placeholder="ค้นหาชื่อนักศึกษา..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="size-4 mr-1" />
            เพิ่ม Credential
          </Button>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
            <Award className="size-5" />
            Credentials ({filtered.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin size-6 border-4 border-blue-500 border-t-transparent rounded-full" />
            </div>
          ) : filtered.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>นักศึกษา</TableHead>
                    <TableHead>ระดับ</TableHead>
                    <TableHead>รับรองโดย</TableHead>
                    <TableHead>สาขา</TableHead>
                    <TableHead>เลขที่ใบรับรอง</TableHead>
                    <TableHead>วันที่ออก</TableHead>
                    <TableHead>สถานะ</TableHead>
                    <TableHead className="text-right">จัดการ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>
                        <div className="font-medium text-foreground">{c.student?.name ?? "-"}</div>
                        <div className="text-[10px] text-muted-foreground">{c.student?.email}</div>
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${LEVEL_LABELS[c.credential_level]?.color ?? ""}`}>
                          {LEVEL_LABELS[c.credential_level]?.label ?? c.credential_level}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs">{CERTIFYING_LABELS[c.certified_by] ?? c.certified_by}</TableCell>
                      <TableCell className="text-xs">{c.specialization ?? "-"}</TableCell>
                      <TableCell className="text-xs font-mono">{c.certificate_ref ?? "-"}</TableCell>
                      <TableCell className="text-xs">{new Date(c.issued_at).toLocaleDateString("th-TH")}</TableCell>
                      <TableCell>
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${c.is_active ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                          {c.is_active ? "ใช้งาน" : "ระงับ"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => handleToggle(c.id, c.is_active)}>
                          {c.is_active ? "ระงับ" : "เปิด"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">ไม่พบ credentials</p>
          )}
        </CardContent>
      </Card>

      {/* Add Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-foreground">เพิ่ม Credential ให้นักศึกษา</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-foreground">นักศึกษา</Label>
              <Select value={form.student_id} onValueChange={(v) => v && setForm({ ...form, student_id: v })}>
                <SelectTrigger><SelectValue placeholder="เลือกนักศึกษา" /></SelectTrigger>
                <SelectContent>
                  {students.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name} ({s.email})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">ระดับ Credential</Label>
              <Select value={form.credential_level} onValueChange={(v) => v && setForm({ ...form, credential_level: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(LEVEL_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">รับรองโดย</Label>
              <Select value={form.certified_by} onValueChange={(v) => v && setForm({ ...form, certified_by: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CERTIFYING_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">สาขาเฉพาะทาง</Label>
              <Input placeholder="เช่น ไฟฟ้าภายในอาคาร ระดับ 1" value={form.specialization} onChange={(e) => setForm({ ...form, specialization: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">เลขที่ใบรับรอง</Label>
              <Input placeholder="เช่น DSD-2569-12345" value={form.certificate_ref} onChange={(e) => setForm({ ...form, certificate_ref: e.target.value })} />
            </div>
            <div className="flex gap-3 pt-2">
              <Button onClick={handleAdd} className="flex-1">เพิ่ม Credential</Button>
              <Button variant="outline" onClick={() => setAddOpen(false)}>ยกเลิก</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
