"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Clock, CheckCircle, ArrowLeft, ArrowRight, Check } from "lucide-react";
import { PDPAConsent } from "@/components/pdpa-consent";

const ROLES = [
  {
    value: "student",
    label: "นักศึกษา",
    blurb: "รับงานซ่อมบำรุง สะสมชั่วโมงฝึก และรับใบรับรองทักษะ",
  },
  {
    value: "employer",
    label: "ผู้ว่าจ้างภายนอก",
    blurb: "ประกาศงาน เลือกนักศึกษา และจ่ายค่าตอบแทนผ่านระบบ",
  },
  {
    value: "teacher",
    label: "อาจารย์",
    blurb: "ประเมินคุณภาพงาน 4 มิติ และรับรองทักษะนักศึกษา",
  },
  {
    value: "project_staff",
    label: "คณะทำงานใต้ร่มพระบารมี",
    blurb: "จัดสรรงาน อนุมัติคำขอ และดูแลกองทุน",
  },
  {
    value: "rmutl_staff",
    label: "คณะทำงาน มทร.ล้านนา",
    blurb: "แจ้งงานซ่อมบำรุงของหน่วยงานภายในมหาวิทยาลัย",
  },
  {
    value: "donor",
    label: "ผู้บริจาค",
    blurb: "สนับสนุนกองทุนงานจิตอาสาและติดตามการใช้เงิน",
  },
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

const STEPS = ["คุณเป็นใคร", "ข้อมูลบัญชี", "ข้อมูลเพิ่มเติม", "ยอมรับเงื่อนไข"];

/** เกณฑ์รหัสผ่าน — แสดงให้ผู้ใช้เห็นว่าขาดอะไร ไม่ใช่แค่บอกว่าไม่ผ่าน */
function passwordChecks(pw: string) {
  return [
    { label: "อย่างน้อย 8 ตัวอักษร", ok: pw.length >= 8 },
    { label: "มีตัวเลขอย่างน้อย 1 ตัว", ok: /\d/.test(pw) },
    { label: "มีตัวอักษรภาษาอังกฤษ", ok: /[a-zA-Z]/.test(pw) },
  ];
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="size-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      }
    >
      <RegisterWizard />
    </Suspense>
  );
}

