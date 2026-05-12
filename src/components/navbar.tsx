"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Menu, X, Wrench } from "lucide-react";
import { useState } from "react";
import { TrpbBalance } from "@/components/trpb-balance";

const navLinks = [
  { href: "/", label: "หน้าหลัก" },
  { href: "/training", label: "หลักสูตรอบรม" },
  { href: "/verify", label: "ตรวจสอบใบรับรอง" },
  { href: "/about", label: "เกี่ยวกับระบบ" },
];

export function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

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
          <Wrench className="size-5 text-blue-600" />
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
                  ? "bg-blue-50 text-blue-700"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Desktop CTA */}
        <div className="hidden md:flex items-center gap-2">
          <TrpbBalance />
          <Link href="/login">
            <Button variant="ghost" size="sm">เข้าสู่ระบบ</Button>
          </Link>
          <Link href="/register">
            <Button size="sm">ลงทะเบียน</Button>
          </Link>
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
                pathname === link.href ? "bg-blue-50 text-blue-700" : "text-muted-foreground"
              )}
            >
              {link.label}
            </Link>
          ))}
          <div className="flex gap-2 pt-2">
            <Link href="/login" className="flex-1" onClick={() => setOpen(false)}>
              <Button variant="outline" size="sm" className="w-full">เข้าสู่ระบบ</Button>
            </Link>
            <Link href="/register" className="flex-1" onClick={() => setOpen(false)}>
              <Button size="sm" className="w-full">ลงทะเบียน</Button>
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
