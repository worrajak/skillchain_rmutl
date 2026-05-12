"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
  Wallet,
  ChevronRight,
  LogOut,
  Shield,
  Bell,
  Award,
  User as UserIcon,
} from "lucide-react";
import { UserAvatar } from "@/components/user-avatar";

/**
 * Universal /profile page — destination for the "ฉัน" tab on mobile bottom bar.
 * Links to settings + key actions per role.
 */
export default function ProfileHubPage() {
  const supabase = createClient();
  const [user, setUser] = useState<{ name?: string; email?: string; role?: string; avatar_url?: string | null; id?: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { user: au } } = await supabase.auth.getUser();
      if (!au) {
        setLoading(false);
        return;
      }
      const { data: profile } = await supabase
        .from("skc_users")
        .select("id, name, email, role, avatar_url")
        .eq("id", au.id)
        .single();
      setUser(profile);
      setLoading(false);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  if (loading) {
    return <div className="container max-w-md mx-auto p-6">กำลังโหลด...</div>;
  }

  if (!user) {
    return (
      <div className="container max-w-md mx-auto p-6 space-y-4">
        <p>กรุณาเข้าสู่ระบบก่อน</p>
        <Link href="/login"><Button>เข้าสู่ระบบ</Button></Link>
      </div>
    );
  }

  const roleLabel: Record<string, string> = {
    student: "นักศึกษา",
    employer: "ผู้ว่าจ้าง",
    teacher: "อาจารย์",
    admin: "ผู้ดูแลระบบ",
    superadmin: "ผู้ดูแลระบบหลัก",
    donor: "ผู้บริจาค",
    project_staff: "คณะทำงานใต้ร่มฯ",
    rmutl_staff: "คณะทำงานมทร.",
  };

  return (
    <div className="container max-w-md mx-auto px-4 py-6 space-y-4">
      {/* Header — avatar + name */}
      <Card>
        <CardContent className="pt-5 pb-4">
          <div className="flex items-center gap-3">
            <UserAvatar
              user={{ name: user.name, avatar_url: user.avatar_url, role: user.role }}
              size="lg"
              ring
            />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-foreground truncate">{user.name ?? user.email}</p>
              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
              <span className="inline-block mt-1 text-[10px] rounded-full bg-sky-100 text-sky-700 px-2 py-0.5">
                {roleLabel[user.role ?? ""] ?? user.role}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Menu groups */}
      <div className="space-y-2">
        <MenuRow href="/wallet" icon={Wallet} label="Wallet — TRPB" />
        <MenuRow href="/settings/ai" icon={Sparkles} label="ตั้งค่า AI" highlight />
        <MenuRow href="/profile/permissions" icon={Shield} label="สิทธิ์ + การยินยอม" />
        <MenuRow href="/verify" icon={Award} label="ตรวจสอบใบรับรอง" />
        <MenuRow href="#" icon={Bell} label="การแจ้งเตือน" disabled />
        <MenuRow href="/profile/edit" icon={UserIcon} label="แก้ไขโปรไฟล์" />
      </div>

      <Button
        onClick={handleLogout}
        variant="outline"
        className="w-full mt-4 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
      >
        <LogOut className="size-4 mr-2" />
        ออกจากระบบ
      </Button>

      <p className="text-center text-[11px] text-muted-foreground mt-4">
        SkillChain มทร.ล้านนา · ใต้ร่มพระบารมี
      </p>
    </div>
  );
}

function MenuRow({
  href,
  icon: Icon,
  label,
  highlight,
  disabled,
}: {
  href: string;
  icon: typeof Sparkles;
  label: string;
  highlight?: boolean;
  disabled?: boolean;
}) {
  const inner = (
    <Card className={highlight ? "ring-1 ring-amber-200 bg-amber-50/50" : ""}>
      <CardContent className="py-3 px-4 flex items-center gap-3">
        <Icon className={`size-5 ${highlight ? "text-amber-600" : "text-muted-foreground"}`} />
        <span className="flex-1 text-sm font-medium">{label}</span>
        {!disabled && <ChevronRight className="size-4 text-muted-foreground" />}
        {disabled && <span className="text-[10px] text-muted-foreground">เร็วๆ นี้</span>}
      </CardContent>
    </Card>
  );
  if (disabled) return <div className="opacity-60">{inner}</div>;
  return <Link href={href}>{inner}</Link>;
}

function profileHref(role?: string): string {
  switch (role) {
    case "student": return "/student/profile";
    case "employer": return "/employer/profile";
    default: return "/";
  }
}