function RegisterWizard() {
  const searchParams = useSearchParams();
  const roleFromUrl = searchParams.get("role");
  const initialRole = ROLES.some((r) => r.value === roleFromUrl)
    ? (roleFromUrl as string)
    : "student";

  const [step, setStep] = useState(0);
  const [role, setRole] = useState(initialRole);
  const [campus, setCampus] = useState("huaykaew");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

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

  const isRmutlEmail = /@(.+\.)?rmutl\.ac\.th$/i.test(email.trim());
  const pwChecks = passwordChecks(password);
  const pwOk = pwChecks.every((c) => c.ok);

  /** ตรวจเฉพาะขั้นปัจจุบัน — คืน error string ถ้าไปต่อไม่ได้ */
  function validateStep(s: number): string {
    if (s === 0) {
      if (!role) return "กรุณาเลือกบทบาท";
      if (!campus) return "กรุณาเลือกวิทยาเขต";
    }
    if (s === 1) {
      if (!name.trim()) return "กรุณากรอกชื่อ-นามสกุล";
      if (!email.trim()) return "กรุณากรอกอีเมล";
      if (!pwOk) return "รหัสผ่านยังไม่ครบเกณฑ์ด้านล่าง";
    }
    if (s === 3 && !pdpaAccepted) {
      return "กรุณาติ๊กยอมรับนโยบายความเป็นส่วนตัว (PDPA) ก่อน";
    }
    return "";
  }

  function goNext() {
    const msg = validateStep(step);
    if (msg) {
      setError(msg);
      return;
    }
    setError("");
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function goBack() {
    setError("");
    setStep((s) => Math.max(s - 1, 0));
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();

    // ตรวจทุกขั้นอีกครั้ง เผื่อผู้ใช้ย้อนกลับไปลบข้อมูลทิ้ง
    for (let s = 0; s < STEPS.length; s++) {
      const msg = validateStep(s);
      if (msg) {
        setError(msg);
        setStep(s);
        return;
      }
    }

    setLoading(true);
    setError("");

    const rlRes = await fetch("/api/auth/register-check", { method: "POST" });
    if (rlRes.status === 429) {
      const rlData = await rlRes.json();
      setError(rlData.error);
      setLoading(false);
      return;
    }

    const metadata: Record<string, unknown> = { name, role, campus, pdpa_version: pdpaVersion };

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

    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: metadata },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="space-y-4 py-10">
            <CheckCircle className="mx-auto size-14 text-[var(--brand-success)]" />
            <CardTitle className="text-2xl">ลงทะเบียนสำเร็จ</CardTitle>
            <div className="flex items-start gap-2 rounded-lg bg-accent p-3 text-left text-sm text-accent-foreground">
              <Clock className="mt-0.5 size-4 shrink-0" />
              <span>
                ผู้ดูแลจะตรวจสอบบัญชีของคุณ <strong>ภายใน 24 ชั่วโมง</strong> และส่งอีเมลแจ้งไปที่{" "}
                <strong className="break-all">{email}</strong> เมื่อเข้าใช้งานได้
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              ถ้าไม่ได้รับอีเมลภายใน 24 ชั่วโมง ตรวจในกล่องจดหมายขยะ หรือติดต่อกลุ่มแผนงานใต้ร่มพระบารมี
            </p>
            <Button render={<Link href="/login" />}>ไปหน้าเข้าสู่ระบบ</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const selectedRole = ROLES.find((r) => r.value === role);

  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,26rem)_1fr]">
      {/* แถบซ้าย — บอกว่าเหลืออีกกี่ขั้น */}
      <aside className="flex flex-col justify-between gap-10 bg-primary px-8 py-10 text-primary-foreground lg:px-10 lg:py-14">
        <div>
          <p className="font-mono text-[0.7rem] uppercase tracking-[0.14em] text-primary-foreground/60">
            SkillChain · ลงทะเบียน
          </p>
          <h1 className="mt-8 text-3xl font-semibold leading-tight text-primary-foreground lg:text-4xl">
            มาช่วยกันทำให้งานซ่อม
            <br />
            เป็นโอกาสฝึกวิชาชีพ
          </h1>
          <p className="mt-5 max-w-[42ch] text-sm leading-relaxed text-primary-foreground/75">
            กรอก 4 ขั้นตอน ใช้เวลาประมาณ 3 นาที ผู้ดูแลตรวจสอบภายใน 24 ชั่วโมง
          </p>

          <ol className="mt-10 space-y-4">
            {STEPS.map((label, i) => {
              const done = i < step;
              const active = i === step;
              return (
                <li key={label} className="flex items-center gap-3">
                  <span
                    className={cn(
                      "flex size-6 shrink-0 items-center justify-center rounded-full font-mono text-xs font-bold",
                      done && "bg-primary-foreground/25 text-primary-foreground",
                      active && "bg-[var(--brand-brass)] text-primary",
                      !done && !active && "bg-primary-foreground/15 text-primary-foreground/70"
                    )}
                  >
                    {done ? <Check className="size-3.5" /> : i + 1}
                  </span>
                  <span
                    className={cn(
                      "text-sm",
                      active
                        ? "font-semibold text-primary-foreground"
                        : "text-primary-foreground/70"
                    )}
                  >
                    {label}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>

        <p className="font-mono text-[0.7rem] uppercase tracking-[0.14em] text-primary-foreground/60">
          {step + 1} / {STEPS.length}
        </p>
      </aside>

      {/* ฟอร์ม */}
      <main className="flex items-start justify-center px-4 py-10 lg:items-center lg:px-12">
        <form onSubmit={handleRegister} className="w-full max-w-xl space-y-6">
          <div>
            <p className="font-mono text-[0.7rem] uppercase tracking-[0.14em] text-[var(--brand-brass)]">
              ขั้นตอน {step + 1} จาก {STEPS.length}
            </p>
            <h2 className="mt-1 text-2xl font-bold">{STEPS[step]}</h2>
          </div>

          {/* ── ขั้น 1 · บทบาท + วิทยาเขต ───────────────────────── */}
          {step === 0 && (
            <div className="space-y-5">
              <p className="text-sm text-muted-foreground">
                เลือกบทบาทที่ตรงกับสถานะปัจจุบันของคุณ — แต่ละบทบาทเห็นเมนูและสิทธิ์ต่างกัน
              </p>

              <div className="grid gap-3 sm:grid-cols-2">
                {ROLES.map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => setRole(r.value)}
                    aria-pressed={role === r.value}
                    className={cn(
                      "rounded-lg border-2 p-4 text-left transition-colors",
                      "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                      role === r.value
                        ? "border-primary bg-secondary"
                        : "border-border bg-card hover:border-primary/50"
                    )}
                  >
                    <span className="block font-semibold">{r.label}</span>
                    <span className="mt-1 block text-[0.8rem] leading-relaxed text-muted-foreground">
                      {r.blurb}
                    </span>
                  </button>
                ))}
              </div>

              <div className="space-y-2">
                <Label>วิทยาเขต</Label>
                <Select value={campus} onValueChange={(v) => v && setCampus(v)}>
                  <SelectTrigger className="w-full">
                    {CAMPUSES.find((c) => c.value === campus)?.label ?? "เลือกวิทยาเขต"}
                  </SelectTrigger>
                  <SelectContent>
                    {CAMPUSES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* ── ขั้น 2 · ข้อมูลบัญชี ────────────────────────────── */}
          {step === 1 && (
            <div className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="reg-name">ชื่อ-นามสกุล</Label>
                <Input
                  id="reg-name"
                  placeholder="เช่น สมชาย ใจดี"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="reg-email">อีเมล</Label>
                <Input
                  id="reg-email"
                  type="email"
                  placeholder="เช่น somchai@rmutl.ac.th"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                {email.trim() !== "" && (
                  <p
                    className={cn(
                      "text-[0.8rem]",
                      isRmutlEmail ? "text-[var(--brand-success)]" : "text-muted-foreground"
                    )}
                  >
                    {isRmutlEmail
                      ? "เป็นอีเมลของมหาวิทยาลัย — ตรวจสอบได้เร็วกว่าอีเมลอื่น"
                      : "ใช้อีเมล @rmutl.ac.th จะได้รับการตรวจสอบเร็วกว่า"}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="reg-password">รหัสผ่าน</Label>
                <Input
                  id="reg-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <ul className="space-y-1 pt-1">
                  {pwChecks.map((c) => (
                    <li
                      key={c.label}
                      className={cn(
                        "flex items-center gap-2 text-[0.8rem]",
                        c.ok ? "text-[var(--brand-success)]" : "text-muted-foreground"
                      )}
                    >
                      <Check className={cn("size-3.5", !c.ok && "opacity-30")} />
                      {c.label}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* ── ขั้น 3 · ข้อมูลเพิ่มเติมตามบทบาท ──────────────── */}
          {step === 2 && (
            <div className="space-y-5">
              <p className="text-sm text-muted-foreground">
                ข้อมูลสำหรับบทบาท <strong className="text-foreground">{selectedRole?.label}</strong> —
                กรอกได้ภายหลังในหน้าโปรไฟล์ ถ้ายังไม่พร้อมตอนนี้
              </p>

              {role === "student" && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="f-student-id">รหัสนักศึกษา</Label>
                    <Input
                      id="f-student-id"
                      value={studentIdCard}
                      onChange={(e) => setStudentIdCard(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="f-faculty">คณะ / สาขาวิชา</Label>
                    <Input
                      id="f-faculty"
                      placeholder="เช่น วิศวกรรมไฟฟ้า"
                      value={faculty}
                      onChange={(e) => setFaculty(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>ชั้นปี</Label>
                    <Select value={yearLevel} onValueChange={(v) => v && setYearLevel(v)}>
                      <SelectTrigger className="w-full">
                        {yearLevel ? `ปี ${yearLevel}` : "เลือกชั้นปี"}
                      </SelectTrigger>
                      <SelectContent>
                        {["1", "2", "3", "4", "5"].map((y) => (
                          <SelectItem key={y} value={y}>
                            ปี {y}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              {role === "employer" && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="f-org">ชื่อหน่วยงาน / บริษัท</Label>
                    <Input
                      id="f-org"
                      value={organization}
                      onChange={(e) => setOrganization(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="f-orgreg">เลขทะเบียนนิติบุคคล</Label>
                    <Input
                      id="f-orgreg"
                      inputMode="numeric"
                      value={orgRegistration}
                      onChange={(e) => setOrgRegistration(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="f-orgaddr">ที่อยู่</Label>
                    <Input
                      id="f-orgaddr"
                      value={orgAddress}
                      onChange={(e) => setOrgAddress(e.target.value)}
                    />
                  </div>
                </>
              )}

              {role === "teacher" && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="f-teacher-id">รหัสอาจารย์</Label>
                    <Input
                      id="f-teacher-id"
                      value={teacherIdCard}
                      onChange={(e) => setTeacherIdCard(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="f-teacher-faculty">คณะ / สาขาวิชา</Label>
                    <Input
                      id="f-teacher-faculty"
                      value={faculty}
                      onChange={(e) => setFaculty(e.target.value)}
                    />
                  </div>
                </>
              )}

              {(role === "project_staff" || role === "rmutl_staff") && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="f-position">ตำแหน่ง</Label>
                    <Input
                      id="f-position"
                      value={staffPosition}
                      onChange={(e) => setStaffPosition(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="f-unit">คณะ / หน่วยงาน</Label>
                    <Input
                      id="f-unit"
                      value={faculty}
                      onChange={(e) => setFaculty(e.target.value)}
                    />
                  </div>
                </>
              )}

              {role === "donor" && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="f-donor-org">ชื่อหน่วยงาน (ถ้ามี)</Label>
                    <Input
                      id="f-donor-org"
                      value={organization}
                      onChange={(e) => setOrganization(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="f-taxid">เลขผู้เสียภาษี (สำหรับออกใบเสร็จ)</Label>
                    <Input
                      id="f-taxid"
                      inputMode="numeric"
                      value={orgRegistration}
                      onChange={(e) => setOrgRegistration(e.target.value)}
                    />
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── ขั้น 4 · PDPA + ตรวจทาน ───────────────────────── */}
          {step === 3 && (
            <div className="space-y-5">
              <dl className="divide-y rounded-lg border">
                {[
                  { k: "บทบาท", v: selectedRole?.label },
                  { k: "วิทยาเขต", v: CAMPUSES.find((c) => c.value === campus)?.label },
                  { k: "ชื่อ-นามสกุล", v: name },
                  { k: "อีเมล", v: email },
                ].map((row) => (
                  <div key={row.k} className="flex justify-between gap-4 px-4 py-2.5 text-sm">
                    <dt className="text-muted-foreground">{row.k}</dt>
                    <dd className="text-right font-medium break-all">{row.v}</dd>
                  </div>
                ))}
              </dl>

              <PDPAConsent
                accepted={pdpaAccepted}
                onAccept={(version) => {
                  setPdpaAccepted(true);
                  setPdpaVersion(version);
                }}
              />

              <p className="text-[0.8rem] leading-relaxed text-muted-foreground">
                ผู้ดูแลจะตรวจสอบและยืนยันบัญชีภายใน 24 ชั่วโมง — คุณจะได้รับอีเมลแจ้งเมื่อพร้อมใช้งาน
              </p>
            </div>
          )}

          {error && (
            <p role="alert" className="text-sm font-medium text-destructive">
              {error}
            </p>
          )}

          {/* ปุ่มเดินหน้า/ถอยหลัง */}
          <div className="flex items-center gap-3 pt-2">
            {step > 0 && (
              <Button type="button" variant="outline" size="lg" onClick={goBack}>
                <ArrowLeft className="size-4" />
                ย้อนกลับ
              </Button>
            )}

            {step < STEPS.length - 1 ? (
              <Button type="button" size="lg" className="flex-1" onClick={goNext}>
                ถัดไป — {STEPS[step + 1]}
                <ArrowRight className="size-4" />
              </Button>
            ) : (
              <Button type="submit" size="lg" className="flex-1" disabled={loading}>
                {loading ? "กำลังลงทะเบียน..." : "ลงทะเบียน"}
              </Button>
            )}
          </div>

          <p className="text-center text-sm text-muted-foreground">
            มีบัญชีแล้ว?{" "}
            <Link href="/login" className="font-semibold text-primary hover:underline">
              เข้าสู่ระบบ
            </Link>
          </p>
        </form>
      </main>
    </div>
  );
}
