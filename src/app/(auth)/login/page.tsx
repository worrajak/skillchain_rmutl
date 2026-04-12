"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const supabase = createClient();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    // Rate limit check
    const rlRes = await fetch("/api/auth/login", { method: "POST" });
    if (rlRes.status === 429) {
      const rlData = await rlRes.json();
      setError(rlData.error);
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    // Redirect based on role from public.users (source of truth)
    const { data: { user: authUser } } = await supabase.auth.getUser();
    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("id", authUser?.id)
      .single();
    const role = profile?.role ?? authUser?.user_metadata?.role ?? "student";
    const routes: Record<string, string> = {
      student: "/student/dashboard",
      employer: "/employer/dashboard",
      teacher: "/teacher/evaluation",
      admin: "/admin/dashboard",
      superadmin: "/admin/dashboard",
      donor: "/donor/donate",
      project_staff: "/project-staff/approvals",
      rmutl_staff: "/project-staff/approvals",
    };
    router.push(routes[role] ?? "/student/dashboard");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl text-foreground">SkillChain มทร.ล้านนา</CardTitle>
          <CardDescription>เข้าสู่ระบบเพื่อเริ่มต้นใช้งาน</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-foreground">อีเมล</Label>
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
              <Label htmlFor="password" className="text-foreground">รหัสผ่าน</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            ยังไม่มีบัญชี?{" "}
            <Link href="/register" className="text-blue-600 hover:underline">
              ลงทะเบียน
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
