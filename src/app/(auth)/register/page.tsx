"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("student");
  const [campus, setCampus] = useState("huaykaew");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name, role, campus },
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
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle>ลงทะเบียนสำเร็จ</CardTitle>
            <CardDescription>
              กรุณาตรวจสอบอีเมลเพื่อยืนยันบัญชีของคุณ
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/login">
              <Button>ไปหน้าเข้าสู่ระบบ</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">ลงทะเบียน SkillChain</CardTitle>
          <CardDescription>
            สร้างบัญชีเพื่อเข้าใช้งานระบบ
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">ชื่อ-นามสกุล</Label>
              <Input
                id="name"
                placeholder="ชื่อ นามสกุล"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">อีเมล</Label>
              <Input
                id="email"
                type="email"
                placeholder="email@rmutl.ac.th"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">รหัสผ่าน</Label>
              <Input
                id="password"
                type="password"
                placeholder="อย่างน้อย 6 ตัวอักษร"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>บทบาท</Label>
              <Select value={role} onValueChange={(v) => v && setRole(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="student">นักศึกษา (Student)</SelectItem>
                  <SelectItem value="employer">
                    ผู้ว่าจ้าง (Employer)
                  </SelectItem>
                  <SelectItem value="teacher">อาจารย์ (Teacher)</SelectItem>
                  <SelectItem value="donor">ผู้บริจาค (Donor)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>วิทยาเขต</Label>
              <Select value={campus} onValueChange={(v) => v && setCampus(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="huaykaew">ห้วยแก้ว</SelectItem>
                  <SelectItem value="doisaket">ดอยสะเก็ด</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "กำลังลงทะเบียน..." : "ลงทะเบียน"}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            มีบัญชีแล้ว?{" "}
            <Link href="/login" className="text-blue-600 hover:underline">
              เข้าสู่ระบบ
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
