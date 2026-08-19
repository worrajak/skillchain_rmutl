"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Clock, CheckCircle } from "lucide-react";
import { PDPAConsent } from "@/components/pdpa-consent";

const ROLES = [
  { value: "student", label: "นักศึกษา" },
  { value: "employer", label: "ผู้ว่าจ้างภายนอก" },
  { value: "teacher", label: "อาจารย์" },
  { value: "project_staff", label: "คณะทำงานใต้ร่มพระบารมี" },
  { value: "rmutl_staff", label: "คณะทำงาน มทร.ล้านนา" },
  { value: "donor", label: "ผู้บริจาค" },
];

const CAMPUSES = [
  { value: "huaykaew", label: "เชียงใหม่ (ห้วยแก้ว)" },
  { value: "doisaket", label: "เชียงใหม่ (ดอยสะเก็ด)" },
  { value: "chiangrai", label: "เชียงราย" },
  { value: "lampang", label: "ลำปาง" },
  { value: "tak", label: "ตาก" },
  { value: "nan", label: "น่าน" },
  { value: "phitsanulok", label: "พิษณุโลก" },
];

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("student");
  const [campus, setCampus] = useState("huaykaew");
  // ข้อมูลเพิ่มเติมตาม role
  const [studentIdCard, setStudentIdCard] = useState("");
  const [faculty, setFaculty] = useState("");
  const [yearLevel, setYearLevel] = useState("");
  const [organization, setOrganization] = useState("");
  const [orgRegistration, setOrgRegistration] = useState("");
  const [orgAddress, setOrgAddress] = useState("");
  const [staffPosition, setStaffPosition] = useState("");
  const [teacherIdCard, setTeacherIdCard] = useState("");

  const [pdpaAccepted, setPdpaAccepted] = useState(false);
  const [pdpaVersion, setPdpaVersion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const supabase = createClient();

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (!pdpaAccepted) {
      setError("กรุณายอมรับนโยบายความเป็นส่วนตัว (PDPA)");
      setLoading(false);
      return;
    }

    // Rate limit check
    const rlRes = await fetch("/api/auth/register-check", { method: "POST" });
    if (rlRes.status === 429) {
      const rlData = await rlRes.json();
      setError(rlData.error);
      setLoading(false);
      return;
    }

    const metadata: Record<string, unknown> = { name, role, campus, pdpa_version: pdpaVersion };

    // เพิ่มข้อมูลตาม role
    if (role === "student") {
      metadata.student_id_card = studentIdCard;
      metadata.faculty = faculty;
      metadata.year_level = yearLevel ? parseInt(yearLevel) : null;
    } else if (role === "employer") {
      metadata.organization = organization;
      metadata.org_registration = orgRegistration;
      metadata.org_address = orgAddress;
    } else if (role === "teacher") {
      metadata.teacher_id_card = teacherIdCard;
      metadata.faculty = faculty;
    } else if (role === "project_staff" || role === "rmutl_staff") {
      metadata.staff_position = staffPosition;
      metadata.faculty = faculty;
    } else if (role === "donor") {
      metadata.organization = organization;
      metadata.org_registration = orgRegistration;
    }

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: metadata },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted px-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="py-10 space-y-4">
            <CheckCircle className="size-16 mx-auto text-green-500" />
            <CardTitle className="text-foreground">ลงทะเบียนสำเร็จ</CardTitle>
            <div className="flex items-center justify-center gap-2 text-sm text-yellow-700 bg-yellow-50 rounded-lg p-3">
              <Clock className="size-4 shrink-0" />
              <span>บัญชีของคุณอยู่ระหว่าง<strong>รอการยืนยัน</strong>จากผู้ดูแลระบบ</span>
            </div>
            <p className="text-sm text-muted-foreground">
              เมื่อได้รับการยืนยันแล้ว จะสามารถเข้าสู่ระบบได้
            </p>
            <Link href="/login">
              <Button>ไปหน้าเข้าสู่ระบบ</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted px-4 py-8">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl text-foreground">ลงทะเบียน SkillChain</CardTitle>
          <CardDescription>สร้างบัญชีเพื่อเข้าใช้งานระบบ</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleRegister} className="space-y-4">
            {/* ข้อมูลพื้นฐาน */}
            <div className="space-y-2">
              <Label className="text-foreground">ชื่อ-นามสกุล</Label>
              <Input placeholder="ชื่อ นามสกุล" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">อีเมล</Label>
              <Input type="email" placeholder="email@rmutl.ac.th" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">รหัสผ่าน</Label>
              <Input type="password" placeholder="อย่างน้อย 6 ตัวอักษร" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-foreground">บทบาท</Label>
                <Select value={role} onValueChange={(v) => v && setRole(v)}>
                  <SelectTrigger>
                    {ROLES.find((r) => r.value === role)?.label ?? "เลือกบทบาท"}
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">วิทยาเขต</Label>
                <Select value={campus} onValueChange={(v) => v && setCampus(v)}>
                  <SelectTrigger>
                    {CAMPUSES.find((c) => c.value === campus)?.label ?? "เลือกวิทยาเขต"}
                  </SelectTrigger>
                  <SelectContent>
                    {CAMPUSES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* ข้อมูลเพิ่มเติม — นักศึกษา */}
            {role === "student" && (
              <div className="space-y-3 rounded-lg border p-3 bg-blue-50/50">
                <p className="text-xs font-medium text-blue-700">ข้อมูลนักศึกษา</p>
                <Input placeholder="รหัสนักศึกษา" value={studentIdCard} onChange={(e) => setStudentIdCard(e.target.value)} />
                <Input placeholder="คณะ/สาขา" value={faculty} onChange={(e) => setFaculty(e.target.value)} />
                <Select value={yearLevel} onValueChange={(v) => v && setYearLevel(v)}>
                  <SelectTrigger><SelectValue placeholder="ชั้นปี" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">ปี 1</SelectItem>
                    <SelectItem value="2">ปี 2</SelectItem>
                    <SelectItem value="3">ปี 3</SelectItem>
                    <SelectItem value="4">ปี 4</SelectItem>
                    <SelectItem value="5">ปี 5</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* ข้อมูลเพิ่มเติม — ผู้ว่าจ้าง */}
            {role === "employer" && (
              <div className="space-y-3 rounded-lg border p-3 bg-green-50/50">
                <p className="text-xs font-medium text-green-700">ข้อมูลหน่วยงาน/บริษัท</p>
                <Input placeholder="ชื่อหน่วยงาน/บริษัท" value={organization} onChange={(e) => setOrganization(e.target.value)} />
                <Input placeholder="เลขทะเบียนนิติบุคคล" value={orgRegistration} onChange={(e) => setOrgRegistration(e.target.value)} />
                <Input placeholder="ที่อยู่" value={orgAddress} onChange={(e) => setOrgAddress(e.target.value)} />
              </div>
            )}

            {/* ข้อมูลเพิ่มเติม — อาจารย์ */}
            {role === "teacher" && (
              <div className="space-y-3 rounded-lg border p-3 bg-orange-50/50">
                <p className="text-xs font-medium text-orange-700">ข้อมูลอาจารย์</p>
                <Input placeholder="รหัสอาจารย์" value={teacherIdCard} onChange={(e) => setTeacherIdCard(e.target.value)} />
                <Input placeholder="คณะ/สาขา" value={faculty} onChange={(e) => setFaculty(e.target.value)} />
              </div>
            )}

            {/* ข้อมูลเพิ่มเติม — คณะทำงาน */}
            {(role === "project_staff" || role === "rmutl_staff") && (
              <div className="space-y-3 rounded-lg border p-3 bg-purple-50/50">
                <p className="text-xs font-medium text-purple-700">
                  {role === "project_staff" ? "ข้อมูลคณะทำงานใต้ร่มพระบารมี" : "ข้อมูลคณะทำงาน มทร.ล้านนา"}
                </p>
                <Input placeholder="ตำแหน่ง" value={staffPosition} onChange={(e) => setStaffPosition(e.target.value)} />
                <Input placeholder="คณะ/หน่วยงาน" value={faculty} onChange={(e) => setFaculty(e.target.value)} />
              </div>
            )}

            {/* ข้อมูลเพิ่มเติม — ผู้บริจาค */}
            {role === "donor" && (
              <div className="space-y-3 rounded-lg border p-3 bg-yellow-50/50">
                <p className="text-xs font-medium text-yellow-700">ข้อมูลผู้บริจาค</p>
                <Input placeholder="ชื่อหน่วยงาน (ถ้ามี)" value={organization} onChange={(e) => setOrganization(e.target.value)} />
                <Input placeholder="เลขผู้เสียภาษี (สำหรับใบเสร็จ)" value={orgRegistration} onChange={(e) => setOrgRegistration(e.target.value)} />
              </div>
            )}

            {/* PDPA Consent */}
            <PDPAConsent
              accepted={pdpaAccepted}
              onAccept={(version) => { setPdpaAccepted(true); setPdpaVersion(version); }}
            />

            {error && <p className="text-sm text-red-600">{error}</p>}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "กำลังลงทะเบียน..." : "ลงทะเบียน"}
            </Button>

            {!pdpaAccepted && (
              <p className="text-[0.72rem] text-center text-muted-foreground">
                ติ๊กยอมรับนโยบายความเป็นส่วนตัวด้านบนก่อนจึงจะลงทะเบียนได้
              </p>
            )}

            <p className="text-[0.68rem] text-center text-muted-foreground">
              ผู้ดูแลจะตรวจสอบและยืนยันบัญชีภายใน 24 ชั่วโมง — คุณจะได้รับอีเมลแจ้งเมื่อพร้อมใช้งาน
            </p>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            มีบัญชีแล้ว?{" "}
            <Link href="/login" className="text-blue-600 hover:underline">เข้าสู่ระบบ</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
