"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, GraduationCap, Loader2 } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

interface ModuleInput {
  title: string;
  hours: number;
  pass_criteria: string;
  competency_code: string;
  description: string;
}

export default function NewCoursePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("general");
  const [provider, setProvider] = useState("RMUTL_TEACHER");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [totalHours, setTotalHours] = useState(0);
  const [maxParticipants, setMaxParticipants] = useState(20);
  const [minParticipants, setMinParticipants] = useState(1);
  const [isOpenToExternal, setIsOpenToExternal] = useState(false);
  const [grantsLevel, setGrantsLevel] = useState("");

  const [modules, setModules] = useState<ModuleInput[]>([
    {
      title: "",
      hours: 0,
      pass_criteria: "ผ่านการทดสอบ",
      competency_code: "",
      description: "",
    },
  ]);

  function addModule() {
    setModules([
      ...modules,
      {
        title: "",
        hours: 0,
        pass_criteria: "ผ่านการทดสอบ",
        competency_code: "",
        description: "",
      },
    ]);
  }

  function removeModule(i: number) {
    setModules(modules.filter((_, idx) => idx !== i));
  }

  function updateModule(i: number, field: keyof ModuleInput, value: string | number) {
    const updated = [...modules];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (updated[i] as any)[field] = value;
    setModules(updated);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title || !startDate || !endDate) {
      toast.error("กรุณากรอกข้อมูลให้ครบ");
      return;
    }
    if (modules.some((m) => !m.title)) {
      toast.error("กรุณากรอกชื่อโมดูลให้ครบ");
      return;
    }

    setLoading(true);
    const res = await fetch("/api/training", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        description,
        category,
        provider,
        start_date: startDate,
        end_date: endDate,
        total_hours: totalHours,
        max_participants: maxParticipants,
        min_participants: minParticipants,
        is_open_to_external: isOpenToExternal,
        grants_credential_level: grantsLevel || null,
        modules: modules.filter((m) => m.title),
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error);
      setLoading(false);
      return;
    }

    toast.success("สร้างหลักสูตรสำเร็จ!");
    router.push(`/training/${data.id}`);
  }

  return (
    <div className="min-h-screen bg-muted py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-indigo-100">
            <GraduationCap className="size-5 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">
              สร้างหลักสูตรฝึกอบรมใหม่
            </h1>
            <p className="text-sm text-muted-foreground">
              กรอกข้อมูลหลักสูตรและโมดูลการเรียนรู้
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-foreground">ข้อมูลหลักสูตร</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-foreground">ชื่อหลักสูตร *</Label>
                <Input
                  placeholder="เช่น หลักสูตรช่างไฟฟ้าในอาคาร"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">รายละเอียด</Label>
                <Textarea
                  placeholder="อธิบายเนื้อหาหลักสูตร..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-foreground">หมวดหมู่</Label>
                  <Select value={category} onValueChange={(v) => v && setCategory(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="electrical">ไฟฟ้า</SelectItem>
                      <SelectItem value="hvac">เครื่องปรับอากาศ</SelectItem>
                      <SelectItem value="automotive">ยานยนต์</SelectItem>
                      <SelectItem value="general">ทั่วไป</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-foreground">ผู้จัดหลักสูตร</Label>
                  <Select value={provider} onValueChange={(v) => v && setProvider(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="RMUTL_TEACHER">อาจารย์ มทร.ล้านนา</SelectItem>
                      <SelectItem value="PROJECT_BARAMEE">ทีมใต้ร่มพระบารมี</SelectItem>
                      <SelectItem value="DSD_PARTNER">สพร.</SelectItem>
                      <SelectItem value="TPQI_PARTNER">สคช.</SelectItem>
                      <SelectItem value="EXTERNAL">วิทยากรภายนอก</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-foreground">วันเริ่ม *</Label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-foreground">วันสิ้นสุด *</Label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-foreground">จำนวนชั่วโมง</Label>
                  <Input
                    type="number"
                    value={totalHours}
                    onChange={(e) => setTotalHours(Number(e.target.value))}
                    min={0}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-foreground">จำนวนรับ (สูงสุด)</Label>
                  <Input
                    type="number"
                    value={maxParticipants}
                    onChange={(e) => setMaxParticipants(Number(e.target.value))}
                    min={1}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-foreground">จำนวนรับ (ขั้นต่ำ)</Label>
                  <Input
                    type="number"
                    value={minParticipants}
                    onChange={(e) => setMinParticipants(Number(e.target.value))}
                    min={1}
                  />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isOpenToExternal}
                    onChange={(e) => setIsOpenToExternal(e.target.checked)}
                    className="rounded"
                  />
                  เปิดรับผู้เรียนภายนอก
                </label>
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">
                  ให้ Credential Level เมื่อผ่าน (ถ้ามี)
                </Label>
                <Select value={grantsLevel} onValueChange={(v) => setGrantsLevel(v ?? "")}>
                  <SelectTrigger>
                    <SelectValue placeholder="ไม่ให้ credential" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">ไม่ให้ credential</SelectItem>
                    <SelectItem value="LEVEL_2">Level 2 — ผ่านฝึกอบรมโครงการ</SelectItem>
                    <SelectItem value="LEVEL_3">Level 3 — อาจารย์รับรอง</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Modules */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-foreground">โมดูลการเรียนรู้</CardTitle>
              <Button type="button" variant="outline" size="sm" onClick={addModule}>
                <Plus className="size-4 mr-1" /> เพิ่มโมดูล
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {modules.map((m, i) => (
                <div
                  key={i}
                  className="p-4 rounded-lg border bg-card space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">
                      โมดูลที่ {i + 1}
                    </span>
                    {modules.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeModule(i)}
                      >
                        <Trash2 className="size-4 text-red-500" />
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-foreground">ชื่อโมดูล *</Label>
                      <Input
                        placeholder="เช่น ความปลอดภัยทางไฟฟ้า"
                        value={m.title}
                        onChange={(e) =>
                          updateModule(i, "title", e.target.value)
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-foreground">ชั่วโมง</Label>
                      <Input
                        type="number"
                        value={m.hours}
                        onChange={(e) =>
                          updateModule(i, "hours", Number(e.target.value))
                        }
                        min={0}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-foreground">คำอธิบาย</Label>
                    <Input
                      placeholder="รายละเอียดโมดูล (ไม่บังคับ)"
                      value={m.description}
                      onChange={(e) =>
                        updateModule(i, "description", e.target.value)
                      }
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-foreground">เกณฑ์ผ่าน</Label>
                      <Input
                        placeholder="เช่น ผ่านการทดสอบ 60%"
                        value={m.pass_criteria}
                        onChange={(e) =>
                          updateModule(i, "pass_criteria", e.target.value)
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-foreground">
                        Competency Code
                      </Label>
                      <Input
                        placeholder="เช่น ELEC-101"
                        value={m.competency_code}
                        onChange={(e) =>
                          updateModule(i, "competency_code", e.target.value)
                        }
                      />
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Submit */}
          <div className="flex justify-between">
            <Link href="/training">
              <Button type="button" variant="outline">
                ยกเลิก
              </Button>
            </Link>
            <Button
              type="submit"
              disabled={loading}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {loading && <Loader2 className="size-4 animate-spin mr-2" />}
              สร้างหลักสูตร
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
