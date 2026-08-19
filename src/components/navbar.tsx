"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Menu, X, Wrench, LayoutDashboard } from "lucide-react";
import { useEffect, useState } from "react";
import { TrpbBalance } from "@/components/trpb-balance";
import { UserMenu } from "@/components/user-menu";
import { createClient } from "@/lib/supabase/client";

/** หน้า dashboard ของแต่ละบทบาท — ตรงกับ routes ใน (auth)/login/page.tsx */
const DASHBOARD_BY_ROLE: Record<string, string> = {
  student: "/student/dashboard",
  employer: "/employer/dashboard",
  teacher: "/teacher/dashboard",
  project_staff: "/project-staff/dashboard",
  rmutl_staff: "/project-staff/dashboard",
  donor: "/donor/dashboard",
  admin: "/admin/dashboard",
  superadmin: "/admin/dashboard",
};

const navLinks = [
  { href: "/", label: "หน้าหลัก" },
  { href: "/training", label: "หลักสูตรอบรม" },
  { href: "/verify", label: "ตรวจสอบใบรับรอง" },
  { href: "/about", label: "เกี่ยวกับระบบ" },
  { href: "/guides", label: "คู่มือ" },
];

export function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  // null = ยังไม่รู้ (กำลังเช็ค) · false = ไม่ได้ login · string = role
  const [role, setRole] = useState<string | null | false>(null);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!user) {
        setRole(false);
        return;
      }
      const { data: profile } = await supabase
        .from("skc_users")
        .select("role")
        .eq("id", user.id)
        .single();
      if (cancelled) return;
      setRole(profile?.role ?? "student");
    }

    load();

    // อัปเดตทันทีเมื่อ login/logout ในแท็บนี้หรือแท็บอื่น
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) setRole(false);
      else load();
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  // ไม่แสดง navbar ในหน้า dashboard (มี sidebar แล้ว) หรือหน้า print/guides
  if (
    pathname.startsWith("/admin") ||
    pathname.startsWith("/student") ||
    pathname.startsWith("/employer") ||
    pathname.startsWith("/teacher") ||
    pathname.startsWith("/project-staff") ||
    pathname.startsWith("/donor") ||
    pathname.startsWith("/guides/")
  ) {
    return null;
  }

  return (
    <nav className="sticky top-0 z-50 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <div className="max-w-6xl mx-auto px-4 flex items-center justify-between h-14">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 font-bold text-foreground">
          <Wrench className="size-5 text-primary" />
          <span>SkillChain</span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                pathname === link.href
                  ? "bg-secondary text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Desktop CTA — ยังไม่รู้สถานะ (role === null) ให้เว้นว่างไว้
            ดีกว่าโชว์ปุ่มเข้าสู่ระบบแล้วสลับเป็นเมนูผู้ใช้ให้ตากระตุก */}
        <div className="hidden md:flex items-center gap-2">
          <TrpbBalance />
          {role === false && (
            <>
              <Button variant="ghost" size="sm" render={<Link href="/login" />}>
                เข้าสู่ระบบ
              </Button>
              <Button size="sm" render={<Link href="/register" />}>
                ลงทะเบียน
              </Button>
            </>
          )}
          {typeof role === "string" && (
            <>
              <Button
                variant="ghost"
                size="sm"
                render={<Link href={DASHBOARD_BY_ROLE[role] ?? "/student/dashboard"} />}
              >
                <LayoutDashboard className="size-4" />
                หน้าหลักของฉัน
              </Button>
              <UserMenu />
            </>
          )}
        </div>

        {/* Mobile menu toggle */}
        <button className="md:hidden p-2" onClick={() => setOpen(!open)}>
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {/* Mobile dropdown */}
      {open && (
        <div className="md:hidden border-t bg-card px-4 py-3 space-y-1">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className={cn(
                "block px-3 py-2 rounded-lg text-sm font-medium",
                pathname === link.href ? "bg-secondary text-primary" : "text-muted-foreground"
              )}
            >
              {link.label}
            </Link>
          ))}
          {role === false && (
            <div className="flex gap-2 pt-2">
              <Link href="/login" className="flex-1" onClick={() => setOpen(false)}>
                <Button variant="outline" size="sm" className="w-full">เข้าสู่ระบบ</Button>
              </Link>
              <Link href="/register" className="flex-1" onClick={() => setOpen(false)}>
                <Button size="sm" className="w-full">ลงทะเบียน</Button>
              </Link>
            </div>
          )}
          {typeof role === "string" && (
            <div className="flex flex-col gap-2 pt-2">
              <Link
                href={DASHBOARD_BY_ROLE[role] ?? "/student/dashboard"}
                onClick={() => setOpen(false)}
              >
                <Button size="sm" className="w-full">
                  <LayoutDashboard className="size-4" />
                  หน้าหลักของฉัน
                </Button>
              </Link>
              <Link href="/profile/edit" onClick={() => setOpen(false)}>
                <Button variant="outline" size="sm" className="w-full">แก้ไขโปรไฟล์</Button>
              </Link>
            </div>
          )}
        </div>
      )}
    </nav>
  );
}
