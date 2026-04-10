"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CheckCircle, GraduationCap } from "lucide-react";

export default function RegisterTraineePage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [occupation, setOccupation] = useState("");
  const [organization, setOrganization] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const supabase = createClient();

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
          role: "trainee",
          campus: "external",
          phone,
          occupation,
          organization,
        },
      },
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
            <CardTitle className="text-foreground">ลงทะเบียนสำเร็จ!</CardTitle>
            <p className="text-sm text-muted-foreground">
              กรุณายืนยันอีเมลของคุณ จากนั้นสามารถเข้าสู่ระบบ<br />และเลือกหลักสูตรอบรมได้ทันที
            </p>
            <Link href="/login">
              <Button>เข้าสู่ระบบ</Button>
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
          <div className="flex justify-center mb-2">
            <div className="flex size-12 items-center justify-center rounded-xl bg-indigo-100">
              <GraduationCap className="size-6 text-indigo-600" />
            </div>
          </div>
          <CardTitle className="text-2xl text-foreground">
            ลงทะเบียนผู้เรียนภายนอก
          </CardTitle>
          <CardDescription>
            สมัครเพื่อเข้าอบรม Reskill / Upskill / New Skill<br />
            โดย มทร.ล้านนา (โครงการใต้ร่มพระบารมี)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-foreground">ชื่อ-นามสกุล *</Label>
              <Input
                placeholder="ชื่อ นามสกุล"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">อีเมล *</Label>
              <Input
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">รหัสผ่าน *</Label>
              <Input
                type="password"
                placeholder="อย่างน้อย 6 ตัวอักษร"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                required
              />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">เบอร์โทรศัพท์</Label>
              <Input
                placeholder="08x-xxx-xxxx"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-foreground">อาชีพ/ตำแหน่ง</Label>
                <Input
                  placeholder="เช่น ช่างอิสระ"
                  value={occupation}
                  onChange={(e) => setOccupation(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">สังกัด/หน่วยงาน</Label>
                <Input
                  placeholder="ถ้ามี"
                  value={organization}
                  onChange={(e) => setOrganization(e.target.value)}
                />
              </div>
            </div>

            <div className="rounded-lg bg-indigo-50 p-3 text-xs text-indigo-800 space-y-1">
              <p>* ผู้เรียนภายนอก <strong>ไม่ต้องรอ</strong> admin ยืนยัน</p>
              <p>* ยืนยันอีเมลแล้วเข้าระบบได้ทันที</p>
              <p>* เมื่อผ่านการอบรม จะได้ใบรับรองบน Blockchain (NFT)</p>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "กำลังลงทะเบียน..." : "สมัครเป็นผู้เรียน"}
            </Button>
          </form>

          <div className="mt-4 text-center text-sm text-muted-foreground space-y-1">
            <p>
              เป็นนักศึกษา มทร.ล้านนา?{" "}
              <Link href="/register" className="text-blue-600 hover:underline">
                ลงทะเบียนนักศึกษา
              </Link>
            </p>
            <p>
              มีบัญชีแล้ว?{" "}
              <Link href="/login" className="text-blue-600 hover:underline">
                เข้าสู่ระบบ
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
